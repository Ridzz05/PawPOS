import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Alert,
} from '@mui/material'
import {
  ArrowBackOutlined,
  BackspaceOutlined,
  FlashOnOutlined,
  KeyOutlined,
  LockOutlined,
  MailOutline,
  PinOutlined,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material'
import { PawLogo } from '../../components/PawLogo'
import { DEMO_ACCOUNTS, isDemoLoginEnabled, useAuth } from './authContext'
import type { StaffRole } from './rbac'
import { ThemeToggle } from '../../components/ThemeToggle'
import { useThemeMode } from '../../themeContext'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, loginWithPin, loginAsDemo } = useAuth()
  const { isDark } = useThemeMode()

  // Tab mode: 'pin' (Terminal Kasir Cepat) vs 'credential' (Email & Sandi)
  const [loginTab, setLoginTab] = useState<'pin' | 'credential'>('pin')

  // PIN mode state
  const [selectedStaffRole, setSelectedStaffRole] = useState<StaffRole>('cashier')
  const [pinInput, setPinInput] = useState('')

  // Status & Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const demoEnabled = isDemoLoginEnabled()

  // Credential mode state (prefill demo hanya saat mode demo aktif)
  const [email, setEmail] = useState(demoEnabled ? 'owner@pawpos.id' : '')
  const [password, setPassword] = useState(demoEnabled ? 'pawpos123' : '')
  const [showPassword, setShowPassword] = useState(false)

  // Quick 1-Click Demo (hanya DEV / ?demo=1 untuk presentasi lead)
  const handleInstantDemoLogin = (role: StaffRole) => {
    if (!demoEnabled) {
      setErrorMsg('Mode demo dinonaktifkan di perangkat kasir produksi.')
      return
    }
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const res = loginAsDemo(role)
      navigate(res.initialRoute, { replace: true })
    } catch {
      setErrorMsg('Gagal melakukan login demo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Keypad Handlers
  const handleKeypadPress = (num: string) => {
    if (pinInput.length < 4) {
      const nextPin = pinInput + num
      setPinInput(nextPin)
      setErrorMsg(null)
      if (nextPin.length === 4) {
        // Auto-login on 4 digits
        executePinLogin(selectedStaffRole, nextPin)
      }
    }
  }

  const handleKeypadBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1))
    setErrorMsg(null)
  }

  const handleKeypadClear = () => {
    setPinInput('')
    setErrorMsg(null)
  }

  const executePinLogin = async (role: StaffRole, pin: string) => {
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await loginWithPin(role, pin)
      if (res.success && res.initialRoute) {
        navigate(res.initialRoute, { replace: true })
      } else {
        setErrorMsg(res.error || 'PIN kasir tidak sesuai.')
        setPinInput('')
        setIsSubmitting(false)
      }
    } catch {
      setErrorMsg('Gagal menghubungi server login.')
      setPinInput('')
      setIsSubmitting(false)
    }
  }

  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await login(email, password)
      if (res.success && res.initialRoute) {
        navigate(res.initialRoute, { replace: true })
      } else {
        setErrorMsg(res.error || 'Email atau password tidak sesuai.')
        setIsSubmitting(false)
      }
    } catch {
      setErrorMsg('Gagal menghubungi server login.')
      setIsSubmitting(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        py: { xs: 2.5, sm: 5 },
        px: { xs: 2, sm: 3 },
        position: 'relative',
      }}
    >
      {/* Top Controls: Theme Toggle */}
      <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggle />
      </Box>

      <Container maxWidth="sm">
        {/* Brand Header */}
        <Stack alignItems="center" spacing={1.5} sx={{ mb: 3, textAlign: 'center' }}>
          <PawLogo variant="vertical" size="large" />
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.025em',
              fontSize: { xs: '1.5rem', sm: '1.75rem' },
              mt: 0.5,
            }}
          >
            Terminal Masuk PawPOS
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 440 }}>
            Sistem Operasional Kasir & Retail Cerdas. Masuk menggunakan PIN kasir harian atau kredensial akun toko.
          </Typography>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 3.5 },
            borderRadius: '18px',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          {/* Login Mode Tabs */}
          <Tabs
            value={loginTab}
            onChange={(_, val) => {
              setLoginTab(val)
              setErrorMsg(null)
              setPinInput('')
            }}
            variant="fullWidth"
            sx={{
              mb: 3,
              minHeight: 40,
              bgcolor: isDark ? '#0E1626' : '#F1F5F9',
              p: 0.5,
              borderRadius: '10px',
              '& .MuiTabs-indicator': {
                display: 'none',
              },
            }}
          >
            <Tab
              value="pin"
              icon={<PinOutlined sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label="PIN Kasir Cepat"
              sx={{
                minHeight: 34,
                borderRadius: '8px',
                fontWeight: 750,
                fontSize: '0.82rem',
                textTransform: 'none',
                color: 'text.secondary',
                '&.Mui-selected': {
                  bgcolor: 'background.paper',
                  color: '#FF8A3D',
                  border: '1px solid',
                  borderColor: 'divider',
                },
              }}
            />
            <Tab
              value="credential"
              icon={<KeyOutlined sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label="Email & Password"
              sx={{
                minHeight: 34,
                borderRadius: '8px',
                fontWeight: 750,
                fontSize: '0.82rem',
                textTransform: 'none',
                color: 'text.secondary',
                '&.Mui-selected': {
                  bgcolor: 'background.paper',
                  color: '#FF8A3D',
                  border: '1px solid',
                  borderColor: 'divider',
                },
              }}
            />
          </Tabs>

          {/* Error Alert */}
          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px', fontSize: '0.82rem' }}>
              {errorMsg}
            </Alert>
          )}

          {/* TAB 1: PIN KASIR (Olsera Style Keypad) */}
          {loginTab === 'pin' && (
            <Box>
              {/* Cashier Selector Chips */}
              <Typography variant="caption" sx={{ fontWeight: 750, color: 'text.secondary', display: 'block', mb: 1 }}>
                PILIH OPERATOR KASIR:
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2.5, overflowX: 'auto', pb: 0.5 }}>
                {DEMO_ACCOUNTS.map((acc) => {
                  const isSelected = selectedStaffRole === acc.role
                  return (
                    <Paper
                      key={acc.role}
                      onClick={() => {
                        setSelectedStaffRole(acc.role)
                        setPinInput('')
                        setErrorMsg(null)
                      }}
                      sx={{
                        p: 1,
                        px: 1.5,
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        minWidth: 130,
                        border: '1px solid',
                        borderColor: isSelected ? '#FF8A3D' : 'divider',
                        bgcolor: isSelected ? (isDark ? '#2D1A10' : '#FFF9F5') : 'background.paper',
                        transition: 'all 120ms ease',
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 28,
                          height: 28,
                          fontSize: '0.85rem',
                          bgcolor: acc.badgeBg,
                          color: acc.badgeColor,
                        }}
                      >
                        {acc.avatar}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontSize: '0.78rem', fontWeight: 750 }} noWrap>
                          {acc.name.split(' ')[0]}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                          PIN: ••••
                        </Typography>
                      </Box>
                    </Paper>
                  )
                })}
              </Stack>

              {/* Masked PIN Dot Indicators */}
              <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mb: 2.5 }}>
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = pinInput.length > idx
                  return (
                    <Box
                      key={idx}
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        bgcolor: isFilled ? '#FF8A3D' : 'transparent',
                        border: '2px solid',
                        borderColor: isFilled ? '#FF8A3D' : 'text.disabled',
                        transition: 'all 120ms ease',
                      }}
                    />
                  )
                })}
              </Stack>

              {/* Olsera-Style Numeric Keypad */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 1.25,
                  maxWidth: 290,
                  mx: 'auto',
                  mb: 2,
                }}
              >
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <Button
                    key={digit}
                    variant="outlined"
                    onClick={() => handleKeypadPress(digit)}
                    sx={{
                      height: 52,
                      fontSize: '1.3rem',
                      fontWeight: 750,
                      borderRadius: '10px',
                      p: 0,
                    }}
                  >
                    {digit}
                  </Button>
                ))}
                <Button
                  variant="outlined"
                  onClick={handleKeypadClear}
                  sx={{
                    height: 52,
                    fontSize: '0.82rem',
                    fontWeight: 750,
                    borderRadius: '10px',
                    p: 0,
                    color: '#EF4444',
                  }}
                >
                  C
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleKeypadPress('0')}
                  sx={{
                    height: 52,
                    fontSize: '1.3rem',
                    fontWeight: 750,
                    borderRadius: '10px',
                    p: 0,
                  }}
                >
                  0
                </Button>
                <IconButton
                  onClick={handleKeypadBackspace}
                  sx={{
                    height: 52,
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <BackspaceOutlined sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>

              <Button
                variant="contained"
                fullWidth
                disabled={isSubmitting || pinInput.length === 0}
                onClick={() => executePinLogin(selectedStaffRole, pinInput)}
                sx={{
                  py: 1.2,
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.925rem',
                }}
              >
                {isSubmitting ? 'Memproses...' : 'Masuk Terminal POS'}
              </Button>
            </Box>
          )}

          {/* TAB 2: EMAIL & PASSWORD FORM */}
          {loginTab === 'credential' && (
            <Box component="form" onSubmit={handleCredentialSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Email Akun"
                  type="email"
                  fullWidth
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@pawpos.id"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MailOutline sx={{ color: 'text.secondary', fontSize: 19 }} />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  label="Kata Sandi (Password)"
                  type={showPassword ? 'text' : 'password'}
                  fullWidth
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined sx={{ color: 'text.secondary', fontSize: 19 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          aria-label="Tampilkan sandi"
                        >
                          {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={isSubmitting}
                  sx={{
                    py: 1.25,
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.925rem',
                  }}
                >
                  {isSubmitting ? 'Memverifikasi...' : 'Masuk ke Sistem'}
                </Button>
              </Stack>
            </Box>
          )}

          <Divider sx={{ my: 2.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 750, px: 1, letterSpacing: '0.04em' }}>
              {demoEnabled ? 'AKUN DEMO TRIAL (1-KLIK MASUK)' : 'AKSES OPERATOR TOKO'}
            </Typography>
          </Divider>

          {demoEnabled ? (
          /* Quick Demo Persona Grid (hanya mode presentasi) */
          <Stack spacing={1}>
            {DEMO_ACCOUNTS.map((acc) => (
              <Box
                key={acc.role}
                sx={{
                  p: 1.25,
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: isDark ? '#0E1626' : '#FAFAFA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'border-color 120ms ease',
                  '&:hover': {
                    borderColor: '#FF8A3D',
                  },
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, mr: 1 }}>
                  <Avatar sx={{ bgcolor: acc.badgeBg, color: acc.badgeColor, width: 32, height: 32, fontSize: '0.9rem' }}>
                    {acc.avatar}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography variant="subtitle2" sx={{ fontWeight: 750, fontSize: '0.82rem' }}>
                        {acc.name}
                      </Typography>
                      <Chip label={acc.role.toUpperCase()} size="small" sx={{ height: 16, fontSize: '0.58rem', fontWeight: 800 }} />
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }} noWrap>
                      {acc.email} • PIN: ••••
                    </Typography>
                  </Box>
                </Stack>

                <Button
                  id={`btn-demo-login-${acc.role}`}
                  size="small"
                  variant="outlined"
                  onClick={() => handleInstantDemoLogin(acc.role)}
                  startIcon={<FlashOnOutlined sx={{ fontSize: '0.9rem !important' }} />}
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 750,
                    py: 0.4,
                    px: 1,
                    borderRadius: '6px',
                    flexShrink: 0,
                  }}
                >
                  1-Klik
                </Button>
              </Box>
            ))}
          </Stack>
          ) : (
            <Alert severity="info" sx={{ borderRadius: '10px', fontSize: '0.8rem' }}>
              Mode kasir produksi aktif. Masuk dengan PIN operator atau email toko. Hubungi owner untuk kredensial.
            </Alert>
          )}
        </Paper>

        <Box sx={{ textAlign: 'center', mt: 2.5 }}>
          <Button
            variant="text"
            startIcon={<ArrowBackOutlined />}
            onClick={() => navigate('/landing')}
            sx={{
              color: 'text.secondary',
              fontWeight: 700,
              fontSize: '0.82rem',
              '&:hover': { color: 'text.primary', bgcolor: 'transparent' },
            }}
          >
            Kembali ke Landing Page
          </Button>
        </Box>
      </Container>
    </Box>
  )
}
