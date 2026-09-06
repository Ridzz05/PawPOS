import { useEffect, useState, useTransition } from 'react'
import {
  AddOutlined,
  CheckCircleOutline,
  ErrorOutline,
  HistoryOutlined,
  LockOpenOutlined,
  LockOutlined,
  PointOfSaleOutlined,
  PrintOutlined,
  ReceiptLongOutlined,
  RefreshOutlined,
  SwapHorizOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { ModalSlideTransition } from '../../components/ModalSlideTransition'
import { PawLoading } from '../../components/PawLoading'
import { formatNominalInput, formatThousand, parseThousand } from '../../utils/currency'
import { getActiveTenant } from '../tenant/tenantApi'
import {
  closeShift,
  getCurrentShift,
  getShifts,
  openShift,
  type Shift,
} from './shiftsApi'

export function ShiftsPage() {
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [history, setHistory] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Modals state
  const [openShiftModal, setOpenShiftModal] = useState(false)
  const [closeShiftModal, setCloseShiftModal] = useState(false)
  const [zReportModal, setZReportModal] = useState(false)
  const [selectedZReportShift, setSelectedZReportShift] = useState<Shift | null>(null)

  // Open Shift Form
  const [cashierName, setCashierName] = useState('Kasir Utama')
  const [startingCashStr, setStartingCashStr] = useState('100.000')
  const [openNotes, setOpenNotes] = useState('')
  const [openingSubmitting, setOpeningSubmitting] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  // Close Shift & Cash Drawer Breakdown
  const [denominations, setDenominations] = useState<Record<number, number>>({
    100000: 0,
    50000: 0,
    20000: 0,
    10000: 0,
    5000: 0,
    2000: 0,
    1000: 0,
  })
  const [coinTotalStr, setCoinTotalStr] = useState('0')
  const [closeNotes, setCloseNotes] = useState('')
  const [closingSubmitting, setClosingSubmitting] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [useManualCashInput, setUseManualCashInput] = useState(false)
  const [manualCashStr, setManualCashStr] = useState('')

  const activeTenant = getActiveTenant()

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [cur, hist] = await Promise.all([getCurrentShift(), getShifts()])
      startTransition(() => {
        setCurrentShift(cur)
        setHistory(hist)
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data shift.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const handleShiftChange = () => loadData()
    const handleTenantChange = () => loadData()

    window.addEventListener('pawpos:shift_change', handleShiftChange)
    window.addEventListener('pawpos:tenant_change', handleTenantChange)
    return () => {
      window.removeEventListener('pawpos:shift_change', handleShiftChange)
      window.removeEventListener('pawpos:tenant_change', handleTenantChange)
    }
  }, [])

  // Calculate counted physical cash
  const paperMoneyTotal = Object.entries(denominations).reduce((acc, [denom, count]) => {
    return acc + Number(denom) * (Number(count) || 0)
  }, 0)
  const coinTotal = parseThousand(coinTotalStr)
  const computedCashTotal = paperMoneyTotal + coinTotal
  const actualCountedCash = useManualCashInput ? parseThousand(manualCashStr) : computedCashTotal

  // Live differences
  const startingCash = currentShift ? currentShift.starting_cash_idr : 0
  const cashSales = currentShift ? currentShift.total_cash_sales_idr : 0
  const expectedCashInDrawer = startingCash + cashSales
  const cashDifference = actualCountedCash - expectedCashInDrawer

  // Handlers
  const handleOpenShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cashierName.trim()) {
      setOpenError('Nama kasir wajib diisi.')
      return
    }
    const startingAmount = parseThousand(startingCashStr)
    if (startingAmount < 0) {
      setOpenError('Modal awal tidak boleh negatif.')
      return
    }

    try {
      setOpeningSubmitting(true)
      setOpenError(null)
      const newShift = await openShift({
        cashier_name: cashierName.trim(),
        starting_cash_idr: startingAmount,
        notes: openNotes.trim() || undefined,
      })
      setCurrentShift(newShift)
      setOpenShiftModal(false)
      setOpenNotes('')
      await loadData()
    } catch (err: unknown) {
      setOpenError(err instanceof Error ? err.message : 'Gagal membuka shift.')
    } finally {
      setOpeningSubmitting(false)
    }
  }

  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentShift) return

    try {
      setClosingSubmitting(true)
      setCloseError(null)
      const closed = await closeShift({
        id: currentShift.id,
        actual_cash_idr: actualCountedCash,
        notes: closeNotes.trim() || undefined,
      })
      setCurrentShift(null)
      setCloseShiftModal(false)
      setSelectedZReportShift(closed)
      setZReportModal(true)
      await loadData()
    } catch (err: unknown) {
      setCloseError(err instanceof Error ? err.message : 'Gagal menutup shift.')
    } finally {
      setClosingSubmitting(false)
    }
  }

  const handleQuickAddStartingCash = (nominal: number) => {
    const cur = parseThousand(startingCashStr)
    setStartingCashStr(formatThousand(cur + nominal))
  }

  const handleDenomChange = (denom: number, countStr: string) => {
    const val = parseInt(countStr.replace(/\D/g, ''), 10) || 0
    setDenominations((prev) => ({ ...prev, [denom]: val }))
  }

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return '-'
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  return (
    <Stack spacing={3}>
      {/* Page Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'flex-end' },
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{
              fontWeight: 750,
              letterSpacing: '0.08em',
              fontSize: '0.7rem',
              color: 'primary.main',
              display: 'block',
              mb: 0.25,
            }}
          >
            OPERASIONAL KASIR • {activeTenant.name}
          </Typography>
          <Typography
            variant="h4"
            sx={{
              fontSize: { xs: '1.6rem', md: '2.1rem' },
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'text.primary',
              lineHeight: 1.2,
            }}
          >
            Sesi & Shift Kasir
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mt: 0.5, maxWidth: 650, fontSize: { xs: '0.88rem', md: '0.92rem' } }}
          >
            Pencatatan kas laci, audit pergantian kasir, dan rekonsiliasi kas fisik dengan struk Z-Report harian.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
          <Button
            variant="outlined"
            onClick={loadData}
            disabled={loading}
            startIcon={<RefreshOutlined />}
            sx={{ borderRadius: '8px', fontWeight: 650 }}
          >
            Refresh
          </Button>

          {currentShift ? (
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                setUseManualCashInput(false)
                setManualCashStr('')
                setDenominations({
                  100000: 0,
                  50000: 0,
                  20000: 0,
                  10000: 0,
                  5000: 0,
                  2000: 0,
                  1000: 0,
                })
                setCoinTotalStr('0')
                setCloseNotes('')
                setCloseShiftModal(true)
              }}
              startIcon={<LockOutlined />}
              sx={{ borderRadius: '8px', fontWeight: 700 }}
            >
              Tutup Shift & Rekonsiliasi
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                setCashierName('Kasir Utama')
                setStartingCashStr('100.000')
                setOpenNotes('')
                setOpenShiftModal(true)
              }}
              startIcon={<LockOpenOutlined />}
              sx={{ borderRadius: '8px', fontWeight: 700 }}
            >
              Buka Shift Baru
            </Button>
          )}
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Active Shift Card or Inactive Callout */}
      {currentShift ? (
        <Paper
          elevation={0}
          className="terminal-card"
          sx={{
            p: { xs: 2, sm: 3 },
            border: '1px solid #10b981',
            borderRadius: '12px',
            bgcolor: 'background.paper',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              bgcolor: '#10b981',
            }}
          />

          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', md: 'center' }}
              spacing={2}
            >
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <span className="status-dot-active" />
                  <Chip
                    label="SHIFT BERLANGSUNG"
                    size="small"
                    sx={{
                      bgcolor: 'success.light',
                      color: 'success.main',
                      fontWeight: 800,
                      fontSize: '0.72rem',
                      height: 22,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    ID: {currentShift.id}
                  </Typography>
                </Stack>

                <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
                  Kasir: {currentShift.cashier_name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  Waktu Mulai: <strong>{formatDateTime(currentShift.opened_at)}</strong>
                  {currentShift.notes ? ` • Catatan: ${currentShift.notes}` : ''}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1.5} alignItems="center">
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setCloseShiftModal(true)}
                  startIcon={<LockOutlined />}
                  sx={{ borderRadius: '8px', fontWeight: 700 }}
                >
                  Tutup Shift
                </Button>
              </Stack>
            </Stack>

            <Divider sx={{ borderColor: '#f1f5f9' }} />

            {/* Shift Metrics Grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
                gap: 2,
              }}
            >
              <Box sx={{ p: 1.75, borderRadius: '10px', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: 'block', mb: 0.5, letterSpacing: '0.04em', fontSize: '0.72rem' }}>
                  MODAL AWAL KAS
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 850, color: 'text.primary', fontSize: '1.25rem', letterSpacing: '-0.025em' }} className="tnum">
                  Rp {formatThousand(currentShift.starting_cash_idr)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.74rem' }}>
                  Kas laci awal buka
                </Typography>
              </Box>

              <Box sx={{ p: 1.75, borderRadius: '10px', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: 'block', mb: 0.5, letterSpacing: '0.04em', fontSize: '0.72rem' }}>
                  PENJUALAN TUNAI (CASH)
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 850, color: 'success.main', fontSize: '1.25rem', letterSpacing: '-0.025em' }} className="tnum">
                  Rp {formatThousand(currentShift.total_cash_sales_idr)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.74rem' }}>
                  Masuk ke laci kasir
                </Typography>
              </Box>

              <Box sx={{ p: 1.75, borderRadius: '10px', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: 'block', mb: 0.5, letterSpacing: '0.04em', fontSize: '0.72rem' }}>
                  NON-TUNAI (QRIS/EDC)
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 850, color: 'info.main', fontSize: '1.25rem', letterSpacing: '-0.025em' }} className="tnum">
                  Rp {formatThousand(currentShift.total_non_cash_sales_idr)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.74rem' }}>
                  Transfer & Digital
                </Typography>
              </Box>

              <Box sx={{ p: 1.75, borderRadius: '10px', bgcolor: 'success.light', border: '1.5px solid', borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'success.main', display: 'block', mb: 0.5, letterSpacing: '0.04em', fontSize: '0.72rem' }}>
                  ESTIMASI KAS DI LACI
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 850, color: 'success.main', fontSize: '1.35rem', letterSpacing: '-0.03em' }} className="tnum">
                  Rp {formatThousand(expectedCashInDrawer)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600, fontSize: '0.74rem' }}>
                  Modal Awal + Tunai
                </Typography>
              </Box>

              <Box sx={{ p: 1.75, borderRadius: '10px', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: 'block', mb: 0.5, letterSpacing: '0.04em', fontSize: '0.72rem' }}>
                  TOTAL TRANSAKSI
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 850, color: 'text.primary', fontSize: '1.25rem', letterSpacing: '-0.025em' }} className="tnum">
                  {currentShift.transaction_count}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.74rem' }}>
                  Struk order tercatat
                </Typography>
              </Box>
            </Box>
          </Stack>
        </Paper>
      ) : (
        <Paper
          elevation={0}
          className="terminal-card"
          sx={{
            p: 3,
            border: '1px dashed #cbd5e1',
            borderRadius: '12px',
            bgcolor: 'background.paper',
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              bgcolor: 'action.hover',
              color: 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 1.5,
            }}
          >
            <LockOutlined sx={{ fontSize: 26 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 750, color: 'text.primary', mb: 0.5 }}>
            Tidak Ada Shift Kasir yang Sedang Aktif
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480, mx: 'auto', mb: 2 }}>
            Sesi kasir saat ini sedang tutup. Buka shift kasir dengan memasukkan modal awal di laci untuk memulai transaksi penjualan di terminal POS.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setOpenShiftModal(true)}
            startIcon={<LockOpenOutlined />}
            sx={{ borderRadius: '8px', fontWeight: 700 }}
          >
            Buka Shift Sekarang
          </Button>
        </Paper>
      )}

      {/* Shift History Section */}
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.75 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <HistoryOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
            <Typography variant="h6" sx={{ fontWeight: 750, color: 'text.primary', fontSize: '1.05rem' }}>
              Riwayat Shift Selesai
            </Typography>
          </Stack>
          <Chip label={`${history.length} sesi tercatat`} size="small" variant="outlined" sx={{ fontWeight: 650 }} />
        </Stack>

        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            borderRadius: '12px',
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <PawLoading label="Memuat riwayat shift..." variant="icon" sx={{ py: 3 }} />
          ) : history.length === 0 ? (
            <Box sx={{ p: 5, textAlign: 'center' }}>
              <ReceiptLongOutlined sx={{ fontSize: 40, color: '#94a3b8', mb: 1 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Belum ada riwayat shift selesai
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Shift yang telah ditutup dan direkonsiliasi akan otomatis tertera di sini bersama struk Z-Report audit.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="medium">
                <TableHead sx={{ bgcolor: 'background.default' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 750, color: 'text.secondary', fontSize: '0.75rem' }}>SESI & KASIR</TableCell>
                    <TableCell sx={{ fontWeight: 750, color: 'text.secondary', fontSize: '0.75rem' }}>WAKTU BUKA - TUTUP</TableCell>
                    <TableCell sx={{ fontWeight: 750, color: 'text.secondary', fontSize: '0.75rem' }} align="right">MODAL AWAL</TableCell>
                    <TableCell sx={{ fontWeight: 750, color: 'text.secondary', fontSize: '0.75rem' }} align="right">PENJUALAN TUNAI</TableCell>
                    <TableCell sx={{ fontWeight: 750, color: 'text.secondary', fontSize: '0.75rem' }} align="right">KAS FISIK DIHITUNG</TableCell>
                    <TableCell sx={{ fontWeight: 750, color: 'text.secondary', fontSize: '0.75rem' }} align="center">SELISIH KAS</TableCell>
                    <TableCell sx={{ fontWeight: 750, color: 'text.secondary', fontSize: '0.75rem' }} align="center">AKSI</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((s) => {
                    const isBalanced = s.cash_difference_idr === 0
                    const isSurplus = s.cash_difference_idr > 0
                    const isDeficit = s.cash_difference_idr < 0

                    return (
                      <TableRow key={s.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary' }}>
                            {s.cashier_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {s.id} • {s.status === 'open' ? 'Aktif' : 'Tutup'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ display: 'block', color: 'text.primary', fontWeight: 600 }}>
                            Buka: {formatDateTime(s.opened_at)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Tutup: {formatDateTime(s.closed_at)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 650, color: 'text.secondary', fontSize: '0.86rem' }} className="tnum">
                            Rp {formatThousand(s.starting_cash_idr)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 750, color: 'success.main', fontSize: '0.88rem' }} className="tnum">
                            Rp {formatThousand(s.total_cash_sales_idr)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                            {s.transaction_count} transaksi
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 850, color: 'text.primary', fontSize: '0.92rem' }} className="tnum">
                            Rp {formatThousand(s.actual_cash_idr)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {s.status === 'open' ? (
                            <Chip label="Aktif" size="small" color="success" sx={{ fontWeight: 700, fontSize: '0.72rem' }} />
                          ) : isBalanced ? (
                            <Chip
                              label="Pas (Rp 0)"
                              size="small"
                              sx={{
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                                color: (theme) => theme.palette.mode === 'dark' ? '#34d399' : '#065f46',
                                fontWeight: 750,
                                fontSize: '0.72rem',
                              }}
                            />
                          ) : isSurplus ? (
                            <Chip
                              label={`Lebih +Rp ${formatThousand(s.cash_difference_idr)}`}
                              size="small"
                              sx={{
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                                color: (theme) => theme.palette.mode === 'dark' ? '#60a5fa' : '#1d4ed8',
                                fontWeight: 750,
                                fontSize: '0.72rem',
                              }}
                            />
                          ) : (
                            <Chip
                              label={`Kurang -Rp ${formatThousand(Math.abs(s.cash_difference_idr))}`}
                              size="small"
                              sx={{
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
                                color: (theme) => theme.palette.mode === 'dark' ? '#f87171' : '#b91c1c',
                                fontWeight: 750,
                                fontSize: '0.72rem',
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ReceiptLongOutlined sx={{ fontSize: 16 }} />}
                            onClick={() => {
                              setSelectedZReportShift(s)
                              setZReportModal(true)
                            }}
                            sx={{ borderRadius: '6px', fontSize: '0.75rem', fontWeight: 650 }}
                          >
                            Z-Report
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* MODAL 1: BUKA SHIFT BARU */}
      <Dialog
        open={openShiftModal}
        onClose={() => !openingSubmitting && setOpenShiftModal(false)}
        TransitionComponent={ModalSlideTransition}
        maxWidth="xs"
        fullWidth
      >
        <form onSubmit={handleOpenShiftSubmit}>
          <DialogTitle sx={{ pb: 1, fontWeight: 800, fontSize: '1.2rem', color: 'text.primary' }}>
            Buka Shift Kasir Baru
          </DialogTitle>
          <DialogContent sx={{ pt: 1.5 }}>
            <Stack spacing={2.5}>
              <Typography variant="body2" color="text.secondary">
                Masukkan nama operator kasir bertugas dan modal awal uang kembalian di laci.
              </Typography>

              {openError && <Alert severity="error">{openError}</Alert>}

              <TextField
                label="Nama Kasir Bertugas"
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                fullWidth
                required
                size="small"
                disabled={openingSubmitting}
                placeholder="cth. Kasir Siti"
              />

              <Box>
                <TextField
                  label="Modal Awal Kas di Laci (Rp)"
                  value={startingCashStr}
                  onChange={(e) => setStartingCashStr(formatNominalInput(e.target.value))}
                  fullWidth
                  required
                  size="small"
                  disabled={openingSubmitting}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">Rp</InputAdornment>,
                  }}
                  helperText="Uang fisik awal untuk modal kembalian pelanggan"
                />

                {/* Quick Add Chips */}
                <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                  {[50000, 100000, 200000, 500000].map((amt) => (
                    <Chip
                      key={amt}
                      label={`+${formatThousand(amt)}`}
                      size="small"
                      onClick={() => handleQuickAddStartingCash(amt)}
                      sx={{ fontWeight: 650, fontSize: '0.72rem', cursor: 'pointer' }}
                    />
                  ))}
                  <Chip
                    label="Reset 0"
                    size="small"
                    variant="outlined"
                    onClick={() => setStartingCashStr('0')}
                    sx={{ fontWeight: 650, fontSize: '0.72rem', cursor: 'pointer' }}
                  />
                </Stack>
              </Box>

              <TextField
                label="Catatan Shift (Opsional)"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                fullWidth
                multiline
                rows={2}
                size="small"
                disabled={openingSubmitting}
                placeholder="cth. Kasir shift pagi laci 1"
              />
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              onClick={() => setOpenShiftModal(false)}
              disabled={openingSubmitting}
              sx={{ fontWeight: 650, color: 'text.secondary' }}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={openingSubmitting}
              sx={{ fontWeight: 700, borderRadius: '8px' }}
            >
              {openingSubmitting ? <CircularProgress size={20} /> : 'Mulai Sesi Shift'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* MODAL 2: TUTUP SHIFT & REKONSILIASI KAS */}
      <Dialog
        open={closeShiftModal}
        onClose={() => !closingSubmitting && setCloseShiftModal(false)}
        TransitionComponent={ModalSlideTransition}
        maxWidth="md"
        fullWidth
      >
        <form onSubmit={handleCloseShiftSubmit}>
          <DialogTitle sx={{ pb: 1, fontWeight: 800, fontSize: '1.25rem', color: 'text.primary' }}>
            Tutup Shift & Rekonsiliasi Kas Fisik
          </DialogTitle>
          <DialogContent sx={{ pt: 1.5 }}>
            <Stack spacing={3}>
              <Typography variant="body2" color="text.secondary">
                Hitung uang kas fisik yang ada di dalam laci kasir untuk mencocokkan dengan pencatatan sistem POS.
              </Typography>

              {closeError && <Alert severity="error">{closeError}</Alert>}

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.35fr 1fr' }, gap: 3 }}>
                {/* Left Column: Physical Cash Counter */}
                <Box>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: '10px',
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.default',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 750, color: 'text.primary' }}>
                        Kalkulator Pecahan Uang Fisik
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => setUseManualCashInput(!useManualCashInput)}
                        sx={{ fontSize: '0.75rem', fontWeight: 650 }}
                      >
                        {useManualCashInput ? 'Gunakan Hitung Pecahan' : 'Input Manual Total'}
                      </Button>
                    </Stack>

                    {!useManualCashInput ? (
                      <Stack spacing={1.25}>
                        {[100000, 50000, 20000, 10000, 5000, 2000, 1000].map((denom) => {
                          const count = denominations[denom] || 0
                          const subtotal = denom * count

                          return (
                            <Stack
                              key={denom}
                              direction="row"
                              spacing={1.5}
                              alignItems="center"
                              justifyContent="space-between"
                            >
                              <Typography variant="body2" sx={{ fontWeight: 700, width: 90, color: 'text.secondary' }}>
                                Rp {formatThousand(denom)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                x
                              </Typography>
                              <TextField
                                size="small"
                                type="number"
                                value={count === 0 ? '' : count}
                                onChange={(e) => handleDenomChange(denom, e.target.value)}
                                placeholder="0"
                                inputProps={{ min: 0, style: { textAlign: 'center', padding: '4px 8px' } }}
                                sx={{ width: 75 }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                =
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 700, width: 110, textAlign: 'right', color: 'text.primary' }}
                              >
                                Rp {formatThousand(subtotal)}
                              </Typography>
                            </Stack>
                          )
                        })}

                        <Divider sx={{ my: 0.5 }} />

                        {/* Coins */}
                        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                          <Typography variant="body2" sx={{ fontWeight: 700, width: 90, color: 'text.secondary' }}>
                            Koin / Logam
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            (Total)
                          </Typography>
                          <TextField
                            size="small"
                            value={coinTotalStr}
                            onChange={(e) => setCoinTotalStr(formatNominalInput(e.target.value))}
                            placeholder="0"
                            inputProps={{ style: { textAlign: 'right', padding: '4px 8px' } }}
                            sx={{ width: 140 }}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">Rp</InputAdornment>,
                            }}
                          />
                        </Stack>
                      </Stack>
                    ) : (
                      <Box sx={{ py: 2 }}>
                        <TextField
                          label="Total Kas Fisik Dihitung (Rp)"
                          value={manualCashStr}
                          onChange={(e) => setManualCashStr(formatNominalInput(e.target.value))}
                          fullWidth
                          size="small"
                          InputProps={{
                            startAdornment: <InputAdornment position="start">Rp</InputAdornment>,
                          }}
                          helperText="Masukkan total uang tunai yang ada di dalam laci kasir"
                        />
                      </Box>
                    )}

                    <Divider sx={{ my: 1.5 }} />

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary' }}>
                        TOTAL KAS FISIK DIHITUNG:
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 850, color: 'success.main' }}>
                        Rp {formatThousand(actualCountedCash)}
                      </Typography>
                    </Stack>
                  </Box>
                </Box>

                {/* Right Column: Comparison & Difference Calculation */}
                <Box>
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 750, color: 'text.secondary', mb: 1.5 }}>
                        Perhitungan Sistem POS
                      </Typography>

                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Modal Awal Laci:
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            Rp {formatThousand(startingCash)}
                          </Typography>
                        </Stack>

                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Penjualan Tunai:
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                            + Rp {formatThousand(cashSales)}
                          </Typography>
                        </Stack>

                        <Divider sx={{ my: 0.5 }} />

                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>
                            Estimasi Kas Sistem:
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>
                            Rp {formatThousand(expectedCashInDrawer)}
                          </Typography>
                        </Stack>

                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" sx={{ fontWeight: 800, color: 'success.main' }}>
                            Kas Fisik Dihitung:
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: 'success.main' }}>
                            Rp {formatThousand(actualCountedCash)}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>

                    {/* Status Selisih Banner */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor:
                          cashDifference === 0
                            ? '#10b981'
                            : cashDifference > 0
                            ? '#3b82f6'
                            : '#ef4444',
                        bgcolor:
                          cashDifference === 0
                            ? 'success.light'
                            : cashDifference > 0
                            ? 'info.light'
                            : 'error.light',
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        {cashDifference === 0 ? (
                          <CheckCircleOutline sx={{ color: '#10b981' }} />
                        ) : cashDifference > 0 ? (
                          <CheckCircleOutline sx={{ color: '#3b82f6' }} />
                        ) : (
                          <WarningAmberOutlined sx={{ color: '#ef4444' }} />
                        )}

                        <Box>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 800,
                              color:
                                cashDifference === 0
                                  ? 'success.main'
                                  : cashDifference > 0
                                  ? 'info.main'
                                  : 'error.main',
                            }}
                          >
                            {cashDifference === 0
                              ? 'KAS COCOK & SEIMBANG'
                              : cashDifference > 0
                              ? 'KAS LEBIH (SURPLUS)'
                              : 'KAS KURANG (DEFISIT)'}
                          </Typography>
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: 850,
                              color:
                                cashDifference === 0
                                  ? 'success.main'
                                  : cashDifference > 0
                                  ? 'info.main'
                                  : 'error.main',
                            }}
                          >
                            {cashDifference === 0
                              ? 'Rp 0'
                              : `${cashDifference > 0 ? '+' : '-'}Rp ${formatThousand(
                                  Math.abs(cashDifference)
                                )}`}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>

                    <TextField
                      label="Catatan Serah Terima Kasir"
                      value={closeNotes}
                      onChange={(e) => setCloseNotes(e.target.value)}
                      fullWidth
                      multiline
                      rows={2}
                      size="small"
                      placeholder="cth. Kas fisik sesuai, diserahkan ke shift sore"
                    />
                  </Stack>
                </Box>
              </Box>
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              onClick={() => setCloseShiftModal(false)}
              disabled={closingSubmitting}
              sx={{ fontWeight: 650, color: 'text.secondary' }}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="error"
              disabled={closingSubmitting}
              startIcon={<LockOutlined />}
              sx={{ fontWeight: 700, borderRadius: '8px' }}
            >
              {closingSubmitting ? <CircularProgress size={20} /> : 'Tutup Shift & Cetak Z-Report'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* MODAL 3: STRUK Z-REPORT PREVIEW */}
      <Dialog
        open={zReportModal}
        onClose={() => setZReportModal(false)}
        TransitionComponent={ModalSlideTransition}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 800, fontSize: '1.15rem', color: 'text.primary' }}>
          Struk Z-Report Shift Kasir
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {selectedZReportShift && (
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                bgcolor: 'background.default',
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: '8px',
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '0.82rem',
                lineHeight: 1.5,
              }}
            >
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.05em' }}>
                  {activeTenant.name.toUpperCase()}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                  LAPORAN Z-REPORT PENUTUPAN SHIFT
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                  ID: {selectedZReportShift.id}
                </Typography>
              </Box>

              <Divider sx={{ borderStyle: 'dashed', my: 1.5 }} />

              <Stack spacing={0.5}>
                <Stack direction="row" justifyContent="space-between">
                  <span>Kasir:</span>
                  <strong>{selectedZReportShift.cashier_name}</strong>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <span>Waktu Buka:</span>
                  <span>{formatDateTime(selectedZReportShift.opened_at)}</span>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <span>Waktu Tutup:</span>
                  <span>{formatDateTime(selectedZReportShift.closed_at)}</span>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <span>Total Order:</span>
                  <span>{selectedZReportShift.transaction_count} transaksi</span>
                </Stack>
              </Stack>

              <Divider sx={{ borderStyle: 'dashed', my: 1.5 }} />

              <Stack spacing={0.5}>
                <Stack direction="row" justifyContent="space-between">
                  <span>Modal Awal Kas:</span>
                  <span>Rp {formatThousand(selectedZReportShift.starting_cash_idr)}</span>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <span>Penjualan Tunai:</span>
                  <span>Rp {formatThousand(selectedZReportShift.total_cash_sales_idr)}</span>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <span>Penjualan QRIS/Non-Tunai:</span>
                  <span>Rp {formatThousand(selectedZReportShift.total_non_cash_sales_idr)}</span>
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ fontWeight: 700, mt: 0.5 }}>
                  <span>Total Omset Shift:</span>
                  <span>
                    Rp{' '}
                    {formatThousand(
                      selectedZReportShift.total_cash_sales_idr +
                        selectedZReportShift.total_non_cash_sales_idr
                    )}
                  </span>
                </Stack>
              </Stack>

              <Divider sx={{ borderStyle: 'dashed', my: 1.5 }} />

              <Stack spacing={0.5}>
                <Stack direction="row" justifyContent="space-between">
                  <span>Kas Sistem (Expected):</span>
                  <span>Rp {formatThousand(selectedZReportShift.expected_cash_idr)}</span>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <span>Kas Fisik Dihitung:</span>
                  <span>Rp {formatThousand(selectedZReportShift.actual_cash_idr)}</span>
                </Stack>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{
                    fontWeight: 800,
                    color:
                      selectedZReportShift.cash_difference_idr === 0
                        ? 'success.main'
                        : selectedZReportShift.cash_difference_idr > 0
                        ? 'info.main'
                        : 'error.main',
                  }}
                >
                  <span>Selisih Kas:</span>
                  <span>
                    {selectedZReportShift.cash_difference_idr === 0
                      ? 'Rp 0 (PAS)'
                      : `${selectedZReportShift.cash_difference_idr > 0 ? '+' : '-'}Rp ${formatThousand(
                          Math.abs(selectedZReportShift.cash_difference_idr)
                        )}`}
                  </span>
                </Stack>
              </Stack>

              {selectedZReportShift.notes && (
                <>
                  <Divider sx={{ borderStyle: 'dashed', my: 1.5 }} />
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                    Catatan: {selectedZReportShift.notes}
                  </Typography>
                </>
              )}

              <Box sx={{ mt: 3, pt: 2, borderTop: '1px dashed', borderColor: 'divider', textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 3 }}>
                  Tanda Tangan Kasir Bertugas
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  ( {selectedZReportShift.cashier_name} )
                </Typography>
              </Box>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={() => setZReportModal(false)} sx={{ fontWeight: 650, color: 'text.secondary' }}>
            Tutup
          </Button>
          <Button
            variant="contained"
            onClick={() => window.print()}
            startIcon={<PrintOutlined />}
            sx={{ fontWeight: 700, borderRadius: '8px' }}
          >
            Cetak Z-Report
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
