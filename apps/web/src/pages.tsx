import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { HelpOutline } from '@mui/icons-material'
import {
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import { PawLoading } from './components/PawLoading'

export function PageHeader({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', sm: 'flex-end' },
        gap: 2,
        mb: 2.5,
      }}
    >
      <Box>
        <Typography
          variant="overline"
          sx={{
            fontWeight: 800,
            letterSpacing: '0.09em',
            fontSize: '0.72rem',
            color: 'primary.main',
            display: 'block',
            mb: 0.25,
          }}
        >
          {eyebrow}
        </Typography>
        <Typography
          variant="h4"
          sx={{
            fontSize: { xs: '1.65rem', md: '2.15rem' },
            fontWeight: 850,
            letterSpacing: '-0.035em',
            color: 'text.primary',
            lineHeight: 1.18,
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="body1"
          sx={{ mt: 0.5, maxWidth: 640, fontSize: { xs: '0.88rem', md: '0.92rem' }, color: 'text.secondary', lineHeight: 1.5 }}
        >
          {body}
        </Typography>
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Box>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <Paper
      className="terminal-card"
      elevation={0}
      sx={{
        p: { xs: 3.5, md: 5 },
        textAlign: 'center',
        border: '1.5px dashed #cbd5e1',
        borderRadius: '12px',
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: '10px',
          bgcolor: '#f1f5f9',
          color: 'text.secondary',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
          mb: 2,
        }}
      >
        <HelpOutline sx={{ fontSize: 22 }} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.75, fontSize: '1.05rem' }}>
        {title}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ maxWidth: 480, mx: 'auto', mb: action ? 2.5 : 0, lineHeight: 1.6 }}
      >
        {body}
      </Typography>
      {action}
    </Paper>
  )
}

export function LoadingState({ label }: { label: string }) {
  return <PawLoading label={label} variant="card" />
}



export { DashboardPage } from './features/dashboard/DashboardPage'

export { ProductsPage } from './features/products/ProductsPage'
export { StocksPage } from './features/inventory/StocksPage'
export { PosPage } from './features/pos/PosPage'
export { ShiftsPage } from './features/shifts/ShiftsPage'

export function SettingsPage() {
  const [compact, setCompact] = useState(false)
  const [autoReceipt, setAutoReceipt] = useState(true)

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow="WORKSPACE"
        title="Pengaturan"
        body="Preferensi antarmuka lokal, format cetak struk kasir, dan konfigurasi terminal operasional."
      />

      <Paper
        elevation={0}
        className="terminal-card"
        sx={{
          p: { xs: 2, sm: 3 },
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '12px',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 750, color: 'text.primary', mb: 0.5, fontSize: '1.05rem' }}>
          Tampilan Antarmuka
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, fontSize: '0.84rem' }}>
          Sesuaikan kerapatan tata letak antarmuka kasir dan tabel data operasional.
        </Typography>

        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={1.5}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 650, color: 'text.primary' }}>
                Mode Tampilan Ringkas (Compact Density)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mt: 0.25 }}>
                Memperkecil padding tabel dan kartu produk untuk memuat lebih banyak item di layar kasir.
              </Typography>
            </Box>
            <Button
              variant={compact ? 'contained' : 'outlined'}
              onClick={() => setCompact((c) => !c)}
              aria-pressed={compact}
              sx={{
                borderRadius: '8px',
                flexShrink: 0,
                alignSelf: { xs: 'stretch', sm: 'auto' },
                whiteSpace: 'nowrap',
                py: { xs: 1, sm: '8px' },
              }}
            >
              {compact ? 'Mode ringkas aktif' : 'Aktifkan mode ringkas'}
            </Button>
          </Stack>

          <Divider sx={{ borderColor: 'divider' }} />

          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={2}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 650, color: 'text.primary' }}>
                Cetak Struk Otomatis Selesai Pembayaran
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mt: 0.25 }}>
                Langsung memunculkan dialog print thermal printer setelah transaksi berhasil diselesaikan.
              </Typography>
            </Box>
            <Switch
              checked={autoReceipt}
              onChange={(e) => setAutoReceipt(e.target.checked)}
              color="primary"
              sx={{ flexShrink: 0 }}
            />
          </Stack>
        </Stack>

        <Divider sx={{ my: 3, borderColor: 'divider' }} />

        <Typography variant="h6" sx={{ fontWeight: 750, color: 'text.primary', mb: 0.5, fontSize: '1.05rem' }}>
          Integrasi & Provider Pembayaran
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.84rem' }}>
          Belum ada kredensial atau konfigurasi provider pada Phase 0.
        </Typography>
      </Paper>
    </Stack>
  )
}

export function NotFoundPage() {
  return (
    <EmptyState
      title="Halaman tidak ditemukan"
      body="Gunakan navigasi untuk membuka area kerja yang tersedia."
      action={
        <Button component={RouterLink} to="/dashboard" variant="contained" sx={{ borderRadius: '8px', mt: 2 }}>
          Kembali ke Dashboard
        </Button>
      }
    />
  )
}

export { OrdersPage } from './features/orders/OrdersPage'
export { LandingPage } from './features/landing/LandingPage'
export { LoginPage } from './features/auth/LoginPage'


