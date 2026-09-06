import React, { useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Paper,
  Stack,
  Typography,
  Alert,
} from '@mui/material'
import {
  BackspaceOutlined,
  LockOutlined,
  LogoutOutlined,
} from '@mui/icons-material'
import { useAuth } from '../features/auth/authContext'
import { ROLE_DEFINITIONS } from '../features/auth/rbac'

export function CashierLockModal() {
  const { user, isScreenLocked, unlockScreen, logout } = useAuth()
  const [pin, setPin] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isScreenLocked || !user) return null

  const roleMeta = ROLE_DEFINITIONS[user.role] || ROLE_DEFINITIONS.owner

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      const nextPin = pin + num
      setPin(nextPin)
      setErrorMsg(null)
      if (nextPin.length === 4) {
        // Auto-attempt unlock on 4 digits
        const res = unlockScreen(nextPin)
        if (!res.success) {
          setErrorMsg(res.error || 'PIN kasir tidak sesuai.')
        } else {
          setPin('')
        }
      }
    }
  }

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1))
    setErrorMsg(null)
  }

  const handleClear = () => {
    setPin('')
    setErrorMsg(null)
  }

  const handleUnlock = () => {
    if (!pin) {
      setErrorMsg('Masukkan PIN kasir Anda.')
      return
    }
    const res = unlockScreen(pin)
    if (!res.success) {
      setErrorMsg(res.error || 'PIN kasir tidak sesuai.')
      setPin('')
    } else {
      setPin('')
    }
  }

  return (
    <Dialog
      open={isScreenLocked}
      fullScreen={false}
      disableEscapeKeyDown
      onClose={() => undefined}
      PaperProps={{
        sx: {
          borderRadius: '20px',
          maxWidth: 380,
          width: '100%',
          p: 1.5,
          textAlign: 'center',
          boxShadow: 'none',
          border: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      <DialogContent sx={{ p: 2.5, pt: 3 }}>
        {/* Cashier Badge */}
        <Stack alignItems="center" spacing={1.25} sx={{ mb: 2.5 }}>
          <Box sx={{ position: 'relative' }}>
            <Avatar
              sx={{
                width: 60,
                height: 60,
                bgcolor: roleMeta.badgeBg,
                color: roleMeta.badgeColor,
                fontSize: '1.75rem',
                border: `2px solid ${roleMeta.badgeColor}40`,
              }}
            >
              {user.avatar || user.name.charAt(0)}
            </Avatar>
            <Box
              sx={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                bgcolor: '#FF8A3D',
                color: '#ffffff',
                borderRadius: '50%',
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LockOutlined sx={{ fontSize: 13 }} />
            </Box>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
              {user.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 650 }}>
              Terminal Terkunci • {roleMeta.title}
            </Typography>
          </Box>
        </Stack>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', py: 0.25, fontSize: '0.8rem' }}>
            {errorMsg}
          </Alert>
        )}

        {/* Masked PIN Indicators */}
        <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mb: 3 }}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx
            return (
              <Box
                key={idx}
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  bgcolor: isFilled ? '#FF8A3D' : 'transparent',
                  border: '2px solid',
                  borderColor: isFilled ? '#FF8A3D' : '#CBD5E1',
                  transition: 'all 120ms ease',
                }}
              />
            )
          })}
        </Stack>

        {/* Numeric Keypad */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1.25,
            maxWidth: 280,
            mx: 'auto',
            mb: 2.5,
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <Button
              key={digit}
              variant="outlined"
              onClick={() => handleKeyPress(digit)}
              sx={{
                height: 56,
                fontSize: '1.35rem',
                fontWeight: 750,
                borderRadius: '12px',
                p: 0,
              }}
            >
              {digit}
            </Button>
          ))}
          <Button
            variant="outlined"
            color="inherit"
            onClick={handleClear}
            sx={{
              height: 56,
              fontSize: '0.85rem',
              fontWeight: 750,
              borderRadius: '12px',
              p: 0,
              color: '#EF4444',
            }}
          >
            C
          </Button>
          <Button
            variant="outlined"
            onClick={() => handleKeyPress('0')}
            sx={{
              height: 56,
              fontSize: '1.35rem',
              fontWeight: 750,
              borderRadius: '12px',
              p: 0,
            }}
          >
            0
          </Button>
          <IconButton
            onClick={handleBackspace}
            sx={{
              height: 56,
              borderRadius: '12px',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <BackspaceOutlined sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Actions */}
        <Stack spacing={1} sx={{ maxWidth: 280, mx: 'auto' }}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleUnlock}
            sx={{
              py: 1.2,
              fontWeight: 800,
              fontSize: '0.925rem',
              borderRadius: '10px',
            }}
          >
            Buka Terminal
          </Button>

          <Button
            variant="text"
            size="small"
            onClick={logout}
            startIcon={<LogoutOutlined sx={{ fontSize: 16 }} />}
            sx={{
              color: 'text.secondary',
              fontWeight: 650,
              fontSize: '0.8rem',
              '&:hover': { color: '#EF4444' },
            }}
          >
            Keluar Sesi / Ganti Kasir
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
