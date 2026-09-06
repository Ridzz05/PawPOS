import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { LogoutOutlined, LockOutlined } from '@mui/icons-material'
import { useAuth } from '../features/auth/authContext'
import { ROLE_DEFINITIONS } from '../features/auth/rbac'

export function UserProfileCard({ fullWidth = false }: { fullWidth?: boolean } = {}) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!user) return null

  const meta = ROLE_DEFINITIONS[user.role] || ROLE_DEFINITIONS.owner

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          borderRadius: '14px',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          width: fullWidth ? '100%' : 'auto',
          transition: 'background-color 120ms ease, border-color 120ms ease',
          '&:hover': {
            borderColor: 'divider',
            bgcolor: 'action.hover',
          },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: meta.badgeBg,
                color: meta.badgeColor,
                fontWeight: 800,
                fontSize: '1rem',
                border: `1.5px solid ${meta.badgeColor}33`,
              }}
            >
              {user.avatar || user.name.charAt(0)}
            </Avatar>

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 750,
                    fontSize: '0.85rem',
                    color: 'text.primary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.name}
                </Typography>
              </Stack>

              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.25 }}>
                <Chip
                  label={meta.label}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.6rem',
                    fontWeight: 800,
                    bgcolor: meta.badgeBg,
                    color: meta.badgeColor,
                    borderRadius: '4px',
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.68rem',
                    color: 'text.secondary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.email.split('@')[0]}
                </Typography>
              </Stack>
            </Box>
          </Stack>

          <Tooltip title="Keluar / Ganti Akun" arrow>
            <IconButton
              size="small"
              onClick={() => setConfirmOpen(true)}
              aria-label="Keluar sesi"
              sx={{
                color: 'text.secondary',
                borderRadius: '8px',
                p: 0.75,
                '&:hover': {
                  color: 'error.main',
                  bgcolor: 'action.hover',
                },
              }}
            >
              <LogoutOutlined sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            p: 1,
            maxWidth: 400,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: 'text.primary', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockOutlined sx={{ color: '#FF8A3D' }} />
          Keluar dari Sesi {meta.title}?
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            Anda akan keluar dari akun <strong>{user.name}</strong> ({meta.label}). Untuk mengakses hak akses atau peran lain (seperti Kasir atau Owner), silakan login kembali di halaman masuk.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button
            onClick={() => setConfirmOpen(false)}
            variant="text"
            sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'none' }}
          >
            Batal
          </Button>
          <Button
            onClick={handleLogout}
            variant="contained"
            color="error"
            sx={{
              fontWeight: 750,
              textTransform: 'none',
              borderRadius: '8px',
              px: 2.5,
              bgcolor: '#DC2626',
              '&:hover': { bgcolor: '#B91C1C' },
            }}
          >
            Ya, Keluar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
