import { useEffect, useMemo, useState } from 'react'
import {
  CalendarTodayOutlined,
  CallSplitOutlined,
  CloseOutlined,
  FilterListOutlined,
  LocalAtmOutlined,
  PointOfSaleOutlined,
  PrintOutlined,
  QrCode2Outlined,
  ReceiptLongOutlined,
  RefreshOutlined,
  SearchOutlined,
  StorefrontOutlined,
  TrendingUpOutlined,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
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
import { formatCurrency, formatThousand } from '../../utils/currency'
import { getOrders, getOrderById, type Order, type OrderDetail } from '../pos/ordersApi'

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMethod, setSelectedMethod] = useState<'all' | 'cash' | 'qris' | 'debit_card' | 'split'>('all')
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days'>('all')

  // Detail & Receipt Modal
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const loadData = () => {
    setLoading(true)
    setError(null)
    getOrders()
      .then((data) => {
        setOrders(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Gagal memuat riwayat transaksi.')
        setLoading(false)
      })
  }

  useEffect(() => {
    loadData()
    const handleTenant = () => loadData()
    window.addEventListener('pawpos:tenant_change', handleTenant)
    return () => window.removeEventListener('pawpos:tenant_change', handleTenant)
  }, [])

  const handleOpenDetail = async (order: Order) => {
    setDetailError(null)
    setLoadingDetail(true)
    setModalOpen(true)
    try {
      const detail = await getOrderById(order.id)
      setSelectedOrder(detail)
    } catch {
      // Fallback: create mock detail from order
      setSelectedOrder({
        ...order,
        items: [],
      })
      setDetailError('Gagal memuat rincian item, menampilkan informasi ringkasan.')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handlePrintReceipt = () => {
    window.print()
  }

  // Filtered orders
  const filteredOrders = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    return orders.filter((o) => {
      // Search query filter (Order number or notes)
      const q = searchQuery.trim().toLowerCase()
      if (q) {
        const matchesNumber = o.order_number.toLowerCase().includes(q)
        const matchesNotes = (o.notes || '').toLowerCase().includes(q)
        if (!matchesNumber && !matchesNotes) return false
      }

      // Payment method filter
      if (selectedMethod !== 'all' && o.payment_method !== selectedMethod) {
        return false
      }

      // Date range filter
      if (dateRange === 'today') {
        return o.created_at.startsWith(todayStr)
      } else if (dateRange === '7days') {
        const orderDate = new Date(o.created_at)
        const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24)
        return diffDays <= 7
      }

      return true
    })
  }, [orders, searchQuery, selectedMethod, dateRange])

  // Financial summary metrics
  const metrics = useMemo(() => {
    const totalCount = filteredOrders.length
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total_idr, 0)
    const averageOrderValue = totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0
    const cashTotal = filteredOrders.reduce(
      (sum, o) =>
        sum +
        (o.payment_method === 'cash'
          ? o.total_idr
          : o.payment_method === 'split'
            ? (o.cash_amount_idr ?? 0)
            : 0),
      0,
    )
    const nonCashTotal = totalRevenue - cashTotal

    return {
      totalCount,
      totalRevenue,
      averageOrderValue,
      cashTotal,
      nonCashTotal,
    }
  }, [filteredOrders])

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  const getPaymentMethodChip = (method: string) => {
    switch (method) {
      case 'cash':
        return (
          <Chip
            icon={<LocalAtmOutlined sx={{ fontSize: 15 }} />}
            label="Tunai (Cash)"
            size="small"
            sx={{ bgcolor: '#ecfdf5', color: '#047857', fontWeight: 700, fontSize: '0.74rem' }}
          />
        )
      case 'qris':
        return (
          <Chip
            icon={<QrCode2Outlined sx={{ fontSize: 15 }} />}
            label="QRIS"
            size="small"
            sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '0.74rem' }}
          />
        )
      case 'debit_card':
        return (
          <Chip
            icon={<PointOfSaleOutlined sx={{ fontSize: 15 }} />}
            label="Kartu Debit"
            size="small"
            sx={{ bgcolor: '#faf5ff', color: '#7e22ce', fontWeight: 700, fontSize: '0.74rem' }}
          />
        )
      case 'split':
        return (
          <Chip
            icon={<CallSplitOutlined sx={{ fontSize: 15 }} />}
            label="Split (Campuran)"
            size="small"
            sx={{ bgcolor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontWeight: 750, fontSize: '0.74rem' }}
          />
        )
      default:
        return <Chip label={method} size="small" variant="outlined" sx={{ fontWeight: 650, fontSize: '0.74rem' }} />
    }
  }

  return (
    <Stack spacing={2.5}>
      {/* Page Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-end' }}
        spacing={2}
      >
        <Box>
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 800, letterSpacing: '0.08em' }}>
            AUDIT PENJUALAN KASIR
          </Typography>
          <Typography
            variant="h4"
            sx={{
              fontSize: { xs: '1.6rem', md: '2.1rem' },
              fontWeight: 850,
              letterSpacing: '-0.035em',
              color: 'text.primary',
              lineHeight: 1.2,
            }}
          >
            Riwayat Transaksi
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.9rem' }}>
            Audit seluruh struk penjualan register kasir, rincian pembayaran, dan cetak ulang struk digital.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            onClick={loadData}
            disabled={loading}
            startIcon={<RefreshOutlined />}
            sx={{ borderRadius: '10px', fontWeight: 700, height: 42, px: 2 }}
          >
            Refresh Data
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: '10px' }}>
          {error}
        </Alert>
      )}

      {/* Metrics Bar - High-Contrast Hierarchy */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        <Box className="terminal-card" sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                TOTAL PENJUALAN
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 850, color: '#ea580c', mt: 0.25, fontSize: '1.35rem', letterSpacing: '-0.025em' }} className="tnum">
                {formatCurrency(metrics.totalRevenue)}
              </Typography>
            </Box>
            <TrendingUpOutlined sx={{ color: '#ea580c', fontSize: 22 }} />
          </Stack>
        </Box>

        <Box className="terminal-card" sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                TOTAL STRUK TRANSAKSI
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 850, color: 'text.primary', mt: 0.25, fontSize: '1.35rem', letterSpacing: '-0.025em' }} className="tnum">
                {metrics.totalCount} Order
              </Typography>
            </Box>
            <ReceiptLongOutlined sx={{ color: '#ff7a30', fontSize: 22 }} />
          </Stack>
        </Box>

        <Box className="terminal-card" sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                RATA-RATA ORDER (AOV)
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 850, color: 'text.primary', mt: 0.25, fontSize: '1.35rem', letterSpacing: '-0.025em' }} className="tnum">
                {formatCurrency(metrics.averageOrderValue)}
              </Typography>
            </Box>
            <StorefrontOutlined sx={{ color: '#0284c7', fontSize: 22 }} />
          </Stack>
        </Box>

        <Box className="terminal-card" sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                TUNAI VS NON-TUNAI
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 850, color: 'success.main', mt: 0.25, fontSize: '1.1rem', letterSpacing: '-0.02em' }} className="tnum">
                Rp {formatThousand(metrics.cashTotal)} / {formatThousand(metrics.nonCashTotal)}
              </Typography>
            </Box>
            <LocalAtmOutlined sx={{ color: '#10b981', fontSize: 22 }} />
          </Stack>
        </Box>
      </Box>

      {/* Main Table Card with Integrated Search & Filter Inset Toolbar */}
      <Paper
        elevation={0}
        className="terminal-card"
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {/* Filter Toolbar */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'background.default',
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Search Box */}
          <TextField
            size="small"
            placeholder="Cari nomor pesanan (ORD-...) atau catatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 300 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined fontSize="small" sx={{ color: '#94a3b8' }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* Filter Chips: Payment Method */}
          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mr: 1 }}>
              <FilterListOutlined sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.74rem' }}>
                METODE:
              </Typography>
            </Stack>

            <Chip
              label="Semua"
              size="small"
              onClick={() => setSelectedMethod('all')}
              color={selectedMethod === 'all' ? 'primary' : 'default'}
              variant={selectedMethod === 'all' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, cursor: 'pointer', height: { xs: 36, sm: 24 } }}
            />
            <Chip
              label="Tunai"
              size="small"
              onClick={() => setSelectedMethod('cash')}
              color={selectedMethod === 'cash' ? 'primary' : 'default'}
              variant={selectedMethod === 'cash' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, cursor: 'pointer', height: { xs: 36, sm: 24 } }}
            />
            <Chip
              label="QRIS"
              size="small"
              onClick={() => setSelectedMethod('qris')}
              color={selectedMethod === 'qris' ? 'primary' : 'default'}
              variant={selectedMethod === 'qris' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, cursor: 'pointer', height: { xs: 36, sm: 24 } }}
            />
            <Chip
              label="Debit"
              size="small"
              onClick={() => setSelectedMethod('debit_card')}
              color={selectedMethod === 'debit_card' ? 'primary' : 'default'}
              variant={selectedMethod === 'debit_card' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, cursor: 'pointer', height: { xs: 36, sm: 24 } }}
            />
            <Chip
              label="Split"
              size="small"
              onClick={() => setSelectedMethod('split')}
              color={selectedMethod === 'split' ? 'primary' : 'default'}
              variant={selectedMethod === 'split' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, cursor: 'pointer', height: { xs: 36, sm: 24 } }}
            />
          </Stack>

          {/* Filter Chips: Date Range */}
          <Stack direction="row" spacing={0.75} alignItems="center">
            <CalendarTodayOutlined sx={{ fontSize: 15, color: 'text.secondary' }} />
            <Chip
              label="Semua Waktu"
              size="small"
              onClick={() => setDateRange('all')}
              variant={dateRange === 'all' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 650, cursor: 'pointer', height: { xs: 36, sm: 24 } }}
            />
            <Chip
              label="Hari Ini"
              size="small"
              onClick={() => setDateRange('today')}
              variant={dateRange === 'today' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 650, cursor: 'pointer', height: { xs: 36, sm: 24 } }}
            />
            <Chip
              label="7 Hari"
              size="small"
              onClick={() => setDateRange('7days')}
              variant={dateRange === '7days' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 650, cursor: 'pointer', height: { xs: 36, sm: 24 } }}
            />
          </Stack>
        </Box>

        {/* Loading State */}
        {loading && (
          <PawLoading label="Memuat data riwayat transaksi..." variant="icon" sx={{ py: 4 }} />
        )}

        {/* Empty State */}
        {!loading && filteredOrders.length === 0 && (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <ReceiptLongOutlined sx={{ fontSize: 44, color: '#cbd5e1', mb: 1.5 }} />
            <Typography variant="h6" sx={{ fontWeight: 750, color: 'text.primary', mb: 0.5, fontSize: '1.05rem' }}>
              Tidak ada transaksi ditemukan
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', fontSize: '0.84rem' }}>
              {orders.length === 0
                ? 'Belum ada transaksi penjualan yang tersimpan di sistem. Selesaikan pesanan di register Kasir POS.'
                : 'Tidak ada transaksi yang cocok dengan kriteria filter atau pencarian Anda.'}
            </Typography>
          </Box>
        )}

        {/* Orders Table */}
        {!loading && filteredOrders.length > 0 && (
          <TableContainer sx={{ maxHeight: 620 }}>
            <Table stickyHeader aria-label="Tabel riwayat transaksi">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 160, fontWeight: 750, color: 'text.secondary', fontSize: '0.76rem' }}>
                    NOMOR PESANAN
                  </TableCell>
                  <TableCell sx={{ minWidth: 160, fontWeight: 750, color: 'text.secondary', fontSize: '0.76rem' }}>
                    TANGGAL & WAKTU
                  </TableCell>
                  <TableCell sx={{ minWidth: 140, fontWeight: 750, color: 'text.secondary', fontSize: '0.76rem' }}>
                    METODE BAYAR
                  </TableCell>
                  <TableCell align="right" sx={{ minWidth: 130, fontWeight: 750, color: 'text.secondary', fontSize: '0.76rem' }}>
                    SUBTOTAL
                  </TableCell>
                  <TableCell align="right" sx={{ minWidth: 140, fontWeight: 750, color: 'text.secondary', fontSize: '0.76rem' }}>
                    TOTAL BAYAR
                  </TableCell>
                  <TableCell align="center" sx={{ minWidth: 100, fontWeight: 750, color: 'text.secondary', fontSize: '0.76rem' }}>
                    STATUS
                  </TableCell>
                  <TableCell align="center" sx={{ minWidth: 130, fontWeight: 750, color: 'text.secondary', fontSize: '0.76rem' }}>
                    AKSI
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredOrders.map((o) => (
                  <TableRow
                    key={o.id}
                    hover
                    sx={{
                      transition: 'background-color 0.15s ease',
                      '&:hover': { bgcolor: 'action.hover' },
                      '&:last-child td, &:last-child th': { border: 0 },
                    }}
                  >
                    <TableCell component="th" scope="row">
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 800,
                          bgcolor: 'action.hover',
                          px: 1.2,
                          py: 0.35,
                          borderRadius: '8px',
                          display: 'inline-block',
                          fontSize: '0.82rem',
                          color: 'text.primary',
                          border: '1px solid',
                          borderColor: 'divider',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {o.order_number}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 650, color: 'text.primary', fontSize: '0.84rem' }}>
                        {formatDateTime(o.created_at)}
                      </Typography>
                      {o.notes && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', display: 'block' }}>
                          Catatan: {o.notes}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>{getPaymentMethodChip(o.payment_method)}</TableCell>

                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary" className="tnum" sx={{ fontWeight: 600, fontSize: '0.86rem' }}>
                        {formatCurrency(o.subtotal_idr)}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        className="tnum"
                        sx={{
                          fontWeight: 850,
                          color: '#ea580c',
                          fontSize: '0.98rem',
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {formatCurrency(o.total_idr)}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Chip
                        label="Selesai"
                        size="small"
                        color="success"
                        sx={{
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          height: 22,
                        }}
                      />
                    </TableCell>

                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenDetail(o)}
                        startIcon={<ReceiptLongOutlined sx={{ fontSize: 16 }} />}
                        sx={{
                          borderRadius: '8px',
                          fontWeight: 750,
                          fontSize: '0.76rem',
                          py: 0.35,
                          px: 1.25,
                        }}
                      >
                        Lihat Struk
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Transaction Detail & Thermal Receipt Modal */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        TransitionComponent={ModalSlideTransition}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          component="div"
          sx={{
            p: 2.25,
            pb: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 850, color: 'text.primary', fontSize: '1.15rem', letterSpacing: '-0.02em' }}>
              Struk Digital & Rincian Pesanan
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.76rem', fontWeight: 550 }}>
              {selectedOrder ? `Nomor Transaksi: ${selectedOrder.order_number}` : 'Memuat data...'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setModalOpen(false)} sx={{ color: 'text.secondary' }}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        </DialogTitle>

        <Divider sx={{ borderColor: 'divider' }} />

        <DialogContent sx={{ p: 2.5 }}>
          {loadingDetail ? (
            <PawLoading label="Mengambil rincian item transaksi..." variant="icon" sx={{ py: 4 }} />
          ) : !selectedOrder ? null : (
            <Stack spacing={2.25}>
              {detailError && (
                <Alert severity="warning" sx={{ borderRadius: '8px' }}>
                  {detailError}
                </Alert>
              )}

              {/* Thermal Receipt Visual Preview */}
              <Box
                className="receipt-thermal-card"
              sx={{
                bgcolor: 'background.default',
                p: 3,
                borderRadius: '12px',
                border: '1.5px dashed',
                borderColor: 'divider',
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                boxShadow: 'none',
              }}
            >
              {/* Receipt Header */}
              <Box sx={{ textAlign: 'center', pb: 2, borderBottom: '1px dashed', borderColor: 'divider' }}>
                  <Typography variant="h6" sx={{ fontWeight: 850, color: 'text.primary', fontSize: '1.15rem' }}>
                    PawPOS Express
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.74rem' }}>
                    Sistem Kasir & Operasional Retail Modern
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mt: 0.5 }}>
                    {formatDateTime(selectedOrder.created_at)}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'inline-block',
                      mt: 0.75,
                      fontWeight: 800,
                      bgcolor: 'action.hover',
                      px: 1.25,
                      py: 0.25,
                      borderRadius: '6px',
                      color: 'text.primary',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {selectedOrder.order_number}
                  </Typography>
                </Box>

                {/* Items Breakdown */}
                <Box sx={{ py: 2, borderBottom: '1px dashed', borderColor: 'divider' }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.04em', display: 'block', mb: 1 }}>
                    RINCIAN ITEM BELANJA
                  </Typography>

                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    <Stack spacing={1}>
                      {selectedOrder.items.map((item, idx) => (
                        <Box key={item.id || idx}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box sx={{ flex: 1, pr: 1 }}>
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary', fontSize: '0.86rem', lineHeight: 1.25 }}>
                                  {item.product_name}
                                </Typography>
                                {item.item_kind === 'jasa' && (
                                  <Chip label="Jasa" size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 800 }} />
                                )}
                              </Stack>
                              <Typography variant="caption" color="text.secondary" className="tnum" sx={{ fontSize: '0.72rem' }}>
                                {item.quantity} × {formatCurrency(item.unit_price_idr)}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.88rem' }} className="tnum">
                              {formatCurrency(item.subtotal_idr)}
                            </Typography>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Item spesifik tidak terinci. Total tagihan tertera di bawah.
                    </Typography>
                  )}
                </Box>

                {/* Financial Summary */}
                <Box sx={{ pt: 2 }}>
                  <Stack spacing={0.75}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.84rem' }}>
                        Subtotal Belanja
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }} className="tnum">
                        {formatCurrency(selectedOrder.subtotal_idr)}
                      </Typography>
                    </Stack>

                    {selectedOrder.discount_idr > 0 && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="error.main" sx={{ fontSize: '0.84rem' }}>
                          Diskon
                        </Typography>
                        <Typography variant="body2" color="error.main" sx={{ fontWeight: 700 }} className="tnum">
                          -{formatCurrency(selectedOrder.discount_idr)}
                        </Typography>
                      </Stack>
                    )}

                    {selectedOrder.tax_idr > 0 && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.84rem' }}>
                          Pajak (PPN)
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }} className="tnum">
                          {formatCurrency(selectedOrder.tax_idr)}
                        </Typography>
                      </Stack>
                    )}

                    <Divider sx={{ my: 0.5, borderColor: 'divider' }} />

                    <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                      <Typography variant="subtitle1" sx={{ fontWeight: 850, color: 'text.primary', fontSize: '1rem' }}>
                        TOTAL DIBAYAR
                      </Typography>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 850,
                          color: '#ea580c',
                          fontSize: '1.35rem',
                          letterSpacing: '-0.025em',
                        }}
                        className="tnum"
                      >
                        {formatCurrency(selectedOrder.total_idr)}
                      </Typography>
                    </Stack>

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                        Metode Transaksi
                      </Typography>
                      {getPaymentMethodChip(selectedOrder.payment_method)}
                    </Stack>

                    {selectedOrder.payment_method === 'split' && (
                      <>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                            Porsi Tunai (Kas Laci)
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 750, color: 'text.primary' }} className="tnum">
                            {formatCurrency(selectedOrder.cash_amount_idr ?? 0)}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                            Porsi Non-Tunai / QRIS
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 750, color: 'text.primary' }} className="tnum">
                            {formatCurrency(selectedOrder.non_cash_amount_idr ?? 0)}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                            Total Uang Diterima
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 750, color: 'text.primary' }} className="tnum">
                            {formatCurrency(selectedOrder.paid_amount_idr)}
                          </Typography>
                        </Stack>
                        {selectedOrder.change_amount_idr > 0 && (
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                              Uang Kembalian Tunai
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: 'success.main' }} className="tnum">
                              {formatCurrency(selectedOrder.change_amount_idr)}
                            </Typography>
                          </Stack>
                        )}
                      </>
                    )}

                    {selectedOrder.payment_method === 'cash' && (
                      <>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                            Uang Tunai Diterima
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 750, color: 'text.primary' }} className="tnum">
                            {formatCurrency(selectedOrder.paid_amount_idr)}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                            Uang Kembalian
                          </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: 'success.main' }} className="tnum">
                              {formatCurrency(selectedOrder.change_amount_idr)}
                            </Typography>
                          </Stack>
                        </>
                    )}
                  </Stack>
                </Box>

                {/* Receipt Footer */}
                <Box sx={{ mt: 3, pt: 2, borderTop: '1px dashed', borderColor: 'divider', textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650, display: 'block' }}>
                    Terima kasih telah berbelanja di PawPOS!
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    Simpan struk ini sebagai bukti pembayaran yang sah.
                  </Typography>
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider', justifyContent: 'space-between' }}>
          <Button onClick={() => setModalOpen(false)} sx={{ fontWeight: 650, color: 'text.secondary' }}>
            Tutup
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PrintOutlined />}
            onClick={handlePrintReceipt}
            sx={{ borderRadius: '8px', fontWeight: 750, px: 2.5 }}
          >
            Cetak Struk Thermal
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
