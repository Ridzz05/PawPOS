import { useEffect, useRef, useState } from 'react'
import { CancelOutlined, CloseOutlined, MicNoneOutlined, RecordVoiceOverOutlined, StopOutlined, VolumeOffOutlined, VolumeUpOutlined } from '@mui/icons-material'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import { TranscriptionApiError, uploadTranscription } from './transcriptionApi'
import { ModalSlideTransition } from '../../components/ModalSlideTransition'
import { MascotAvatar } from '../../components/MascotAvatar'
import { Chip } from '@mui/material'

export type VoiceRecorderState = 'idle' | 'requesting' | 'listening' | 'uploading' | 'success' | 'error' | 'cancelled'

type RecorderConstructor = {
  new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder
  isTypeSupported?: (mimeType: string) => boolean
}

type RecorderSession = {
  id: number
  mimeType: string
  startedAt: number
  chunks: Blob[]
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
]

const MIME_DETAILS: Record<string, { extension: string; contentType: string }> = {
  'audio/webm': { extension: 'webm', contentType: 'audio/webm' },
  'audio/ogg': { extension: 'ogg', contentType: 'audio/ogg' },
  'audio/mp4': { extension: 'mp4', contentType: 'audio/mp4' },
  'audio/mpeg': { extension: 'mp3', contentType: 'audio/mpeg' },
}

export function selectAudioMimeType(recorderConstructor: RecorderConstructor | null): string | null {
  if (!recorderConstructor) return null
  return MIME_CANDIDATES.find((mimeType) => recorderConstructor.isTypeSupported?.(mimeType) ?? false) ?? null
}

function getRecorderConstructor(): RecorderConstructor | null {
  const candidate = globalThis.MediaRecorder
  return typeof candidate === 'function' ? candidate as unknown as RecorderConstructor : null
}

function getErrorCopy(error: unknown): string {
  if (error instanceof TranscriptionApiError) {
    const copyByCode: Record<string, string> = {
      ASSISTANT_DISABLED: 'Transkripsi suara belum diaktifkan di server. Lanjutkan dengan input manual.',
      TRANSCRIPTION_NOT_CONFIGURED: 'Server belum dikonfigurasi untuk transkripsi suara. Hubungi admin atau lanjutkan dengan input manual.',
      AUDIO_REQUIRED: 'Rekaman kosong. Tahan tombol rekam lebih lama, lalu coba lagi.',
      AUDIO_TOO_LONG: 'Rekaman terlalu panjang. Buat rekaman yang lebih singkat, lalu coba lagi.',
      AUDIO_TOO_LARGE: 'Ukuran rekaman terlalu besar. Buat rekaman yang lebih singkat, lalu coba lagi.',
      UNSUPPORTED_AUDIO: 'Format audio browser ini tidak didukung server. Coba browser lain.',
      TRANSCRIPTION_PROVIDER_ERROR: 'Server gagal memproses suara. Coba lagi atau masukkan teks secara manual.',
      INVALID_TRANSCRIPTION_RESPONSE: 'Server mengirim hasil transkripsi yang tidak lengkap. Coba lagi.',
      NETWORK_ERROR: 'Koneksi ke server gagal. Periksa jaringan lalu coba lagi.',
      INVALID_RESPONSE: 'Respons server tidak dapat dibaca. Coba lagi.',
      HTTP_ERROR: 'Server menolak rekaman suara. Coba lagi atau lanjutkan dengan input manual.',
    }
    return copyByCode[error.code] ?? 'Transkripsi suara gagal. Coba lagi atau lanjutkan dengan input manual.'
  }

  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Akses mikrofon ditolak. Izinkan mikrofon di pengaturan browser, lalu coba lagi.'
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'Mikrofon tidak ditemukan. Sambungkan mikrofon, lalu coba lagi.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'Perekaman suara gagal. Coba lagi.'
}

export type UseVoiceRecorderResult = {
  state: VoiceRecorderState
  transcription: string
  error: string
  startRecording: () => Promise<void>
  stopRecording: () => void
  cancelRecording: () => void
  reset: () => void
}

export function useVoiceRecorder(): UseVoiceRecorderResult {
  const [state, setState] = useState<VoiceRecorderState>('idle')
  const [transcription, setTranscription] = useState('')
  const [error, setError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionRef = useRef<RecorderSession | null>(null)
  const operationRef = useRef(0)
  const uploadControllerRef = useRef<AbortController | null>(null)

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  function isCurrent(operation: number) {
    return operationRef.current === operation
  }

  function fail(operation: number, cause: unknown) {
    if (!isCurrent(operation)) return
    stopTracks()
    recorderRef.current = null
    sessionRef.current = null
    setState('error')
    setError(getErrorCopy(cause))
  }

  async function finishRecording(operation: number) {
    const session = sessionRef.current
    if (!session || !isCurrent(operation)) return
    stopTracks()
    recorderRef.current = null
    sessionRef.current = null

    const mime = MIME_DETAILS[session.mimeType.split(';', 1)[0]] ?? { extension: 'webm', contentType: 'audio/webm' }
    const blob = new Blob(session.chunks, { type: mime.contentType })
    if (blob.size === 0) {
      setState('error')
      setError('Rekaman kosong. Tahan tombol rekam lebih lama, lalu coba lagi.')
      return
    }

    setState('uploading')
    const controller = new AbortController()
    uploadControllerRef.current = controller
    try {
      const text = await uploadTranscription(blob, {
        filename: `voice.${mime.extension}`,
        durationSeconds: (Date.now() - session.startedAt) / 1000,
        signal: controller.signal,
      })
      if (!isCurrent(operation)) return
      setTranscription(text)
      setState('success')
      setError('')
    } catch (cause) {
      if (!isCurrent(operation) || (cause instanceof DOMException && cause.name === 'AbortError')) return
      fail(operation, cause)
    } finally {
      if (isCurrent(operation)) uploadControllerRef.current = null
    }
  }

  async function startRecording() {
    if (state === 'requesting' || state === 'listening' || state === 'uploading') return
    const operation = operationRef.current + 1
    operationRef.current = operation
    setTranscription('')
    setError('')
    setState('requesting')

    const recorderConstructor = getRecorderConstructor()
    if (!recorderConstructor) {
      fail(operation, new Error('Browser ini tidak mendukung perekaman suara. Gunakan browser yang lebih baru.'))
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      fail(operation, new Error('Browser ini tidak menyediakan akses mikrofon. Gunakan browser yang mendukung mikrofon.'))
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (cause) {
      fail(operation, cause)
      return
    }
    if (!isCurrent(operation)) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }

    const selectedMimeType = selectAudioMimeType(recorderConstructor)
    if (!selectedMimeType) {
      stream.getTracks().forEach((track) => track.stop())
      fail(operation, new Error('Browser ini tidak mendukung format audio yang diperlukan server.'))
      return
    }

    streamRef.current = stream
    const session: RecorderSession = { id: operation, mimeType: selectedMimeType, startedAt: Date.now(), chunks: [] }
    try {
      const recorder = new recorderConstructor(stream, { mimeType: selectedMimeType })
      sessionRef.current = session
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && isCurrent(operation)) session.chunks.push(event.data)
      }
      recorder.onerror = () => fail(operation, new Error('Perekaman suara terhenti. Coba lagi.'))
      recorder.onstop = () => { void finishRecording(operation) }
      recorder.start()
      setState('listening')
    } catch (cause) {
      fail(operation, cause)
    }
  }

  function stopRecording() {
    if (state !== 'listening') return
    const recorder = recorderRef.current
    if (!recorder) {
      fail(operationRef.current, new Error('Perekam tidak tersedia. Coba lagi.'))
      return
    }
    try {
      recorder.stop()
    } catch (cause) {
      fail(operationRef.current, cause)
    }
  }

  function cancelRecording() {
    if (state === 'idle' || state === 'success' || state === 'error' || state === 'cancelled') return
    operationRef.current += 1
    uploadControllerRef.current?.abort()
    uploadControllerRef.current = null
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    } catch {
      // Stop may reject after a browser has already closed the recorder.
    }
    recorderRef.current = null
    sessionRef.current = null
    stopTracks()
    setState('cancelled')
    setError('Perekaman dibatalkan.')
  }

  function reset() {
    operationRef.current += 1
    uploadControllerRef.current?.abort()
    uploadControllerRef.current = null
    recorderRef.current = null
    sessionRef.current = null
    stopTracks()
    setState('idle')
    setTranscription('')
    setError('')
  }

  useEffect(() => reset, [])

  return { state, transcription, error, startRecording, stopRecording, cancelRecording, reset }
}

const stateLabel: Record<VoiceRecorderState, string> = {
  idle: 'Siap merekam',
  requesting: 'Meminta akses mikrofon',
  listening: 'Sedang merekam',
  uploading: 'Mengunggah dan mentranskripsi',
  success: 'Transkripsi selesai',
  error: 'Transkripsi gagal',
  cancelled: 'Perekaman dibatalkan',
}

function StatusMessage({ state, error }: { state: VoiceRecorderState; error: string }) {
  if (state === 'error') return <Alert severity="error" role="alert">{error}</Alert>
  if (state === 'cancelled') return <Alert severity="info" role="status">{error}</Alert>
  return <Typography role="status" aria-live="polite" color={state === 'success' ? 'secondary.main' : 'text.secondary'}>{stateLabel[state]}</Typography>
}

export function VoiceRecorder() {
  const recorder = useVoiceRecorder()
  const [open, setOpen] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

  function openAndStart() {
    setOpen(true)
    void recorder.startRecording()
  }

  function stopSpeaking() {
    if (!speechSupported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  function closeDialog() {
    if (recorder.state === 'requesting' || recorder.state === 'listening' || recorder.state === 'uploading') {
      recorder.cancelRecording()
    }
    stopSpeaking()
    setOpen(false)
  }

  function toggleSpeaking() {
    if (!speechSupported || !recorder.transcription) return
    if (speaking) {
      stopSpeaking()
      return
    }
    const utterance = new window.SpeechSynthesisUtterance(recorder.transcription)
    utterance.lang = 'id-ID'
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }

  useEffect(() => () => stopSpeaking(), [])
  useEffect(() => {
    if (recorder.state !== 'success') stopSpeaking()
  }, [recorder.state])

  const controlLabel = recorder.state === 'listening' ? 'Hentikan rekaman' : recorder.state === 'uploading' ? 'Memproses rekaman' : 'Rekam suara'
  const controlAction = recorder.state === 'listening' ? recorder.stopRecording : openAndStart

  return <>
    <Button
      variant={recorder.state === 'listening' ? 'contained' : 'outlined'}
      color={recorder.state === 'listening' ? 'primary' : 'inherit'}
      startIcon={recorder.state === 'listening' ? <StopOutlined /> : <MicNoneOutlined />}
      onClick={controlAction}
      disabled={recorder.state === 'uploading'}
      aria-label={controlLabel}
      sx={{
        minHeight: { xs: 36, sm: 42 },
        height: { xs: 36, sm: 42 },
        px: { xs: 1.25, sm: 2 },
        fontSize: { xs: '0.78rem', sm: '0.85rem' },
        flexShrink: 0,
        borderColor: 'divider',
        whiteSpace: 'nowrap',
      }}
    >
      {controlLabel}
    </Button>
    <Dialog
      open={open}
      onClose={closeDialog}
      TransitionComponent={ModalSlideTransition}
      fullWidth
      maxWidth="sm"
      aria-labelledby="voice-recorder-title"
    >
      <DialogTitle id="voice-recorder-title" sx={{ pr: 7 }}>
        Rekam perintah suara
        <IconButton aria-label="Tutup perekam suara" onClick={closeDialog} sx={{ position: 'absolute', top: 8, right: 8, minWidth: 44, minHeight: 44 }}><CloseOutlined /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {/* PawPOS AI Assistant Mascot Card */}
          <Box
            sx={{
              p: 2,
              bgcolor: '#FFF5ED',
              borderRadius: '12px',
              border: '1px solid #FFE3CC',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <MascotAvatar state={recorder.state} size={76} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
                <Typography sx={{ fontWeight: 850, fontSize: '0.96rem', color: '#2D2D2D' }}>
                  Paw<span style={{ color: '#FF8A3D' }}>POS</span> AI Assistant
                </Typography>
                <Chip
                  label={
                    recorder.state === 'listening'
                      ? 'MENDENGARKAN'
                      : recorder.state === 'uploading'
                      ? 'BERPIKIR...'
                      : recorder.state === 'success'
                      ? 'SELESAI'
                      : 'SIAP'
                  }
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    bgcolor: recorder.state === 'listening' ? '#FF8A3D' : '#FFE3CC',
                    color: recorder.state === 'listening' ? '#ffffff' : '#D95D10',
                    borderRadius: '4px',
                  }}
                />
              </Stack>
              <Typography
                variant="caption"
                sx={{ color: '#FF8A3D', fontWeight: 750, display: 'block', mb: 0.5, letterSpacing: '0.02em' }}
              >
                Your Smart AI Assistant for Pet Business
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                Gunakan mikrofon untuk mengisi teks dari ucapan. Audio hanya dikirim saat kamu menghentikan rekaman.
              </Typography>
            </Box>
          </Box>
          <StatusMessage state={recorder.state} error={recorder.error} />
          {recorder.transcription && <Box component="section" aria-labelledby="voice-transcription-title" sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography id="voice-transcription-title" variant="subtitle2" sx={{ mb: 0.75 }}>Hasil transkripsi</Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{recorder.transcription}</Typography>
          </Box>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1, flexWrap: 'wrap' }}>
        {recorder.state === 'requesting' && <Button variant="outlined" color="inherit" onClick={recorder.cancelRecording} startIcon={<CancelOutlined />} sx={{ minHeight: 44 }}>Batalkan</Button>}
        {recorder.state === 'listening' && <>
          <Button variant="contained" onClick={recorder.stopRecording} startIcon={<StopOutlined />} sx={{ minHeight: 44 }}>Selesai dan kirim</Button>
          <Button variant="outlined" color="inherit" onClick={recorder.cancelRecording} startIcon={<CancelOutlined />} sx={{ minHeight: 44 }}>Batalkan</Button>
        </>}
        {recorder.state === 'uploading' && <Button disabled sx={{ minHeight: 44 }}>Memproses...</Button>}
        {recorder.state === 'success' && speechSupported && <Button variant="outlined" onClick={toggleSpeaking} startIcon={speaking ? <VolumeOffOutlined /> : <VolumeUpOutlined />} sx={{ minHeight: 44 }}>{speaking ? 'Hentikan pembacaan' : 'Baca transkripsi'}</Button>}
        {(recorder.state === 'success' || recorder.state === 'error' || recorder.state === 'cancelled') && <Button variant="contained" onClick={() => { recorder.reset(); void recorder.startRecording() }} startIcon={<RecordVoiceOverOutlined />} sx={{ minHeight: 44 }}>Rekam lagi</Button>}
      </DialogActions>
    </Dialog>
  </>
}
