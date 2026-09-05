import React, { useEffect, useRef, useState } from 'react'
import {
  CloseOutlined,
  DeleteOutline,
  HeadsetMicOutlined,
  MicNoneOutlined,
  OpenInFullOutlined,
  RemoveOutlined,
  SendOutlined,
  StopOutlined,
  VolumeOffOutlined,
  VolumeUpOutlined,
} from '@mui/icons-material'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Fade,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { sendAssistantChat, synthesizeSpeech, type ChatMessage } from './assistantApi'
import { uploadTranscription } from './transcriptionApi'

const MASCOT_IMG = '/branding/cs-mascot.png'

const QUICK_PROMPTS = [
  { label: '📦 Cek Stok Menipis', prompt: 'Cek produk apa saja yang persediaan stoknya menipis saat ini' },
  { label: '💰 Status Shift Kasir', prompt: 'Bagaimana status kasir dan kondisi uang kas laci pada shift ini?' },
  { label: '🐱 Rekomendasi Pakan Kitten', prompt: 'Berikan rekomendasi pakan terbaik untuk anak kucing (kitten)' },
  { label: '💳 Panduan Split Payment', prompt: 'Jelaskan cara melakukan pembayaran campuran (split payment) di kasir' },
]

const CHAT_STORAGE_KEY = 'pawpos_assistant_chat_history'

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Halo! Saya **PawPOS AI Assistant** (Groq GPT-OSS 120B) 🐾\nSiap membantu operasional kasir dan toko hewan peliharaan Anda. Tanyakan informasi produk, stok, shift kasir, atau rekomendasi perawatan hewan!',
  timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
}

function loadSavedMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [DEFAULT_WELCOME_MESSAGE]
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (err) {
    console.warn('Failed to load chat history from localStorage', err)
  }
  return [DEFAULT_WELCOME_MESSAGE]
}

export function CsAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadSavedMessages())

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages))
    } catch (err) {
      console.warn('Failed to save chat history to localStorage', err)
    }
  }, [messages])

  function handleClearChat() {
    stopAllSpeech()
    const freshMessages = [
      {
        ...DEFAULT_WELCOME_MESSAGE,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      },
    ]
    setMessages(freshMessages)
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(freshMessages))
    } catch (err) {
      console.warn('Failed to clear chat in localStorage', err)
    }
  }
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const speechSessionRef = useRef<number>(0)

  const speechSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, isOpen])

  async function handleSendMessage(customText?: string) {
    const textToSend = (customText ?? inputMessage).trim()
    if (!textToSend || loading) return

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    }

    const nextHistory = [...messages, userMessage]
    setMessages(nextHistory)
    setInputMessage('')
    setLoading(true)

    try {
      const response = await sendAssistantChat(textToSend, nextHistory)
      const assistantMessage: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Maaf, terjadi kendala saat memproses permintaan: ${err.message || 'Koneksi terganggu'}. Silakan coba lagi.`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  // Voice recording integration
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        if (audioBlob.size < 500) {
          setIsRecording(false)
          return
        }

        setTranscribing(true)
        try {
          const text = await uploadTranscription(audioBlob, { filename: 'voice.webm', durationSeconds: 60 })
          if (text && text.trim()) {
            await handleSendMessage(text.trim())
          }
        } catch {
          // If voice transcription fails, gracefully fallback
        } finally {
          setTranscribing(false)
          setIsRecording(false)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch {
      setIsRecording(false)
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  function stopAllSpeech() {
    speechSessionRef.current += 1
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      audioPlayerRef.current.currentTime = 0
      audioPlayerRef.current.src = ''
      audioPlayerRef.current = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setSpeakingId(null)
    setAudioLoadingId(null)
  }

  async function toggleSpeech(msgId: string, text: string) {
    if (speakingId === msgId || audioLoadingId === msgId) {
      stopAllSpeech()
      return
    }

    stopAllSpeech()

    const cleanText = text.replace(/[*#_`|~]/g, '').trim()
    if (!cleanText) return

    const sessionId = ++speechSessionRef.current
    setAudioLoadingId(msgId)

    try {
      const audioBlob = await synthesizeSpeech(cleanText)

      // If user cancelled or clicked another message while loading, discard
      if (speechSessionRef.current !== sessionId) {
        return
      }

      // Strictly ensure native browser speech is cancelled
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }

      setAudioLoadingId(null)
      setSpeakingId(msgId)

      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioPlayerRef.current = audio

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        if (speechSessionRef.current === sessionId) {
          audioPlayerRef.current = null
          setSpeakingId(null)
        }
      }

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        if (speechSessionRef.current === sessionId) {
          audioPlayerRef.current = null
          setSpeakingId(null)
        }
      }

      await audio.play()
    } catch (err) {
      if (speechSessionRef.current === sessionId) {
        setAudioLoadingId(null)
        setSpeakingId(null)
        console.warn('Gagal memutar suara AI ElevenLabs:', err)
      }
    }
  }

  return (
    <>
      {/* Top Navbar Trigger Button */}
      <Button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Buka PawPOS AI Assistant"
        variant="outlined"
        size="small"
        sx={{
          borderRadius: '999px',
          borderColor: isOpen ? '#FF8A3D' : '#e2e8f0',
          bgcolor: isOpen ? '#FFF5ED' : '#ffffff',
          color: '#1e293b',
          px: { xs: 0.6, sm: 1.25 },
          py: 0.4,
          minWidth: 0,
          textTransform: 'none',
          boxShadow: isOpen ? '0 2px 10px rgba(255, 138, 61, 0.2)' : 'none',
          transition: 'all 0.15s ease',
          '&:hover': {
            borderColor: '#FF8A3D',
            bgcolor: '#FFF5ED',
          },
        }}
      >
        <Stack direction="row" spacing={0.8} alignItems="center">
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            variant="dot"
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: '#10b981',
                color: '#10b981',
                boxShadow: '0 0 0 1.5px #fff',
              },
            }}
          >
            <Avatar
              src={MASCOT_IMG}
              alt="PawPOS Mascot Assistant"
              sx={{
                width: 28,
                height: 28,
                border: '1.5px solid #FF8A3D',
                bgcolor: '#ffffff',
              }}
            />
          </Badge>

          <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left', minWidth: 0 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography
                sx={{
                  fontWeight: 750,
                  fontSize: '0.8rem',
                  lineHeight: 1.2,
                  color: '#1e293b',
                  whiteSpace: 'nowrap',
                }}
              >
                AI Copilot
              </Typography>
              <Chip
                label="GPT-OSS 120B"
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.58rem',
                  fontWeight: 800,
                  bgcolor: '#FF8A3D',
                  color: '#ffffff',
                  borderRadius: '4px',
                }}
              />
            </Stack>
          </Box>
        </Stack>
      </Button>

      {/* Flyout Chat Window Anchored Top-Right */}
      {isOpen && (
        <Fade in={isOpen}>
          <Paper
            elevation={8}
            sx={{
              position: 'fixed',
              top: { xs: 58, sm: 66 },
              right: { xs: 8, sm: 20 },
              width: { xs: 'calc(100vw - 16px)', sm: 400 },
              height: 540,
              maxHeight: 'calc(100vh - 85px)',
              zIndex: 1300,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.18)',
              bgcolor: '#ffffff',
            }}
          >
            {/* Header */}
            <Box
              sx={{
                p: 1.5,
                px: 2,
                bgcolor: '#FFF5ED',
                borderBottom: '1px solid #FFE3CC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.25}>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  variant="dot"
                  sx={{
                    '& .MuiBadge-badge': {
                      bgcolor: '#10b981',
                      color: '#10b981',
                      boxShadow: '0 0 0 2px #fff',
                    },
                  }}
                >
                  <Avatar
                    src={MASCOT_IMG}
                    alt="PawPOS Mascot CS"
                    sx={{
                      width: 38,
                      height: 38,
                      border: '2px solid #FF8A3D',
                      bgcolor: '#ffffff',
                    }}
                  />
                </Badge>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Typography sx={{ fontWeight: 850, fontSize: '0.94rem', color: '#2D2D2D' }}>
                      Paw<span style={{ color: '#FF8A3D' }}>POS</span> AI Assistant
                    </Typography>
                    <Chip
                      label="GPT-OSS 120B"
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.58rem',
                        fontWeight: 800,
                        bgcolor: '#FF8A3D',
                        color: '#ffffff',
                        borderRadius: '4px',
                      }}
                    />
                  </Stack>
                  <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.72rem', display: 'block' }}>
                    Online • Copilot Operasional Toko
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Tooltip title="Bersihkan Riwayat Chat">
                  <IconButton
                    size="small"
                    onClick={handleClearChat}
                    aria-label="Bersihkan riwayat chat"
                    sx={{ color: '#64748B', '&:hover': { bgcolor: '#FFE3CC', color: '#ea580c' } }}
                  >
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Tutup Asisten">
                  <IconButton
                    size="small"
                    onClick={() => setIsOpen(false)}
                    aria-label="Tutup asisten"
                    sx={{ color: '#64748B', '&:hover': { bgcolor: '#FFE3CC', color: '#dc2626' } }}
                  >
                    <CloseOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>

            {/* Quick Action Chips Bar */}
            <Box
              sx={{
                p: 1,
                px: 1.5,
                bgcolor: '#fafafa',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                gap: 0.75,
                overflowX: 'auto',
                '&::-webkit-scrollbar': { height: 4 },
                '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 2 },
              }}
            >
              {QUICK_PROMPTS.map((qp, idx) => (
                <Chip
                  key={idx}
                  label={qp.label}
                  size="small"
                  onClick={() => handleSendMessage(qp.prompt)}
                  disabled={loading}
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 650,
                    bgcolor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    color: '#334155',
                    cursor: 'pointer',
                    flexShrink: 0,
                    '&:hover': {
                      bgcolor: '#FFF5ED',
                      borderColor: '#FF8A3D',
                      color: '#FF8A3D',
                    },
                  }}
                />
              ))}
            </Box>

            {/* Message History List */}
            <Box
              sx={{
                flex: 1,
                overflowY: 'auto',
                p: 1.75,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                bgcolor: '#f8fafc',
              }}
            >
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user'
                return (
                  <Box
                    key={msg.id ?? idx}
                    sx={{
                      display: 'flex',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                      gap: 1,
                      alignItems: 'flex-start',
                    }}
                  >
                    {!isUser && (
                      <Avatar
                        src={MASCOT_IMG}
                        alt="Mascot"
                        sx={{
                          width: 28,
                          height: 28,
                          border: '1px solid #FF8A3D',
                          flexShrink: 0,
                          mt: 0.5,
                        }}
                      />
                    )}
                    <Box sx={{ maxWidth: '82%' }}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.25,
                          px: 1.5,
                          borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                          bgcolor: isUser ? '#2D2D2D' : '#ffffff',
                          color: isUser ? '#ffffff' : '#1e293b',
                          border: isUser ? 'none' : '1px solid #e2e8f0',
                          fontSize: '0.84rem',
                          lineHeight: 1.5,
                          wordBreak: 'break-word',
                        }}
                      >
                        <FormattedMessage content={msg.content} isUser={isUser} />
                      </Paper>

                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent={isUser ? 'flex-end' : 'space-between'}
                        sx={{ mt: 0.35, px: 0.5 }}
                      >
                        {!isUser && (
                          <Tooltip
                            title={
                              audioLoadingId === (msg.id ?? `${idx}`)
                                ? 'Menyiapkan audio AI...'
                                : speakingId === (msg.id ?? `${idx}`)
                                ? 'Hentikan suara'
                                : 'Dengarkan suara AI ElevenLabs'
                            }
                          >
                            <span>
                              <IconButton
                                size="small"
                                disabled={audioLoadingId === (msg.id ?? `${idx}`)}
                                onClick={() => toggleSpeech(msg.id ?? `${idx}`, msg.content)}
                                aria-label={speakingId === (msg.id ?? `${idx}`) ? 'Matikan suara' : 'Dengarkan suara'}
                                sx={{ p: 0.25, color: speakingId === (msg.id ?? `${idx}`) ? '#FF8A3D' : '#94a3b8' }}
                              >
                                {audioLoadingId === (msg.id ?? `${idx}`) ? (
                                  <CircularProgress size={14} sx={{ color: '#FF8A3D' }} />
                                ) : speakingId === (msg.id ?? `${idx}`) ? (
                                  <VolumeOffOutlined sx={{ fontSize: 15 }} />
                                ) : (
                                  <VolumeUpOutlined sx={{ fontSize: 15 }} />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.64rem' }}>
                          {msg.timestamp}
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                )
              })}

              {(loading || transcribing) && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar src={MASCOT_IMG} alt="Mascot" sx={{ width: 28, height: 28, border: '1px solid #FF8A3D' }} />
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.25,
                      px: 1.5,
                      borderRadius: '14px 14px 14px 2px',
                      bgcolor: '#FFF5ED',
                      border: '1px solid #FFE3CC',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <CircularProgress size={14} sx={{ color: '#FF8A3D' }} />
                    <Typography sx={{ fontSize: '0.78rem', color: '#D95D10', fontWeight: 650 }}>
                      {transcribing ? 'Mentranskripsi suara...' : 'AI is Thinking (Groq GPT-OSS 120B)...'}
                    </Typography>
                  </Paper>
                </Box>
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Input Bar */}
            <Box sx={{ p: 1.25, px: 1.5, borderTop: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
              {isRecording ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 1,
                    px: 1.5,
                    bgcolor: '#fee2e2',
                    border: '1px solid #fca5a5',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: '#dc2626',
                        animation: 'pulse 1s infinite',
                        '@keyframes pulse': {
                          '0%': { opacity: 1 },
                          '50%': { opacity: 0.3 },
                          '100%': { opacity: 1 },
                        },
                      }}
                    />
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#991b1b' }}>
                      Mendengarkan ucapan kasir...
                    </Typography>
                  </Stack>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    startIcon={<StopOutlined />}
                    onClick={stopRecording}
                    sx={{ minHeight: 30, py: 0.25, fontSize: '0.75rem', fontWeight: 700 }}
                  >
                    Kirim Suara
                  </Button>
                </Paper>
              ) : (
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Tanya produk, stok, shift, pet care..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleSendMessage()
                    }
                  }}
                  disabled={loading || transcribing}
                  InputProps={{
                    sx: {
                      fontSize: '0.84rem',
                      borderRadius: '10px',
                      bgcolor: '#f8fafc',
                    },
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Rekam Suara (Voice)">
                          <IconButton
                            size="small"
                            onClick={startRecording}
                            disabled={loading || transcribing}
                            aria-label="Rekam suara asisten"
                            sx={{ color: '#FF8A3D', mr: 0.25 }}
                          >
                            <MicNoneOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleSendMessage()}
                          disabled={!inputMessage.trim() || loading || transcribing}
                          aria-label="Kirim pesan"
                          sx={{
                            bgcolor: inputMessage.trim() ? '#FF8A3D' : 'transparent',
                            color: inputMessage.trim() ? '#ffffff' : '#94a3b8',
                            '&:hover': {
                              bgcolor: '#E66E20',
                              color: '#ffffff',
                            },
                          }}
                        >
                          <SendOutlined fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            </Box>
          </Paper>
        </Fade>
      )}
    </>
  )
}

function FormattedMessage({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    return <span>{content}</span>
  }

  // Pre-clean raw markdown table artifacts and pipe characters
  const cleanContent = content
    // Remove table separator rows like |---|---|
    .replace(/^\|?(\s*:?-+:?\s*\|)+\s*$/gm, '')
    // Convert table rows | Col1 | Col2 | to bullet points
    .replace(/^\|(.+)\|$/gm, (_, inner: string) => {
      const cols = inner
        .split('|')
        .map((c: string) => c.trim())
        .filter(Boolean)
      return `• ${cols.join(' — ')}`
    })
    // Replace remaining pipe symbols with bullet dot
    .replace(/\s*\|\s*/g, ' • ')
    // Remove markdown headers (#, ##, ###)
    .replace(/^#{1,6}\s+/gm, '')

  const lines = cleanContent.split('\n')

  return (
    <Stack spacing={0.5}>
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim()
        if (!line) {
          return <Box key={idx} sx={{ height: 3 }} />
        }

        // Check if line is a bullet item or numbered list
        const bulletMatch = line.match(/^([•\-\*]|\d+\.)\s+(.*)$/)
        if (bulletMatch) {
          const marker = bulletMatch[1]
          const body = bulletMatch[2]
          const isNumber = /^\d+\./.test(marker)

          return (
            <Stack key={idx} direction="row" spacing={0.8} alignItems="flex-start" sx={{ pl: 0.25 }}>
              <Typography
                component="span"
                sx={{
                  color: '#FF8A3D',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  lineHeight: 1.5,
                  minWidth: isNumber ? 18 : 10,
                  flexShrink: 0,
                }}
              >
                {isNumber ? marker : '•'}
              </Typography>
              <Typography
                component="div"
                sx={{
                  fontSize: '0.84rem',
                  lineHeight: 1.5,
                  color: '#1e293b',
                  flex: 1,
                }}
              >
                {renderInlineMarkdown(body, isUser)}
              </Typography>
            </Stack>
          )
        }

        return (
          <Typography
            key={idx}
            component="div"
            sx={{
              fontSize: '0.84rem',
              lineHeight: 1.5,
              color: '#1e293b',
            }}
          >
            {renderInlineMarkdown(line, isUser)}
          </Typography>
        )
      })}
    </Stack>
  )
}

function renderInlineMarkdown(text: string, isUser: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const prev = text.substring(lastIndex, match.index).replace(/[|*`#~]/g, '')
      if (prev) parts.push(prev)
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      const boldText = token.slice(2, -2).replace(/[|*`#~]/g, '')
      parts.push(
        <Box
          key={match.index}
          component="strong"
          sx={{ fontWeight: 750, color: isUser ? '#ffffff' : '#0f172a' }}
        >
          {boldText}
        </Box>,
      )
    } else if (token.startsWith('*') && token.endsWith('*')) {
      const italicText = token.slice(1, -1).replace(/[|*`#~]/g, '')
      parts.push(
        <Box
          key={match.index}
          component="span"
          sx={{ fontStyle: 'italic', color: isUser ? '#f1f5f9' : '#334155' }}
        >
          {italicText}
        </Box>,
      )
    } else if (token.startsWith('`') && token.endsWith('`')) {
      const codeText = token.slice(1, -1)
      parts.push(
        <Box
          key={match.index}
          component="code"
          sx={{
            bgcolor: isUser ? '#404040' : '#f1f5f9',
            color: isUser ? '#fcd34d' : '#ea580c',
            px: 0.6,
            py: 0.15,
            borderRadius: '4px',
            fontSize: '0.78rem',
            fontFamily: 'monospace',
            fontWeight: 650,
          }}
        >
          {codeText}
        </Box>,
      )
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex).replace(/[|*`#~]/g, '')
    if (remaining) parts.push(remaining)
  }

  return parts
}
