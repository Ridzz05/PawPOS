import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AddCircleOutlineOutlined,
  CloseOutlined,
  HistoryOutlined,
  Inventory2Outlined,
  RefreshOutlined,
  RemoveCircleOutlineOutlined,
  SwapHorizOutlined,
  TrendingDownOutlined,
  TrendingUpOutlined,
  WarehouseOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import {
  getLocations,
  getStockBalances,
  getStockMovements,
  recordMovement,
  InventoryApiError,
  type InventoryLocation,
  type MovementType,
  type ProductStockSummary,
  type StockMovementItem,
} from './inventoryApi'
import { getProducts, type Product } from '../products/productsApi'
import { ModalSlideTransition } from '../../components/ModalSlideTransition'
import { useRbac } from '../auth/rbac'

const OUTBOUND_REASONS = [
  'Barang Rusak / Cacat',
  'Kadaluarsa (Expired)',
  'Pemakaian Internal Toko',
  'Penjualan Kasir Offline',
  'Koreksi Selisih Opname',
]

const INBOUND_REASONS = [
  'Penerimaan Kulakan Grosir',
  'Pengiriman Supplier',
  'Retur dari Pelanggan',
  'Koreksi Stok Tambahan',
]

export function StocksPage() {
  const { hasPermission } = useRbac()
  const canRecordMovement = hasPermission('record_stock_movement')

  const [activeTab, setActiveTab] = useState<'balances' | 'movements'>('balances')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [stocks, setStocks] = useState<ProductStockSummary[]>([])
  const [movements, setMovements] = useState<StockMovementItem[]>([])
  const [locations, setLocations] = useState<InventoryLocation[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState('')

  // Movement Ledger Filters
  const [movementFilterType, setMovementFilterType] = useState<string>('')
  const [movementFilterProduct, setMovementFilterProduct] = useState<string>('')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogProductId, setDialogProductId] = useState('')
  const [dialogLocationId, setDialogLocationId] = useState('')
  const [movementType, setMovementType] = useState<MovementType>('purchase_receipt')
  const [quantityDelta, setQuantityDelta] = useState('')
  const [reason, setReason] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = () => {
    setStatus('loading')
    setErrorMessage('')
    Promise.all([
      getStockBalances(selectedLocationId || undefined),
      getStockMovements(selectedLocationId ? { location_id: selectedLocationId } : undefined),
      getLocations(),
      getProducts(),
    ])
      .then(([stockList, movementList, locList, prodList]) => {
        setStocks(stockList)
        setMovements(movementList)
        setLocations(locList)
        setProducts(prodList)
        setStatus('success')
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Gagal memuat data stok inventori.')
        setStatus('error')
      })
  }

  useEffect(() => {
    loadData()
    const handleTenant = () => loadData()
    window.addEventListener('pawpos:tenant_change', handleTenant)
    return () => window.removeEventListener('pawpos:tenant_change', handleTenant)
  }, [selectedLocationId])

  const resetForm = (presetType: MovementType = 'purchase_receipt', defaultDelta: string = '') => {
    setDialogProductId(products.length > 0 ? products[0].id : '')
    setDialogLocationId(locations.length > 0 ? locations[0].id : 'loc-main')
    setMovementType(presetType)
    setQuantityDelta(defaultDelta)
    setReason('')
    setFieldErrors({})
    setSubmitError('')
  }

  const handleOpenDialog = (presetType: MovementType = 'purchase_receipt') => {
    resetForm(presetType)
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    if (isSubmitting) return
    setDialogOpen(false)
  }

  const handleSubmitMovement = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFieldErrors({})
    setSubmitError('')

    const errors: Record<string, string> = {}
    if (!dialogProductId) errors.product_id = 'Pilih produk.'
    if (!dialogLocationId) errors.location_id = 'Pilih lokasi inventori.'

    let delta = Number(quantityDelta)
    if (quantityDelta === '' || isNaN(delta) || delta === 0) {
      errors.quantity_delta = 'Jumlah delta tidak boleh 0 dan harus berupa angka.'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    // Safeguard: for sale, if user entered positive number, invert to negative
    if (movementType === 'sale' && delta > 0) {
      delta = -delta
    }

    setIsSubmitting(true)
    try {
      await recordMovement({
        product_id: dialogProductId,
        location_id: dialogLocationId,
        quantity_delta: delta,
        movement_type: movementType,
        reason: reason.trim() || undefined,
      })
      handleCloseDialog()
      loadData()
    } catch (err) {
      if (err instanceof InventoryApiError) {
        setSubmitError(err.message)
      } else {
        setSubmitError('Terjadi kesalahan saat mencatat pergerakan stok.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStockStatus = (quantity: number, minimumStock: number) => {
    if (quantity <= 0) {
      return (
        <Chip
          label="Habis"
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.72rem',
            height: 22,
            bgcolor: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca',
          }}
        />
      )
    }
    if (quantity <= minimumStock) {
      return (
        <Chip
          label="Menipis"
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.72rem',
            height: 22,
            bgcolor: '#fffbeb',
            color: '#d97706',
            border: '1px solid #fde68a',
          }}
        />
      )
    }
    return (
      <Chip
        label="Aman"
        size="small"
        sx={{
          fontWeight: 700,
          fontSize: '0.72rem',
          height: 22,
          bgcolor: '#ecfdf5',
          color: '#059669',
          border: '1px solid #a7f3d0',
        }}
      />
    )
  }

  const getMovementBadge = (type: MovementType) => {
    switch (type) {
      case 'purchase_receipt':
        return (
          <Chip
            icon={<TrendingUpOutlined sx={{ fontSize: '14px !important', color: '#047857 !important' }} />}
            label="Barang Masuk (Beli)"
            size="small"
            sx={{
              fontWeight: 750,
              fontSize: '0.75rem',
              height: 24,
              bgcolor: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0',
            }}
          />
        )
      case 'opening':
        return (
          <Chip
            label="Saldo Awal"
            size="small"
            sx={{
              fontWeight: 750,
              fontSize: '0.75rem',
              height: 24,
              bgcolor: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
            }}
          />
        )
      case 'sale':
        return (
          <Chip
            icon={<TrendingDownOutlined sx={{ fontSize: '14px !important', color: '#dc2626 !important' }} />}
            label="Barang Keluar (Jual)"
            size="small"
            sx={{
              fontWeight: 750,
              fontSize: '0.75rem',
              height: 24,
              bgcolor: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
            }}
          />
        )
      case 'adjustment':
        return (
          <Chip
            label="Penyesuaian Fisik"
            size="small"
            sx={{
              fontWeight: 750,
              fontSize: '0.75rem',
              height: 24,
              bgcolor: '#fffbeb',
              color: '#b45309',
              border: '1px solid #fde68a',
            }}
          />
        )
      case 'return':
        return (
          <Chip
            label="Retur Pelanggan"
            size="small"
            sx={{
              fontWeight: 750,
              fontSize: '0.75rem',
              height: 24,
              bgcolor: '#ecfeff',
              color: '#0e7490',
              border: '1px solid #a5f3fc',
            }}
          />
        )
      default:
        return <Chip label={type} size="small" sx={{ fontWeight: 650 }} />
    }
  }

  // Summary counts for Balances
  const stockSummary = useMemo(() => {
    const totalItems = stocks.length
    const lowStock = stocks.filter((s) => s.quantity <= s.minimum_stock).length
    const healthyStock = totalItems - lowStock
    return { totalItems, lowStock, healthyStock }
  }, [stocks])

  // Summary counts for Movements
  const movementSummary = useMemo(() => {
    let totalInbound = 0
    let totalOutbound = 0
    for (const m of movements) {
      if (m.quantity_delta > 0) {
        totalInbound += m.quantity_delta
      } else {
        totalOutbound += Math.abs(m.quantity_delta)
      }
    }
    return {
      totalCount: movements.length,
      totalInbound,
      totalOutbound,
    }
  }, [movements])

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (movementFilterType && m.movement_type !== movementFilterType) return false
      if (movementFilterProduct && m.product_id !== movementFilterProduct) return false
      return true
    })
  }, [movements, movementFilterType, movementFilterProduct])

  // Active product & stock preview for modal
  const activeProduct = useMemo(() => {
    return products.find((p) => p.id === dialogProductId)
  }, [products, dialogProductId])

  const activeLocation = useMemo(() => {
    return locations.find((l) => l.id === dialogLocationId)
  }, [locations, dialogLocationId])

  const activeStock = useMemo(() => {
    if (!dialogProductId) return null
    return stocks.find(
      (s) => s.product_id === dialogProductId && (dialogLocationId ? s.location_id === dialogLocationId : true)
    )
  }, [stocks, dialogProductId, dialogLocationId])

  const currentQty = activeStock ? activeStock.quantity : 0
  const unit = activeStock?.base_unit || activeProduct?.base_unit || 'unit'
  const parsedDelta = Math.abs(Number(quantityDelta)) || 0
  const isOutbound = movementType === 'sale'
  const projectedQty = isOutbound ? currentQty - parsedDelta : currentQty + parsedDelta
  const isOverStock = isOutbound && parsedDelta > currentQty && currentQty >= 0

  return (
    <Stack spacing={2.5}>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'flex-end' }}
        spacing={2}
      >
        <Box>
          <Typography variant="overline" color="primary.main" fontWeight={750} letterSpacing="0.08em">
            INVENTORI & MUTASI
          </Typography>
          <Typography
            variant="h4"
            sx={{
              fontSize: { xs: '1.6rem', md: '2.1rem' },
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#0f172a',
              lineHeight: 1.2,
            }}
          >
            Manajemen Stok & Mutasi
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Buku mutasi barang masuk, barang keluar, dan saldo persediaan fisik per lokasi outlet.
          </Typography>
        </Box>

        {/* Header Action Buttons */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.25}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ width: { xs: '100%', md: 'auto' } }}
        >
          {locations.length > 1 && (
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
              <InputLabel id="select-location-filter">Filter Lokasi</InputLabel>
              <Select
                labelId="select-location-filter"
                value={selectedLocationId}
                label="Filter Lokasi"
                onChange={(e) => setSelectedLocationId(e.target.value)}
                sx={{ borderRadius: '8px', bgcolor: '#ffffff' }}
              >
                <MenuItem value="">Semua Lokasi</MenuItem>
                {locations.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {canRecordMovement ? (
            <>
              <Button
                variant="outlined"
                color="success"
                startIcon={<AddCircleOutlineOutlined />}
                onClick={() => handleOpenDialog('purchase_receipt')}
                sx={{
                  minHeight: 40,
                  px: 2,
                  borderRadius: '8px',
                  fontWeight: 750,
                  bgcolor: '#f0fdf4',
                  borderColor: '#86efac',
                  color: '#15803d',
                  '&:hover': { bgcolor: '#dcfce7', borderColor: '#4ade80' },
                }}
              >
                + Barang Masuk
              </Button>

              <Button
                variant="outlined"
                color="error"
                startIcon={<RemoveCircleOutlineOutlined />}
                onClick={() => handleOpenDialog('sale')}
                sx={{
                  minHeight: 40,
                  px: 2,
                  borderRadius: '8px',
                  fontWeight: 750,
                  bgcolor: '#fff1f2',
                  borderColor: '#fecdd3',
                  color: '#be123c',
                  '&:hover': { bgcolor: '#ffe4e6', borderColor: '#fda4af' },
                }}
              >
                - Barang Keluar
              </Button>

              <Button
                variant="contained"
                color="primary"
                startIcon={<SwapHorizOutlined />}
                onClick={() => handleOpenDialog('adjustment')}
                sx={{
                  minHeight: 40,
                  px: 2.25,
                  borderRadius: '8px',
                  fontWeight: 750,
                }}
              >
                Catat Pergerakan
              </Button>
            </>
          ) : (
            <Chip
              label="Mode Baca (Hanya Lihat)"
              size="small"
              variant="outlined"
              sx={{ fontWeight: 700, borderColor: '#cbd5e1', color: '#64748d' }}
            />
          )}
        </Stack>
      </Stack>

      {/* Tabs Switcher */}
      <Box sx={{ borderBottom: 1, borderColor: '#e2e8f0' }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          textColor="primary"
          indicatorColor="primary"
          sx={{
            minHeight: 44,
            '& .MuiTab-root': {
              minHeight: 44,
              py: 1,
              px: { xs: 1.5, sm: 2.5 },
              fontWeight: 750,
              fontSize: { xs: '0.85rem', sm: '0.92rem' },
              textTransform: 'none',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            },
          }}
        >
          <Tab
            icon={<WarehouseOutlined sx={{ fontSize: 18, mr: 0.5 }} />}
            iconPosition="start"
            label={`Saldo Stok Fisik (${stocks.length})`}
            value="balances"
          />
          <Tab
            icon={<HistoryOutlined sx={{ fontSize: 18, mr: 0.5 }} />}
            iconPosition="start"
            label={`Buku Mutasi Masuk & Keluar (${movements.length})`}
            value="movements"
          />
        </Tabs>
      </Box>

      {/* Metrics Bar */}
      {activeTab === 'balances' ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          <Box className="terminal-card" sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748d', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                  TOTAL SKU TERCATAT
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 850, color: '#0f172a', mt: 0.25, fontSize: '1.35rem', letterSpacing: '-0.025em' }} className="tnum">
                  {stockSummary.totalItems} Produk
                </Typography>
              </Box>
              <WarehouseOutlined sx={{ color: '#ff7a30', fontSize: 22 }} />
            </Stack>
          </Box>

          <Box className="terminal-card" sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748d', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                  STOK AMAN
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 850, color: '#047857', mt: 0.25, fontSize: '1.35rem', letterSpacing: '-0.025em' }} className="tnum">
                  {stockSummary.healthyStock} Item
                </Typography>
              </Box>
              <TrendingUpOutlined sx={{ color: '#10b981', fontSize: 22 }} />
            </Stack>
          </Box>

          <Box className="terminal-card" sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748d', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                  PERLU RESTOCK / MENIPIS
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 850,
                    color: stockSummary.lowStock > 0 ? '#dc2626' : '#0f172a',
                    mt: 0.25,
                    fontSize: '1.35rem',
                    letterSpacing: '-0.025em',
                  }}
                  className="tnum"
                >
                  {stockSummary.lowStock} Item
                </Typography>
              </Box>
              <TrendingDownOutlined sx={{ color: stockSummary.lowStock > 0 ? '#dc2626' : '#94a3b8', fontSize: 22 }} />
            </Stack>
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          <Box className="terminal-card" sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: '12px', bgcolor: '#f0fdf4' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#15803d', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                  TOTAL BARANG MASUK
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 850, color: '#15803d', mt: 0.25, fontSize: '1.35rem', letterSpacing: '-0.025em' }} className="tnum">
                  +{movementSummary.totalInbound.toLocaleString('id-ID')} unit
                </Typography>
              </Box>
              <TrendingUpOutlined sx={{ color: '#16a34a', fontSize: 22 }} />
            </Stack>
          </Box>

          <Box className="terminal-card" sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: '12px', bgcolor: '#fff1f2' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#be123c', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                  TOTAL BARANG KELUAR
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 850, color: '#be123c', mt: 0.25, fontSize: '1.35rem', letterSpacing: '-0.025em' }} className="tnum">
                  -{movementSummary.totalOutbound.toLocaleString('id-ID')} unit
                </Typography>
              </Box>
              <TrendingDownOutlined sx={{ color: '#e11d48', fontSize: 22 }} />
            </Stack>
          </Box>

          <Box className="terminal-card" sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748d', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                  FREKUENSI MUTASI TERCATAT
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 850, color: '#0f172a', mt: 0.25, fontSize: '1.35rem', letterSpacing: '-0.025em' }} className="tnum">
                  {movementSummary.totalCount} Pergerakan
                </Typography>
              </Box>
              <HistoryOutlined sx={{ color: '#ff7a30', fontSize: 22 }} />
            </Stack>
          </Box>
        </Box>
      )}

      {/* Loading state */}
      {status === 'loading' && (
        <Paper className="terminal-card" elevation={0} sx={{ p: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <RefreshOutlined className="loading-icon" />
          <Typography sx={{ fontWeight: 650, color: '#334155' }}>Memuat data stok inventori...</Typography>
        </Paper>
      )}

      {/* Error state */}
      {status === 'error' && (
        <Alert
          severity="error"
          sx={{ borderRadius: '10px' }}
          action={
            <Button color="inherit" size="small" startIcon={<RefreshOutlined />} onClick={loadData} sx={{ borderRadius: '8px' }}>
              Coba lagi
            </Button>
          }
        >
          {errorMessage || 'Data stok belum dapat dimuat. Pastikan API berjalan.'}
        </Alert>
      )}

      {/* TAB 1: SALDO STOK FISIK */}
      {status === 'success' && activeTab === 'balances' && (
        <>
          {stocks.length === 0 ? (
            <Paper
              className="terminal-card"
              elevation={0}
              sx={{
                p: { xs: 4, md: 6 },
                textAlign: 'center',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '12px',
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '10px',
                  bgcolor: '#f1f5f9',
                  color: '#64748d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <Inventory2Outlined sx={{ fontSize: 24 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 750, color: '#1e293b', mb: 1, fontSize: '1.1rem' }}>
                Belum ada saldo stok tercatat
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 480, mx: 'auto', mb: 3, lineHeight: 1.6 }}>
                Katalog dan lokasi telah siap. Catat pergerakan barang masuk (opening/pembelian) untuk mengisi saldo awal inventori.
              </Typography>
              {canRecordMovement && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SwapHorizOutlined />}
                  onClick={() => handleOpenDialog('opening')}
                  sx={{ px: 3, py: 1, borderRadius: '8px' }}
                >
                  Catat Saldo Awal
                </Button>
              )}
            </Paper>
          ) : (
            <Paper
              className="terminal-card"
              elevation={0}
              sx={{
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
              }}
            >
              <TableContainer>
                <Table aria-label="Tabel saldo stok">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 100 }}>SKU</TableCell>
                      <TableCell sx={{ minWidth: 260 }}>Nama Produk</TableCell>
                      <TableCell sx={{ minWidth: 140 }}>Lokasi</TableCell>
                      <TableCell align="right" sx={{ minWidth: 130 }}>
                        Saldo Fisik
                      </TableCell>
                      <TableCell align="right" sx={{ minWidth: 110 }}>
                        Batas Min.
                      </TableCell>
                      <TableCell align="center" sx={{ minWidth: 110 }}>
                        Status Stok
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stocks.map((s, idx) => {
                      const percentOfMin = s.minimum_stock > 0 ? Math.min(100, (s.quantity / (s.minimum_stock * 2)) * 100) : 100
                      return (
                        <TableRow
                          key={`${s.product_id}-${s.location_id}-${idx}`}
                          hover
                          sx={{
                            transition: 'background-color 0.15s ease',
                            '&:hover': { bgcolor: '#f8fafc' },
                            '&:last-child td, &:last-child th': { border: 0 },
                          }}
                        >
                          <TableCell component="th" scope="row">
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 750,
                                bgcolor: '#f1f5f9',
                                px: 1.25,
                                py: 0.35,
                                borderRadius: '8px',
                                display: 'inline-block',
                                fontSize: '0.82rem',
                                color: '#0f172a',
                                border: '1px solid rgba(203, 213, 225, 0.8)',
                                letterSpacing: '0.02em',
                              }}
                            >
                              {s.sku}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 750, color: '#0f172a', fontSize: '0.92rem', letterSpacing: '-0.015em' }}>
                              {s.product_name}
                            </Typography>
                            {s.minimum_stock > 0 && (
                              <Box sx={{ mt: 0.75, width: '80%', maxWidth: 160 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={percentOfMin}
                                  color={s.quantity <= s.minimum_stock ? 'warning' : 'primary'}
                                  sx={{ height: 4, borderRadius: 2 }}
                                />
                              </Box>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip label={s.location_name} size="small" variant="outlined" sx={{ fontWeight: 650 }} />
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 850,
                                fontSize: '0.96rem',
                                color: s.quantity <= s.minimum_stock ? '#dc2626' : '#0f172a',
                                fontFeatureSettings: '"tnum"',
                                letterSpacing: '-0.015em',
                              }}
                            >
                              {s.quantity} {s.base_unit}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ fontFeatureSettings: '"tnum"', fontWeight: 600, fontSize: '0.86rem' }}
                            >
                              {s.minimum_stock} {s.base_unit}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            {getStockStatus(s.quantity, s.minimum_stock)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </>
      )}

      {/* TAB 2: BUKU MUTASI STOK (MASUK & KELUAR) */}
      {status === 'success' && activeTab === 'movements' && (
        <Stack spacing={2}>
          {/* Movement Filters Bar */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: '100%' }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel id="movement-type-filter-label">Tipe Mutasi</InputLabel>
                <Select
                  labelId="movement-type-filter-label"
                  value={movementFilterType}
                  label="Tipe Mutasi"
                  onChange={(e) => setMovementFilterType(e.target.value)}
                  sx={{ borderRadius: '8px', bgcolor: '#ffffff' }}
                >
                  <MenuItem value="">Semua Tipe Mutasi</MenuItem>
                  <MenuItem value="purchase_receipt">Barang Masuk (Pembelian/Kulakan)</MenuItem>
                  <MenuItem value="opening">Saldo Awal</MenuItem>
                  <MenuItem value="sale">Barang Keluar (Penjualan)</MenuItem>
                  <MenuItem value="adjustment">Penyesuaian Fisik / Opname</MenuItem>
                  <MenuItem value="return">Retur Pelanggan</MenuItem>
                </Select>
              </FormControl>

              {products.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel id="movement-product-filter-label">Filter Produk</InputLabel>
                  <Select
                    labelId="movement-product-filter-label"
                    value={movementFilterProduct}
                    label="Filter Produk"
                    onChange={(e) => setMovementFilterProduct(e.target.value)}
                    sx={{ borderRadius: '8px', bgcolor: '#ffffff' }}
                  >
                    <MenuItem value="">Semua Produk</MenuItem>
                    {products.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.sku} - {p.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>

            {(movementFilterType || movementFilterProduct) && (
              <Button
                variant="text"
                size="small"
                onClick={() => {
                  setMovementFilterType('')
                  setMovementFilterProduct('')
                }}
                sx={{ textTransform: 'none', fontWeight: 700, color: '#64748d', whiteSpace: 'nowrap' }}
              >
                Reset Filter
              </Button>
            )}
          </Stack>

          {/* Movements Table */}
          {filteredMovements.length === 0 ? (
            <Paper
              className="terminal-card"
              elevation={0}
              sx={{
                p: { xs: 4, md: 5 },
                textAlign: 'center',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '12px',
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '10px',
                  bgcolor: '#f1f5f9',
                  color: '#64748d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 1.5,
                }}
              >
                <HistoryOutlined sx={{ fontSize: 24 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 750, color: '#1e293b', mb: 0.5, fontSize: '1.05rem' }}>
                Tidak ada riwayat mutasi stok ditemukan
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ maxWidth: 460, mx: 'auto', mb: 2.5 }}>
                {movementFilterType || movementFilterProduct
                  ? 'Tidak ada mutasi yang cocok dengan kriteria filter yang dipilih.'
                  : 'Belum ada transaksi barang masuk maupun barang keluar yang tercatat.'}
              </Typography>
              {canRecordMovement && (
                <Stack direction="row" spacing={1.5} justifyContent="center">
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<AddCircleOutlineOutlined />}
                    onClick={() => handleOpenDialog('purchase_receipt')}
                    sx={{ borderRadius: '8px', fontWeight: 700 }}
                  >
                    Catat Barang Masuk
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<RemoveCircleOutlineOutlined />}
                    onClick={() => handleOpenDialog('sale')}
                    sx={{ borderRadius: '8px', fontWeight: 700 }}
                  >
                    Catat Barang Keluar
                  </Button>
                </Stack>
              )}
            </Paper>
          ) : (
            <Paper
              className="terminal-card"
              elevation={0}
              sx={{
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
              }}
            >
              <TableContainer>
                <Table aria-label="Tabel buku mutasi stok">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 160 }}>Waktu Transaksi</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>Tipe Mutasi</TableCell>
                      <TableCell sx={{ minWidth: 100 }}>SKU</TableCell>
                      <TableCell sx={{ minWidth: 220 }}>Nama Produk</TableCell>
                      <TableCell sx={{ minWidth: 130 }}>Lokasi</TableCell>
                      <TableCell align="right" sx={{ minWidth: 140 }}>
                        Perubahan (Delta)
                      </TableCell>
                      <TableCell sx={{ minWidth: 200 }}>Alasan / Referensi</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredMovements.map((m) => {
                      const isPositive = m.quantity_delta > 0
                      const formattedTime = new Date(m.created_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })

                      return (
                        <TableRow
                          key={m.id}
                          hover
                          sx={{
                            transition: 'background-color 0.15s ease',
                            '&:hover': { bgcolor: '#f8fafc' },
                            '&:last-child td, &:last-child th': { border: 0 },
                          }}
                        >
                          <TableCell sx={{ fontFeatureSettings: '"tnum"', color: '#475569', fontSize: '0.85rem' }}>
                            {formattedTime}
                          </TableCell>
                          <TableCell>{getMovementBadge(m.movement_type)}</TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 750,
                                bgcolor: '#f1f5f9',
                                px: 1,
                                py: 0.25,
                                borderRadius: '6px',
                                display: 'inline-block',
                                fontSize: '0.8rem',
                                color: '#0f172a',
                                border: '1px solid rgba(203, 213, 225, 0.8)',
                              }}
                            >
                              {m.sku || 'SKU'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 750, color: '#0f172a', fontSize: '0.9rem' }}>
                              {m.product_name || `Produk ${m.product_id}`}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={m.location_name || 'Toko Utama'} size="small" variant="outlined" sx={{ fontWeight: 650 }} />
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 850,
                                fontSize: '0.95rem',
                                color: isPositive ? '#047857' : '#dc2626',
                                fontFeatureSettings: '"tnum"',
                                letterSpacing: '-0.015em',
                              }}
                            >
                              {isPositive ? `+${m.quantity_delta}` : `${m.quantity_delta}`} unit
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color={m.reason ? 'text.primary' : 'text.secondary'} sx={{ fontSize: '0.85rem' }}>
                              {m.reason || '-'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Stack>
      )}

      {/* Movement Recording Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        TransitionComponent={ModalSlideTransition}
        fullWidth
        maxWidth="sm"
        aria-labelledby="movement-title"
      >
        <Box component="form" onSubmit={handleSubmitMovement} noValidate>
          <DialogTitle
            id="movement-title"
            component="div"
            sx={{
              p: 2.5,
              pb: 1.5,
              pr: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em', fontSize: '1.15rem' }}>
                {movementType === 'purchase_receipt'
                  ? 'Catat Barang Masuk (Inbound)'
                  : movementType === 'sale'
                    ? 'Catat Barang Keluar (Outbound)'
                    : 'Catat Pergerakan Stok'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontSize: '0.8rem' }}>
                {movementType === 'sale'
                  ? 'Pencatatan barang keluar untuk penjualan offline, barang rusak, kadaluarsa, atau pemakaian toko.'
                  : movementType === 'purchase_receipt'
                    ? 'Penerimaan stok fisik dari pengiriman supplier, kulakan grosir, atau retur pelanggan.'
                    : 'Penyesuaian saldo fisik stok, opname, atau penetapan saldo awal inventori.'}
              </Typography>
            </Box>
            <IconButton
              aria-label="Tutup form"
              onClick={handleCloseDialog}
              sx={{ position: 'absolute', right: 12, top: 12, color: '#64748d' }}
            >
              <CloseOutlined fontSize="small" />
            </IconButton>
          </DialogTitle>

          <Divider sx={{ borderColor: 'rgba(226, 232, 240, 0.8)' }} />

          <DialogContent sx={{ p: 2.5 }}>
            <Stack spacing={2.25}>
              {submitError && (
                <Alert severity="error" role="alert" sx={{ borderRadius: '10px' }}>
                  {submitError}
                </Alert>
              )}

              {/* Product Selector */}
              <FormControl fullWidth required error={Boolean(fieldErrors.product_id)}>
                <InputLabel id="movement-product-select" shrink>
                  Pilih Produk / SKU
                </InputLabel>
                <Select
                  labelId="movement-product-select"
                  value={dialogProductId}
                  notched
                  label="Pilih Produk / SKU"
                  onChange={(e) => setDialogProductId(e.target.value)}
                  disabled={isSubmitting}
                  displayEmpty
                  renderValue={(selected) => {
                    if (!selected) {
                      return <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>-- Pilih Produk / SKU --</Typography>
                    }
                    const prod = products.find((p) => p.id === selected)
                    return prod ? `${prod.sku} - ${prod.name}` : selected
                  }}
                  sx={{ borderRadius: '8px' }}
                >
                  <MenuItem value="" disabled>
                    <em>-- Pilih Produk / SKU --</em>
                  </MenuItem>
                  {products.length === 0 ? (
                    <MenuItem value="" disabled>
                      Belum ada produk di toko ini.
                    </MenuItem>
                  ) : (
                    products.map((p) => {
                      const pStock = stocks.find(
                        (s) => s.product_id === p.id && (dialogLocationId ? s.location_id === dialogLocationId : true)
                      )
                      return (
                        <MenuItem key={p.id} value={p.id} sx={{ py: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 1.5 }}>
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                                {p.name}
                              </Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                SKU: {p.sku}
                              </Typography>
                            </Box>
                            <Chip
                              label={pStock ? `Stok: ${pStock.quantity} ${pStock.base_unit || 'unit'}` : 'Stok: 0 unit'}
                              size="small"
                              variant="outlined"
                              sx={{
                                fontWeight: 750,
                                fontSize: '0.72rem',
                                height: 22,
                                bgcolor: pStock && pStock.quantity > 0 ? '#f0fdf4' : '#fef2f2',
                                color: pStock && pStock.quantity > 0 ? '#15803d' : '#dc2626',
                                borderColor: pStock && pStock.quantity > 0 ? '#bbf7d0' : '#fecaca',
                              }}
                            />
                          </Box>
                        </MenuItem>
                      )
                    })
                  )}
                </Select>
                {fieldErrors.product_id && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                    {fieldErrors.product_id}
                  </Typography>
                )}
              </FormControl>

              {/* Live Stock Context Card */}
              {activeProduct && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.75,
                    borderRadius: '10px',
                    bgcolor: isOverStock ? '#fff1f2' : '#f8fafc',
                    borderColor: isOverStock ? '#fecdd3' : '#e2e8f0',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" sx={{ color: '#64748d', fontWeight: 700, letterSpacing: '0.04em' }}>
                        SALDO STOK SAAT INI ({activeLocation?.name || 'Toko Utama'})
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{ fontWeight: 850, color: '#0f172a', fontFeatureSettings: '"tnum"', fontSize: '1.05rem' }}
                      >
                        {currentQty} {unit}
                      </Typography>
                    </Box>

                    {parsedDelta > 0 && (
                      <>
                        <Typography sx={{ color: '#94a3b8', fontWeight: 800, fontSize: '1.1rem' }}>➔</Typography>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="caption" sx={{ color: '#64748d', fontWeight: 700, letterSpacing: '0.04em' }}>
                            {isOutbound ? 'ESTIMASI SISA STOK' : 'ESTIMASI STOK BARU'}
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{
                              fontWeight: 850,
                              color: isOverStock ? '#dc2626' : '#047857',
                              fontFeatureSettings: '"tnum"',
                              fontSize: '1.05rem',
                            }}
                          >
                            {projectedQty} {unit}
                          </Typography>
                        </Box>
                      </>
                    )}
                  </Stack>

                  {isOverStock && (
                    <Alert
                      severity="warning"
                      icon={<WarningAmberOutlined fontSize="small" />}
                      sx={{ mt: 1.25, py: 0.25, px: 1.5, borderRadius: '8px', fontSize: '0.8rem', bgcolor: '#fef3c7', color: '#92400e' }}
                    >
                      Peringatan: Jumlah keluar ({parsedDelta} {unit}) melebihi stok yang tercatat ({currentQty} {unit}).
                    </Alert>
                  )}
                </Paper>
              )}

              {/* Location Selector */}
              <FormControl fullWidth required error={Boolean(fieldErrors.location_id)}>
                <InputLabel id="movement-location-select" shrink>
                  Lokasi Inventori
                </InputLabel>
                <Select
                  labelId="movement-location-select"
                  value={dialogLocationId}
                  notched
                  label="Lokasi Inventori"
                  onChange={(e) => setDialogLocationId(e.target.value)}
                  disabled={isSubmitting}
                  sx={{ borderRadius: '8px' }}
                >
                  {locations.map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </MenuItem>
                  ))}
                </Select>
                {fieldErrors.location_id && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                    {fieldErrors.location_id}
                  </Typography>
                )}
              </FormControl>

              {/* Movement Type Selector */}
              <FormControl fullWidth required>
                <InputLabel id="movement-type-select" shrink>
                  Tipe Pergerakan
                </InputLabel>
                <Select
                  labelId="movement-type-select"
                  value={movementType}
                  notched
                  label="Tipe Pergerakan"
                  onChange={(e) => setMovementType(e.target.value as MovementType)}
                  disabled={isSubmitting}
                  sx={{ borderRadius: '8px' }}
                >
                  <MenuItem value="sale">Pengeluaran / Penjualan Manual</MenuItem>
                  <MenuItem value="purchase_receipt">Penerimaan Pembelian / Kulakan</MenuItem>
                  <MenuItem value="opening">Saldo Awal</MenuItem>
                  <MenuItem value="adjustment">Penyesuaian Fisik / Stok Opname</MenuItem>
                  <MenuItem value="return">Retur Pelanggan</MenuItem>
                </Select>
              </FormControl>

              {/* Quantity Field */}
              <Box>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label={
                    movementType === 'sale'
                      ? 'Jumlah Barang Keluar (Unit / Pcs)'
                      : movementType === 'purchase_receipt'
                        ? 'Jumlah Barang Masuk (Unit / Pcs)'
                        : 'Jumlah Delta Perubahan'
                  }
                  InputLabelProps={{ shrink: true }}
                  placeholder={movementType === 'sale' ? 'misal: 5' : 'misal: 10'}
                  value={quantityDelta}
                  onChange={(e) => setQuantityDelta(e.target.value)}
                  error={Boolean(fieldErrors.quantity_delta)}
                  helperText={
                    fieldErrors.quantity_delta ||
                    (movementType === 'sale'
                      ? 'Ketik jumlah unit yang dikeluarkan. Saldo stok fisik akan dipotong secara otomatis.'
                      : movementType === 'purchase_receipt'
                        ? 'Ketik jumlah unit barang masuk yang diterima ke toko.'
                        : 'Nilai positif menambah stok, nilai negatif mengurangi stok.')
                  }
                  disabled={isSubmitting}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
                {/* Quick Increment Chips */}
                <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650 }}>
                    Pilih Cepat:
                  </Typography>
                  {[1, 5, 10, 20, 50].map((num) => (
                    <Chip
                      key={num}
                      label={`+${num}`}
                      size="small"
                      clickable
                      onClick={() => {
                        const current = Number(quantityDelta) || 0
                        setQuantityDelta(String(current + num))
                      }}
                      sx={{
                        fontWeight: 750,
                        fontSize: '0.75rem',
                        height: 24,
                        bgcolor: '#f1f5f9',
                        '&:hover': { bgcolor: '#e2e8f0' },
                      }}
                    />
                  ))}
                  {Boolean(quantityDelta) && (
                    <Chip
                      label="Reset"
                      size="small"
                      clickable
                      onClick={() => setQuantityDelta('')}
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        height: 24,
                        color: '#dc2626',
                        bgcolor: '#fef2f2',
                        '&:hover': { bgcolor: '#fee2e2' },
                      }}
                    />
                  )}
                </Stack>
              </Box>

              {/* Reason / Reference Field */}
              <Box>
                <TextField
                  fullWidth
                  label="Alasan / Nomor Referensi (PO / Nota / Catatan)"
                  InputLabelProps={{ shrink: true }}
                  placeholder={
                    movementType === 'sale'
                      ? 'misal: Barang Rusak saat Display, Kadaluarsa, atau Penjualan Offline'
                      : 'misal: PO-2026-001, Kulakan Pasar Pagi, atau Retur Pembeli'
                  }
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isSubmitting}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
                {/* Quick Reason Chips */}
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  {(movementType === 'sale' ? OUTBOUND_REASONS : INBOUND_REASONS).map((preset) => (
                    <Chip
                      key={preset}
                      label={preset}
                      size="small"
                      clickable
                      onClick={() => setReason(preset)}
                      sx={{
                        fontWeight: 650,
                        fontSize: '0.72rem',
                        height: 24,
                        bgcolor: reason === preset ? '#eff6ff' : '#f8fafc',
                        color: reason === preset ? '#1d4ed8' : '#475569',
                        border: reason === preset ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                        '&:hover': { bgcolor: '#e0f2fe' },
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            </Stack>
          </DialogContent>

          <Divider sx={{ borderColor: 'rgba(226, 232, 240, 0.8)' }} />

          <DialogActions sx={{ p: 2, px: 2.5, gap: 1.5, bgcolor: '#f8fafc' }}>
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleCloseDialog}
              disabled={isSubmitting}
              sx={{ px: 2.5, borderRadius: '8px' }}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="contained"
              color={movementType === 'sale' ? 'error' : movementType === 'purchase_receipt' ? 'success' : 'primary'}
              disabled={isSubmitting}
              startIcon={movementType === 'sale' ? <RemoveCircleOutlineOutlined /> : <AddCircleOutlineOutlined />}
              aria-label="Simpan Pergerakan"
              sx={{
                px: 3,
                fontWeight: 800,
                borderRadius: '8px',
                bgcolor:
                  movementType === 'sale'
                    ? '#dc2626'
                    : movementType === 'purchase_receipt'
                      ? '#15803d'
                      : undefined,
                '&:hover': {
                  bgcolor:
                    movementType === 'sale'
                      ? '#b91c1c'
                      : movementType === 'purchase_receipt'
                        ? '#166534'
                        : undefined,
                },
              }}
            >
              {isSubmitting
                ? 'Menyimpan...'
                : movementType === 'sale'
                  ? parsedDelta > 0
                    ? `Keluarkan ${parsedDelta} ${unit}`
                    : 'Catat Barang Keluar'
                  : movementType === 'purchase_receipt'
                    ? parsedDelta > 0
                      ? `Terima +${parsedDelta} ${unit}`
                      : 'Catat Barang Masuk'
                    : 'Simpan Pergerakan'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  )
}
