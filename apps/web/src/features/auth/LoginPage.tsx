import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  Alert,
} from '@mui/material'
import {
  LockOutlined,
  MailOutline,
  Visibility,
  VisibilityOff,
  ArrowForwardOutlined,
  ArrowBackOutlined,
  CheckCircleOutline,
  FlashOnOutlined,
} from '@mui/icons-material'
import { PawLogo } from '../../components/PawLogo'
import { DEMO_ACCOUNTS, useAuth } from './authContext'
import type { StaffRole } from './rbac'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, loginAsDemo } = useAuth()

  const [email, setEmail] = useState('owner@pawpos.id')
  const [password, setPassword] = useState('pawpos123')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedRole, setSelectedRole] = useState<StaffRole>('owner')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSelectDemo = (role: StaffRole) => {
    setSelectedRole(role)
    const acc = DEMO_ACCOUNTS.find((a) => a.role === role)
    if (acc) {
      setEmail(acc.email)
      setPassword(acc.password)
      setErrorMsg(null)
    }
  }

  const handleInstantLogin = (role: StaffRole) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMsg(null)
    const res = login(email, password)
    if (res.success && res.initialRoute) {
      navigate(res.initialRoute, { replace: true })
    } else {
      setErrorMsg(res.error || 'Email atau password tidak sesuai.')
      setIsSubmitting(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#F8FAFC',
        backgroundImage: 'radial-gradient(#E2E8F0 1.2px, transparent 1.2px)',
        backgroundSize: '24px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        py: { xs: 3, sm: 6 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Container maxWidth="sm">
        {/* Brand Header */}
        <Stack alignItems="center" spacing={1.5} sx={{ mb: 3.5, textAlign: 'center' }}>
          <PawLogo variant="vertical" size="large" />
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#0F172A',
              letterSpacing: '-0.02em',
              fontSize: { xs: '1.65rem', sm: '2rem' },
              mt: 1,
            }}
          >
            Masuk ke PawPOS
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', maxWidth: 460 }}>
            Platform Kasir & Copilot AI Cerdas untuk Pet Shop & Pet Clinic. Pilih akun demo uji coba di bawah atau masukkan kredensial peran Anda.
          </Typography>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 3.5 },
            borderRadius: '24px',
            border: '1px solid #E2E8F0',
            bgcolor: '#FFFFFF',
            boxShadow: '0 20px 40px -15px rgba(0,0,0,0.06)',
          }}
        >
          {/* Quick Demo Selector */}
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 750, color: '#1E293B', fontSize: '0.88rem' }}>
                Pilih Akun Demo Trial:
              </Typography>
              <Chip
                label="Trial Mode"
                size="small"
                color="primary"
                variant="outlined"
                sx={{ height: 22, fontSize: '0.65rem', fontWeight: 800 }}
              />
            </Stack>

            <Stack spacing={1.25}>
              {DEMO_ACCOUNTS.map((acc) => {
                const isSelected = selectedRole === acc.role
                return (
                  <Card
                    key={acc.role}
                    variant="outlined"
                    sx={{
                      borderRadius: '14px',
                      borderColor: isSelected ? '#FF8A3D' : '#E2E8F0',
                      bgcolor: isSelected ? '#FFF9F5' : '#FAFAFA',
                      boxShadow: isSelected ? '0 0 0 1px #FF8A3D' : 'none',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: '#FF8A3D',
                        bgcolor: '#FFF9F5',
                      },
                    }}
                  >
                    <Box
                      onClick={() => handleSelectDemo(acc.role)}
                      sx={{
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1, mr: 1 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: '10px',
                            bgcolor: acc.badgeBg,
                            color: acc.badgeColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.25rem',
                            flexShrink: 0,
                          }}
                        >
                          {acc.avatar}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 750, color: '#0F172A', fontSize: '0.88rem' }}>
                              {acc.name}
                            </Typography>
                            <Chip
                              label={acc.role.toUpperCase()}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.6rem',
                                fontWeight: 800,
                                bgcolor: acc.badgeBg,
                                color: acc.badgeColor,
                              }}
                            />
                          </Stack>
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#64748B',
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              fontSize: '0.72rem',
                            }}
                          >
                            {acc.email} • sandi: {acc.password}
                          </Typography>
                        </Box>
                      </Stack>

                      <Button
                        id={`btn-demo-login-${acc.role}`}
                        size="small"
                        variant={isSelected ? 'contained' : 'outlined'}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleInstantLogin(acc.role)
                        }}
                        startIcon={<FlashOnOutlined sx={{ fontSize: '1rem !important' }} />}
                        sx={{
                          fontSize: '0.72rem',
                          fontWeight: 750,
                          py: 0.5,
                          px: 1.25,
                          borderRadius: '8px',
                          textTransform: 'none',
                          flexShrink: 0,
                          bgcolor: isSelected ? '#FF8A3D' : 'transparent',
                          borderColor: isSelected ? '#FF8A3D' : '#CBD5E1',
                          color: isSelected ? '#FFFFFF' : '#475569',
                          '&:hover': {
                            bgcolor: isSelected ? '#E67328' : '#F1F5F9',
                            borderColor: '#FF8A3D',
                            color: isSelected ? '#FFFFFF' : '#FF8A3D',
                          },
                        }}
                      >
                        1-Klik Masuk
                      </Button>
                    </Box>
                  </Card>
                )
              })}
            </Stack>
          </Box>

          <Divider sx={{ my: 2.5 }}>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, px: 1 }}>
              ATAU MASUKKAN KREDENSIAL MANUAL
            </Typography>
          </Divider>

          {/* Form Credentials */}
          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: '10px' }}>
              {errorMsg}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Email / Username"
                type="email"
                fullWidth
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@pawpos.id"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MailOutline sx={{ color: '#94A3B8', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                  },
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
                      <LockOutlined sx={{ color: '#94A3B8', fontSize: 20 }} />
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                  },
                }}
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={isSubmitting}
                endIcon={<ArrowForwardOutlined />}
                sx={{
                  py: 1.4,
                  bgcolor: '#FF8A3D',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  borderRadius: '12px',
                  textTransform: 'none',
                  boxShadow: '0 4px 14px rgba(255, 138, 61, 0.35)',
                  '&:hover': {
                    bgcolor: '#E67328',
                  },
                }}
              >
                {isSubmitting ? 'Memproses Masuk...' : 'Masuk ke Sistem'}
              </Button>
            </Stack>
          </Box>

          <Box sx={{ mt: 3, p: 2, borderRadius: '12px', bgcolor: '#F1F5F9', border: '1px dashed #CBD5E1' }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <CheckCircleOutline sx={{ color: '#059669', fontSize: 18, mt: 0.2 }} />
              <Typography variant="caption" sx={{ color: '#475569', lineHeight: 1.5 }}>
                <strong>Role Isolation Enforced:</strong> Peran operator (Kasir, Gudang, Manajer, Owner) kini dipisahkan secara terisolasi. Pergantian peran langsung via sidebar telah dinonaktifkan demi integritas audit kasir. Untuk berganti peran, lakukan <em>Keluar / Logout</em> terlebih dahulu.
              </Typography>
            </Stack>
          </Box>
        </Paper>

        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Button
            variant="text"
            startIcon={<ArrowBackOutlined />}
            onClick={() => navigate('/landing')}
            sx={{
              color: '#64748B',
              fontWeight: 700,
              textTransform: 'none',
              fontSize: '0.85rem',
              '&:hover': { color: '#0F172A', bgcolor: 'transparent' },
            }}
          >
            Kembali ke Halaman Beranda (Landing Page)
          </Button>
        </Box>
      </Container>
    </Box>
  )
}
