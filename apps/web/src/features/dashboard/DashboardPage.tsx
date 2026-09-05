import { useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import {
  AccountBalanceWalletOutlined,
  ArrowForwardOutlined,
  CheckCircleOutline,
  ErrorOutline,
  HeadsetMicOutlined,
  Inventory2Outlined,
  LanguageOutlined,
  PointOfSaleOutlined,
  ReceiptLongOutlined,
  RefreshOutlined,
  SpeedOutlined,
  StorefrontOutlined,
  SwapHorizOutlined,
  TrendingUpOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material'
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import { getActiveTenant } from '../tenant/tenantApi'
import { getActiveStaff } from '../auth/rbac'
import { getOrders, type Order } from '../pos/ordersApi'
import { getCurrentShift, type Shift } from '../shifts/shiftsApi'
import { getProducts, type Product } from '../products/productsApi'
import { getStockBalances, type ProductStockSummary } from '../inventory/inventoryApi'
import { formatCurrency } from '../../utils/currency'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
const CS_MASCOT = '/branding/cs-mascot.png'

const QUICK_COPILOT_PROMPTS = [
  { icon: '📦', label: 'Cek Stok Menipis', prompt: 'Berapa sisa stok pakan hewan yang menipis saat ini?' },
  { icon: '💳', label: 'Panduan Split Payment', prompt: 'Bagaimana cara memproses pembayaran split kasir (tunai + QRIS)?' },
  { icon: '🐱', label: 'Rekomendasi Pakan', prompt: 'Apa rekomendasi pakan terbaik untuk kitten usia 2 bulan?' },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const [healthState, setHealthState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [requestId, setRequestId] = useState('')
  const [activeTenant, setActiveTenant] = useState(getActiveTenant())
  const [activeStaff, setActiveStaffState] = useState(getActiveStaff())

  const [orders, setOrders] = useState<Order[]>([])
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [stocks, setStocks] = useState<ProductStockSummary[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  function loadAllDashboardData() {
    setIsLoadingData(true)
    setHealthState('loading')

    // 1. Health check
    fetch(`${apiBase}/health/ready`)
      .then(async (res) => {
        const body = (await res.json()) as { request_id?: string }
        if (!res.ok) throw new Error('health check not ok')
        setRequestId(body.request_id ?? '')
        setHealthState('ready')
      })
      .catch(() => setHealthState('error'))

    // 2. Fetch real business entities in parallel (with safe catch so partial failure doesn't break dashboard)
    Promise.allSettled([
      getOrders(),
      getCurrentShift(),
      getProducts(),
      getStockBalances(),
    ]).then(([ordersRes, shiftRes, productsRes, stocksRes]) => {
      if (ordersRes.status === 'fulfilled') {
        setOrders(ordersRes.value ?? [])
      }
      if (shiftRes.status === 'fulfilled') {
        setCurrentShift(shiftRes.value ?? null)
      }
      if (productsRes.status === 'fulfilled') {
        setProducts(productsRes.value ?? [])
      }
      if (stocksRes.status === 'fulfilled') {
        setStocks(stocksRes.value ?? [])
      }
      setIsLoadingData(false)
    })
  }

  useEffect(() => {
    loadAllDashboardData()

    const handleTenant = () => {
      setActiveTenant(getActiveTenant())
      loadAllDashboardData()
    }
    const handleStaff = () => {
      setActiveStaffState(getActiveStaff())
    }

    window.addEventListener('pawpos:tenant_change', handleTenant)
    window.addEventListener('pawpos:staff_change', handleStaff)
    return () => {
      window.removeEventListener('pawpos:tenant_change', handleTenant)
      window.removeEventListener('pawpos:staff_change', handleStaff)
    }
  }, [])

  function triggerCopilotPrompt(promptText: string) {
    window.dispatchEvent(
      new CustomEvent('pawpos:open_cs_chat', {
        detail: { prompt: promptText },
      }),
    )
  }

  // Real Metric Calculations
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_idr || 0), 0)
  const totalTransactions = orders.length
  const cashSales = orders.filter((o) => o.payment_method === 'cash').reduce((sum, o) => sum + (o.total_idr || 0), 0)
  const qrisSales = orders.filter((o) => o.payment_method === 'qris').reduce((sum, o) => sum + (o.total_idr || 0), 0)
  const splitSales = orders.filter((o) => o.payment_method === 'split').reduce((sum, o) => sum + (o.total_idr || 0), 0)

  const isShiftActive = currentShift?.status === 'open'
  const expectedCashInDrawer = currentShift ? currentShift.expected_cash_idr : 0
  const activeCashierName = currentShift?.cashier_name || activeStaff?.name || 'Kasir Operasional'

  const activeProductsCount = products.filter((p) => p.is_active !== false).length
  const totalStockUnits = stocks.reduce((sum, s) => sum + (s.quantity || 0), 0)
  const lowStockItems = stocks.filter((s) => s.quantity <= s.minimum_stock)

  return (
    <Stack spacing={2.5}>
      {/* 1. HERO OPERATIONAL BANNER */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 3 },
          borderRadius: '16px',
          border: '1px solid #FFE3CC',
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF8F3 60%, #FFF2E8 100%)',
          boxShadow: '0 4px 20px rgba(255, 138, 61, 0.08)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2.5}
        >
          <Box sx={{ zIndex: 1, maxWidth: 680 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
              <Chip
                label={`OUTLET: ${activeTenant.name.toUpperCase()}`}
                size="small"
                sx={{
                  bgcolor: '#FF8A3D',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.68rem',
                  borderRadius: '6px',
                }}
              />
              <Chip
                label={`PAKET: ${activeTenant.plan_type.toUpperCase()}`}
                size="small"
                sx={{
                  bgcolor: '#FFF5ED',
                  color: '#FF8A3D',
                  border: '1px solid #FFE3CC',
                  fontWeight: 800,
                  fontSize: '0.68rem',
                  borderRadius: '6px',
                }}
              />
              <Chip
                label={`OPERATOR: ${activeStaff.name} (${activeStaff.role.toUpperCase()})`}
                size="small"
                sx={{
                  bgcolor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  borderRadius: '6px',
                }}
              />
            </Stack>

            <Typography
              variant="h4"
              sx={{
                fontWeight: 850,
                color: '#0f172a',
                letterSpacing: '-0.03em',
                fontSize: { xs: '1.45rem', md: '1.85rem' },
                lineHeight: 1.2,
              }}
            >
              Pusat Kontrol Kasir & Operasional Toko
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.55 }}>
              Pantau arus penjualan kasir real-time, rekonsiliasi kas laci shift, peringatan stok pakan kritis, dan audit struk transaksi dengan bantuan Asisten AI.
            </Typography>
          </Box>

          {/* Primary Action Buttons */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ width: { xs: '100%', sm: 'auto' }, zIndex: 1, flexShrink: 0 }}
          >
            <Button
              component={RouterLink}
              to="/pos"
              variant="contained"
              size="large"
              startIcon={<PointOfSaleOutlined />}
              sx={{
                px: 3,
                py: 1.25,
                bgcolor: '#FF8A3D',
                color: '#ffffff',
                fontWeight: 800,
                borderRadius: '10px',
                boxShadow: '0 4px 16px rgba(255, 138, 61, 0.35)',
                '&:hover': { bgcolor: '#e67328' },
                width: { xs: '100%', sm: 'auto' },
              }}
            >
              Buka Kasir POS
            </Button>

            <Button
              component={RouterLink}
              to="/shifts"
              variant="outlined"
              size="large"
              startIcon={<SwapHorizOutlined />}
              sx={{
                px: 2.5,
                py: 1.25,
                borderColor: '#cbd5e1',
                color: '#334155',
                bgcolor: '#ffffff',
                fontWeight: 750,
                borderRadius: '10px',
                '&:hover': { borderColor: '#FF8A3D', color: '#FF8A3D', bgcolor: '#FFF5ED' },
                width: { xs: '100%', sm: 'auto' },
              }}
            >
              {isShiftActive ? 'Kelola Shift Aktif' : 'Buka Shift Kasir'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* 2. REAL OPERATIONAL KPI SUMMARY CARDS (4 TILES) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        {/* KPI 1: Real Revenue */}
        <Card
          variant="outlined"
          sx={{
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' },
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', letterSpacing: '0.04em' }}>
                TOTAL PENJUALAN TRANSAKSI
              </Typography>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: '#FFF5ED',
                  color: '#FF8A3D',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #FFE3CC',
                }}
              >
                <TrendingUpOutlined sx={{ fontSize: 20 }} />
              </Box>
            </Stack>

            <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', mb: 0.5 }}>
              {isLoadingData ? <CircularProgress size={24} sx={{ color: '#FF8A3D' }} /> : formatCurrency(totalRevenue)}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={`${totalTransactions} Struk`}
                size="small"
                sx={{
                  bgcolor: totalTransactions > 0 ? '#ecfdf5' : '#f1f5f9',
                  color: totalTransactions > 0 ? '#059669' : '#64748b',
                  fontWeight: 800,
                  fontSize: '0.68rem',
                  height: 20,
                }}
              />
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.74rem' }}>
                {splitSales > 0 ? `(${formatCurrency(splitSales)} Split)` : 'Tunai & QRIS'}
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* KPI 2: Active Shift & Cash Drawer */}
        <Card
          variant="outlined"
          sx={{
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' },
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', letterSpacing: '0.04em' }}>
                KAS LACI & SESI SHIFT
              </Typography>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: isShiftActive ? '#ecfdf5' : '#f1f5f9',
                  color: isShiftActive ? '#059669' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid',
                  borderColor: isShiftActive ? '#bbf7d0' : '#e2e8f0',
                }}
              >
                <AccountBalanceWalletOutlined sx={{ fontSize: 20 }} />
              </Box>
            </Stack>

            <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', mb: 0.5 }}>
              {isLoadingData ? <CircularProgress size={24} sx={{ color: '#059669' }} /> : formatCurrency(expectedCashInDrawer)}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center">
              <span className={isShiftActive ? 'status-dot-active' : 'status-dot-neutral'} />
              <Typography variant="caption" sx={{ fontWeight: 750, color: isShiftActive ? '#059669' : '#64748b', fontSize: '0.74rem' }}>
                {isShiftActive ? `Shift Aktif • ${activeCashierName}` : 'Shift Belum Dibuka'}
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* KPI 3: Product Catalog Master */}
        <Card
          variant="outlined"
          sx={{
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' },
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', letterSpacing: '0.04em' }}>
                KATALOG MASTER SKU
              </Typography>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #bfdbfe',
                }}
              >
                <StorefrontOutlined sx={{ fontSize: 20 }} />
              </Box>
            </Stack>

            <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', mb: 0.5 }}>
              {isLoadingData ? <CircularProgress size={24} sx={{ color: '#2563eb' }} /> : `${products.length} SKU`}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={`${activeProductsCount} Siap Jual`}
                size="small"
                sx={{
                  bgcolor: '#eff6ff',
                  color: '#2563eb',
                  fontWeight: 800,
                  fontSize: '0.68rem',
                  height: 20,
                }}
              />
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.74rem' }}>
                WebP Optimizer Aktif
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* KPI 4: Physical Stock & Inventory Alerts */}
        <Card
          variant="outlined"
          sx={{
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' },
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', letterSpacing: '0.04em' }}>
                STATUS INVENTORI FISIK
              </Typography>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: lowStockItems.length > 0 ? '#fef2f2' : '#f0fdf4',
                  color: lowStockItems.length > 0 ? '#dc2626' : '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid',
                  borderColor: lowStockItems.length > 0 ? '#fecaca' : '#bbf7d0',
                }}
              >
                <Inventory2Outlined sx={{ fontSize: 20 }} />
              </Box>
            </Stack>

            <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', mb: 0.5 }}>
              {isLoadingData ? <CircularProgress size={24} sx={{ color: '#16a34a' }} /> : `${totalStockUnits} Pcs`}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={lowStockItems.length > 0 ? `${lowStockItems.length} Perlu Restock` : 'Stok Aman'}
                size="small"
                sx={{
                  bgcolor: lowStockItems.length > 0 ? '#fef2f2' : '#f0fdf4',
                  color: lowStockItems.length > 0 ? '#dc2626' : '#16a34a',
                  fontWeight: 800,
                  fontSize: '0.68rem',
                  height: 20,
                }}
              />
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.74rem' }}>
                Gudang Toko Utama
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* 3. MAIN DASHBOARD CONTENT GRID (TWO COLUMNS: 7 / 5) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.45fr 1fr' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        {/* LEFT COLUMN: REAL RECENT TRANSACTIONS & LOW STOCK MONITOR */}
        <Stack spacing={2.5}>
          {/* Recent Orders Card */}
          <Paper
            elevation={0}
            className="terminal-card"
            sx={{
              p: { xs: 2.5, sm: 3 },
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
                  Transaksi Penjualan Terkini
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Audit struk order kasir dengan filter metode bayar
                </Typography>
              </Box>
              <Button
                component={RouterLink}
                to="/orders"
                size="small"
                endIcon={<ArrowForwardOutlined sx={{ fontSize: 16 }} />}
                sx={{ fontWeight: 750, color: '#FF8A3D' }}
              >
                Lihat Semua ({orders.length})
              </Button>
            </Stack>

            {orders.length === 0 ? (
              <Box
                sx={{
                  p: 4,
                  textAlign: 'center',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '12px',
                  bgcolor: '#f8fafc',
                }}
              >
                <ReceiptLongOutlined sx={{ fontSize: 36, color: '#94a3b8', mb: 1 }} />
                <Typography sx={{ fontWeight: 750, color: '#1e293b', mb: 0.5 }}>
                  Belum ada ringkasan operasional
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', mb: 2, fontSize: '0.82rem' }}>
                  Belum ada transaksi tercatat pada shift saat ini. Buka terminal kasir untuk memproses transaksi penjualan pertama.
                </Typography>
                <Button
                  component={RouterLink}
                  to="/pos"
                  variant="contained"
                  size="small"
                  startIcon={<PointOfSaleOutlined />}
                  sx={{ borderRadius: '8px', bgcolor: '#FF8A3D', fontWeight: 750 }}
                >
                  Buka Kasir Sekarang
                </Button>
              </Box>
            ) : (
              <TableContainer sx={{ border: '1px solid #f1f5f9', borderRadius: '10px' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem', color: '#64748b' }}>NO. STRUK</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem', color: '#64748b' }}>METODE</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem', color: '#64748b' }}>WAKTU</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.74rem', color: '#64748b' }}>TOTAL FINAL</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orders.slice(0, 5).map((order) => {
                      const isSplit = order.payment_method === 'split'
                      const isQris = order.payment_method === 'qris'
                      return (
                        <TableRow key={order.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                          <TableCell sx={{ fontWeight: 750, fontSize: '0.82rem', color: '#0f172a' }}>
                            {order.order_number || `#${order.id.slice(0, 8)}`}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={isSplit ? 'Split Tender' : isQris ? 'QRIS' : 'Tunai'}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                bgcolor: isSplit ? '#eff6ff' : isQris ? '#fdf4ff' : '#f0fdf4',
                                color: isSplit ? '#2563eb' : isQris ? '#c026d3' : '#16a34a',
                                border: '1px solid',
                                borderColor: isSplit ? '#bfdbfe' : isQris ? '#f5d0fe' : '#bbf7d0',
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.84rem', color: '#0f172a' }}>
                            {formatCurrency(order.total_idr)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          {/* Low Stock Watchlist */}
          <Paper
            elevation={0}
            className="terminal-card"
            sx={{
              p: { xs: 2.5, sm: 3 },
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
                  Pemantauan Stok Gudang
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Saldo fisik real-time terhadap ambang batas minimum
                </Typography>
              </Box>
              <Button
                component={RouterLink}
                to="/inventory/stocks"
                size="small"
                endIcon={<ArrowForwardOutlined sx={{ fontSize: 16 }} />}
                sx={{ fontWeight: 750, color: '#FF8A3D' }}
              >
                Buku Mutasi Stok
              </Button>
            </Stack>

            {stocks.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                Belum ada data stok inventori. Buat produk dan catat mutasi masuk.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {stocks.slice(0, 4).map((stock) => {
                  const isLow = stock.quantity <= stock.minimum_stock
                  const pct = Math.min(100, Math.max(10, Math.round((stock.quantity / (stock.minimum_stock * 3 || 15)) * 100)))

                  return (
                    <Box
                      key={stock.product_id}
                      sx={{
                        p: 1.5,
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: isLow ? '#fecaca' : '#f1f5f9',
                        bgcolor: isLow ? '#fffbfb' : '#ffffff',
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        justifyContent: 'space-between',
                        gap: 1.5,
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography sx={{ fontWeight: 750, fontSize: '0.88rem', color: '#0f172a' }} noWrap>
                            {stock.product_name}
                          </Typography>
                          <Chip
                            label={`SKU: ${stock.sku}`}
                            size="small"
                            sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          Lokasi: {stock.location_name} • Min. threshold: {stock.minimum_stock} {stock.base_unit}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: { xs: '100%', sm: 'auto' } }}>
                        <Box sx={{ minWidth: 90, textAlign: 'right' }}>
                          <Typography sx={{ fontWeight: 850, fontSize: '0.94rem', color: isLow ? '#dc2626' : '#16a34a' }}>
                            {stock.quantity} {stock.base_unit}
                          </Typography>
                          <Typography variant="caption" sx={{ color: isLow ? '#dc2626' : '#64748b', fontSize: '0.68rem', fontWeight: 700 }}>
                            {isLow ? '⚠️ Perlu Restock' : '✓ Stok Aman'}
                          </Typography>
                        </Box>
                        <Button
                          component={RouterLink}
                          to="/inventory/stocks"
                          size="small"
                          variant="outlined"
                          sx={{
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 750,
                            height: 28,
                            px: 1.25,
                            textTransform: 'none',
                          }}
                        >
                          + Inbound
                        </Button>
                      </Stack>
                    </Box>
                  )
                })}
              </Stack>
            )}
          </Paper>
        </Stack>

        {/* RIGHT COLUMN: AI COPILOT CARD, CASHIER SHIFT SUMMARY, QUICK LAUNCHERS */}
        <Stack spacing={2.5}>
          {/* AI Copilot Operational Card */}
          <Paper
            elevation={0}
            className="terminal-card"
            sx={{
              p: 2.5,
              borderRadius: '16px',
              border: '1px solid #FFE3CC',
              bgcolor: '#FFFDFB',
              boxShadow: '0 4px 16px rgba(255, 138, 61, 0.08)',
            }}
          >
            <Stack direction="row" spacing={1.75} alignItems="center" sx={{ mb: 2 }}>
              <Avatar
                src={CS_MASCOT}
                alt="Shiba CS Mascot"
                sx={{
                  width: 52,
                  height: 52,
                  border: '2px solid #FF8A3D',
                  bgcolor: '#ffffff',
                }}
              />
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontWeight: 850, color: '#0f172a', fontSize: '1rem' }}>
                    PawPOS AI Copilot
                  </Typography>
                  <span className="status-dot-active" />
                </Stack>
                <Typography variant="caption" sx={{ color: '#FF8A3D', fontWeight: 750, display: 'block' }}>
                  Groq GPT-OSS 120B & ElevenLabs Voice
                </Typography>
              </Box>
            </Stack>

            <Typography variant="body2" sx={{ color: '#475569', mb: 2, fontSize: '0.82rem', lineHeight: 1.5 }}>
              Tanyakan ketersediaan stok pakan, panduan transaksi campuran, atau resep nutrisi hewan tanpa meninggalkan kasir:
            </Typography>

            <Stack spacing={1}>
              {QUICK_COPILOT_PROMPTS.map((item, idx) => (
                <Button
                  key={idx}
                  variant="outlined"
                  onClick={() => triggerCopilotPrompt(item.prompt)}
                  sx={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    borderColor: '#FFE3CC',
                    bgcolor: '#ffffff',
                    color: '#1e293b',
                    fontWeight: 700,
                    borderRadius: '8px',
                    py: 0.85,
                    px: 1.5,
                    fontSize: '0.8rem',
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#FFF5ED', borderColor: '#FF8A3D' },
                  }}
                >
                  <span style={{ marginRight: 8 }}>{item.icon}</span>
                  {item.label}
                </Button>
              ))}
            </Stack>
          </Paper>

          {/* Cash Register & Shift Widget */}
          <Paper
            elevation={0}
            className="terminal-card"
            sx={{
              p: 2.5,
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                Kotak Kas Laci Kasir
              </Typography>
              <Chip
                label={isShiftActive ? 'Shift Terbuka' : 'Tutup'}
                size="small"
                sx={{
                  bgcolor: isShiftActive ? '#ecfdf5' : '#f1f5f9',
                  color: isShiftActive ? '#059669' : '#64748b',
                  fontWeight: 800,
                  fontSize: '0.68rem',
                }}
              />
            </Stack>

            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" sx={{ fontSize: '0.82rem' }}>
                <Typography variant="body2" color="text.secondary">Modal Kas Awal:</Typography>
                <Typography fontWeight={750} color="#0f172a">
                  {formatCurrency(currentShift?.starting_cash_idr || 0)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" sx={{ fontSize: '0.82rem' }}>
                <Typography variant="body2" color="text.secondary">Penjualan Kas Tunai Masuk:</Typography>
                <Typography fontWeight={750} color="#16a34a">
                  +{formatCurrency(currentShift?.total_cash_sales_idr || cashSales)}
                </Typography>
              </Stack>
              <Divider sx={{ my: 0.5 }} />
              <Stack direction="row" justifyContent="space-between" sx={{ fontSize: '0.9rem' }}>
                <Typography fontWeight={800} color="#0f172a">Ekspektasi Kas Fisik Laci:</Typography>
                <Typography fontWeight={900} color="#FF8A3D">
                  {formatCurrency(expectedCashInDrawer)}
                </Typography>
              </Stack>
            </Stack>

            <Button
              component={RouterLink}
              to="/shifts"
              variant="outlined"
              fullWidth
              size="small"
              sx={{
                mt: 2,
                borderRadius: '8px',
                borderColor: '#cbd5e1',
                color: '#334155',
                fontWeight: 750,
                textTransform: 'none',
                '&:hover': { borderColor: '#FF8A3D', color: '#FF8A3D', bgcolor: '#FFF5ED' },
              }}
            >
              Audit & Rekonsiliasi Z-Report
            </Button>
          </Paper>

          {/* Quick Launcher Rails */}
          <Paper
            elevation={0}
            className="terminal-card"
            sx={{
              p: 2.5,
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 1.5 }}>
              Jalan Pintas Terminal
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Button
                component={RouterLink}
                to="/pos"
                variant="outlined"
                sx={{
                  p: 1.25,
                  flexDirection: 'column',
                  gap: 0.5,
                  borderRadius: '10px',
                  borderColor: '#e2e8f0',
                  color: '#1e293b',
                  fontWeight: 750,
                  fontSize: '0.78rem',
                  textTransform: 'none',
                  '&:hover': { borderColor: '#FF8A3D', bgcolor: '#FFF5ED', color: '#FF8A3D' },
                }}
              >
                <PointOfSaleOutlined sx={{ fontSize: 20, color: '#FF8A3D' }} />
                Kasir POS
              </Button>

              <Button
                component={RouterLink}
                to="/orders"
                variant="outlined"
                sx={{
                  p: 1.25,
                  flexDirection: 'column',
                  gap: 0.5,
                  borderRadius: '10px',
                  borderColor: '#e2e8f0',
                  color: '#1e293b',
                  fontWeight: 750,
                  fontSize: '0.78rem',
                  textTransform: 'none',
                  '&:hover': { borderColor: '#FF8A3D', bgcolor: '#FFF5ED', color: '#FF8A3D' },
                }}
              >
                <ReceiptLongOutlined sx={{ fontSize: 20, color: '#2563eb' }} />
                Riwayat Order
              </Button>

              <Button
                component={RouterLink}
                to="/products"
                variant="outlined"
                sx={{
                  p: 1.25,
                  flexDirection: 'column',
                  gap: 0.5,
                  borderRadius: '10px',
                  borderColor: '#e2e8f0',
                  color: '#1e293b',
                  fontWeight: 750,
                  fontSize: '0.78rem',
                  textTransform: 'none',
                  '&:hover': { borderColor: '#FF8A3D', bgcolor: '#FFF5ED', color: '#FF8A3D' },
                }}
              >
                <StorefrontOutlined sx={{ fontSize: 20, color: '#10b981' }} />
                Katalog Produk
              </Button>

              <Button
                component={RouterLink}
                to="/landing"
                variant="outlined"
                sx={{
                  p: 1.25,
                  flexDirection: 'column',
                  gap: 0.5,
                  borderRadius: '10px',
                  borderColor: '#e2e8f0',
                  color: '#1e293b',
                  fontWeight: 750,
                  fontSize: '0.78rem',
                  textTransform: 'none',
                  '&:hover': { borderColor: '#FF8A3D', bgcolor: '#FFF5ED', color: '#FF8A3D' },
                }}
              >
                <LanguageOutlined sx={{ fontSize: 20, color: '#8b5cf6' }} />
                Website SaaS
              </Button>
            </Box>
          </Paper>
        </Stack>
      </Box>

      {/* 4. SLEEK MINIMALIST API HEALTH BAR */}
      <Box
        className="terminal-card"
        sx={{
          px: 2,
          py: 1,
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <span className={healthState === 'ready' ? 'status-dot-active' : healthState === 'error' ? 'status-dot-neutral' : 'status-dot-pending'} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', fontSize: '0.74rem' }}>
            {healthState === 'ready'
              ? 'Backend Cloud POS Terkoneksi & Siap Transaksi'
              : healthState === 'error'
              ? 'Koneksi Backend Terputus'
              : 'Memeriksa Kesiapan Endpoint...'}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          {requestId && (
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: '0.68rem' }}>
              req: {requestId.slice(0, 16)}...
            </Typography>
          )}
          <IconButton size="small" onClick={loadAllDashboardData} sx={{ p: 0.5, color: '#64748b' }}>
            <RefreshOutlined sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
      </Box>
    </Stack>
  )
}
