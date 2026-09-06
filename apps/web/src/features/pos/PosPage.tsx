import { useEffect, useMemo, useState } from 'react'
import {
  AddOutlined,
  BookmarkBorderOutlined,
  CallSplitOutlined,
  CheckCircleOutline,
  CloseOutlined,
  DeleteOutline,
  LocalAtmOutlined,
  LocalOfferOutlined,
  LockOutlined,
  PauseCircleOutline,
  PercentOutlined,
  PlayCircleOutline,
  PointOfSaleOutlined,
  QrCode2Outlined,
  RefreshOutlined,
  RemoveOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  StorefrontOutlined,
  TuneOutlined,
} from '@mui/icons-material'
import { useAuth } from '../auth/authContext'
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardActionArea,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { getLocations, getStockBalances } from '../inventory/inventoryApi'
import type { InventoryLocation, ProductStockSummary } from '../inventory/inventoryApi'
import { getProducts } from '../products/productsApi'
import type { Product } from '../products/productsApi'
import { getCategories } from '../products/productsApi'
import type { Category } from '../products/productsApi'
import { createOrder } from './ordersApi'
import type { CreateOrderItemInput, OrderDetail } from './ordersApi'
import { getCurrentShift } from '../shifts/shiftsApi'
import type { Shift } from '../shifts/shiftsApi'
import { ModalSlideTransition } from '../../components/ModalSlideTransition'
import { PawLoading } from '../../components/PawLoading'
import {
  formatCurrency,
  formatNominalInput,
  formatThousand,
  parseThousand,
} from '../../utils/currency'

interface CartItem {
  product_id: string
  product_name: string
  sku: string
  unit_price_idr: number
  quantity: number
  available_stock: number
}

interface HeldCart {
  id: string
  label: string
  items: CartItem[]
  timestamp: string
  total: number
}

const formatRupiah = (amount: number) => formatCurrency(amount)

export function PosPage() {
  const { lockScreen } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [stocks, setStocks] = useState<ProductStockSummary[]>([])
  const [locations, setLocations] = useState<InventoryLocation[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>('loc-main')
  const [activeShift, setActiveShift] = useState<Shift | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])

  // Held Carts (Parkir Pesanan - Olsera Style)
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>(() => {
    try {
      const saved = localStorage.getItem('pawpos_held_carts')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [heldModalOpen, setHeldModalOpen] = useState(false)
  const [holdAlert, setHoldAlert] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem('pawpos_held_carts', JSON.stringify(heldCarts))
    } catch {}
  }, [heldCarts])

  // Checkout modal state
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'debit_card' | 'split'>('cash')
  const [paidAmount, setPaidAmount] = useState<number>(0)
  const [paidAmountInput, setPaidAmountInput] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // Discount state
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'nominal'>('none')
  const [discountValue, setDiscountValue] = useState<number>(0)
  const [discountModalOpen, setDiscountModalOpen] = useState(false)
  const [customDiscountInput, setCustomDiscountInput] = useState('')

  // Tax state
  const [taxEnabled, setTaxEnabled] = useState(false)
  const [taxRate] = useState<number>(11)

  // Split payment state
  const [splitCashTender, setSplitCashTender] = useState<number>(0)
  const [splitCashTenderInput, setSplitCashTenderInput] = useState<string>('')
  const [splitNonCashAmount, setSplitNonCashAmount] = useState<number>(0)
  const [splitNonCashAmountInput, setSplitNonCashAmountInput] = useState<string>('')

  // Receipt modal state
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<OrderDetail | null>(null)

  async function loadData() {
    setLoading(true)
    setLoadError(null)
    try {
      const [prodRes, stockRes, locRes, shiftRes, catRes] = await Promise.all([
        getProducts(),
        getStockBalances(selectedLocationId),
        getLocations(),
        getCurrentShift().catch(() => null),
        getCategories().catch(() => [] as Category[]),
      ])
      setProducts(prodRes.filter((p) => p.is_active))
      setCategories(catRes)
      setStocks(stockRes)
      setLocations(locRes)
      setActiveShift(shiftRes)
      if (locRes.length > 0 && !selectedLocationId) {
        setSelectedLocationId(locRes[0].id)
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat data kasir.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const handleTenant = () => loadData()
    const handleShift = () => {
      getCurrentShift()
        .then((s) => setActiveShift(s))
        .catch(() => {})
    }
    window.addEventListener('pawpos:tenant_change', handleTenant)
    window.addEventListener('pawpos:shift_change', handleShift)
    return () => {
      window.removeEventListener('pawpos:tenant_change', handleTenant)
      window.removeEventListener('pawpos:shift_change', handleShift)
    }
  }, [selectedLocationId])

  // Auto-lock terminal setelah 5 menit tanpa interaksi (anti-akses liar saat kasir tinggal)
  useEffect(() => {
    const IDLE_MS = 5 * 60 * 1000
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (!checkoutOpen && !receiptOpen) lockScreen()
      }, IDLE_MS)
    }
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart']
    events.forEach((ev) => window.addEventListener(ev, arm, { passive: true }))
    arm()
    return () => {
      if (timer) clearTimeout(timer)
      events.forEach((ev) => window.removeEventListener(ev, arm))
    }
  }, [checkoutOpen, receiptOpen, lockScreen])

  // Map of product ID to available quantity in current location
  const stockMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of stocks) {
      map.set(item.product_id, item.quantity)
    }
    return map
  }, [stocks])

  // Filtered product catalog by actual database category
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categories) {
      map.set(c.id, c.name)
    }
    return map
  }, [categories])

  const productCountByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      if (!p.category_id) continue
      map.set(p.category_id, (map.get(p.category_id) ?? 0) + 1)
    }
    return map
  }, [products])

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    let list = products

    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.category_id === selectedCategory)
    }

    if (!query) return list
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query),
    )
  }, [products, searchQuery, selectedCategory])

  // Cart financial calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.unit_price_idr * item.quantity, 0)
  }, [cart])

  const discountAmount = useMemo(() => {
    if (discountType === 'none' || discountValue <= 0) return 0
    if (discountType === 'percent') {
      return Math.min(Math.round((subtotal * discountValue) / 100), subtotal)
    }
    return Math.min(discountValue, subtotal)
  }, [subtotal, discountType, discountValue])

  const taxableAmount = Math.max(0, subtotal - discountAmount)

  const taxAmount = useMemo(() => {
    if (!taxEnabled) return 0
    return Math.round((taxableAmount * taxRate) / 100)
  }, [taxableAmount, taxEnabled])

  const total = taxableAmount + taxAmount

  const change = useMemo(() => {
    if (paymentMethod === 'cash') {
      if (paidAmount < total) return 0
      return paidAmount - total
    }
    if (paymentMethod === 'split') {
      const totalPaid = splitCashTender + splitNonCashAmount
      if (totalPaid < total) return 0
      return totalPaid - total
    }
    return 0
  }, [paymentMethod, paidAmount, splitCashTender, splitNonCashAmount, total])

  function handleHoldCart() {
    if (cart.length === 0) return
    const newHeld: HeldCart = {
      id: `hold-${Date.now()}`,
      label: `Antrean #${heldCarts.length + 1}`,
      items: [...cart],
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      total: total,
    }
    setHeldCarts((prev) => [newHeld, ...prev])
    setCart([])
    setHoldAlert(`Pesanan (${newHeld.label}) berhasil diparkir.`)
    setTimeout(() => setHoldAlert(null), 3500)
  }

  function handleResumeCart(held: HeldCart) {
    if (cart.length > 0) {
      const autoHeld: HeldCart = {
        id: `hold-${Date.now()}`,
        label: `Tukar Antrean #${heldCarts.length + 1}`,
        items: [...cart],
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        total: total,
      }
      setHeldCarts((prev) => [autoHeld, ...prev.filter((h) => h.id !== held.id)])
    } else {
      setHeldCarts((prev) => prev.filter((h) => h.id !== held.id))
    }
    setCart(held.items)
    setHeldModalOpen(false)
    setHoldAlert(`Pesanan (${held.label}) kembali aktif di kasir.`)
    setTimeout(() => setHoldAlert(null), 3500)
  }

  function handleDeleteHeldCart(id: string) {
    setHeldCarts((prev) => prev.filter((h) => h.id !== id))
  }

  function handleAddToCart(product: Product) {
    const currentStock = stockMap.get(product.id) ?? 0
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          unit_price_idr: product.selling_price_idr,
          quantity: 1,
          available_stock: currentStock,
        },
      ]
    })
  }

  function handleUpdateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta
            return newQty > 0 ? { ...item, quantity: newQty } : null
          }
          return item
        })
        .filter((item): item is CartItem => item !== null),
    )
  }

  function handleRemoveItem(productId: string) {
    setCart((prev) => prev.filter((item) => item.product_id !== productId))
  }

  function handleOpenCheckout() {
    if (cart.length === 0) return
    setPaidAmount(total)
    setPaidAmountInput(formatThousand(total))
    const half = Math.round(total / 2)
    setSplitCashTender(half)
    setSplitCashTenderInput(formatThousand(half))
    setSplitNonCashAmount(total - half)
    setSplitNonCashAmountInput(formatThousand(total - half))
    setNotes('')
    setCheckoutError(null)
    setCheckoutOpen(true)
  }

  async function handleConfirmPayment() {
    if (paymentMethod === 'cash' && paidAmount < total) {
      setCheckoutError('Uang tunai yang diterima kurang dari total tagihan.')
      return
    }
    if (paymentMethod === 'split') {
      if (splitCashTender + splitNonCashAmount < total) {
        setCheckoutError('Total pembayaran gabungan (Tunai + Non-Tunai) masih kurang dari tagihan.')
        return
      }
    }

    setSubmitting(true)
    setCheckoutError(null)

    try {
      const itemsPayload: CreateOrderItemInput[] = cart.map((c) => ({
        product_id: c.product_id,
        product_name: c.product_name,
        sku: c.sku,
        unit_price_idr: c.unit_price_idr,
        quantity: c.quantity,
      }))

      let paidTender = total
      let cashPortion: number | undefined
      let nonCashPortion: number | undefined

      if (paymentMethod === 'cash') {
        paidTender = paidAmount
        cashPortion = total
        nonCashPortion = 0
      } else if (paymentMethod === 'split') {
        paidTender = splitCashTender + splitNonCashAmount
        cashPortion = splitCashTender
        nonCashPortion = splitNonCashAmount
      } else {
        paidTender = total
        cashPortion = 0
        nonCashPortion = total
      }

      const res = await createOrder({
        location_id: selectedLocationId,
        payment_method: paymentMethod,
        paid_amount_idr: paidTender,
        cash_amount_idr: cashPortion,
        non_cash_amount_idr: nonCashPortion,
        tax_idr: taxAmount,
        discount_idr: discountAmount,
        notes: notes.trim() || undefined,
        items: itemsPayload,
      })

      setCompletedOrder(res)
      setCheckoutOpen(false)
      setCart([])
      setDiscountType('none')
      setDiscountValue(0)
      setReceiptOpen(true)
      // Refresh stock & shift
      getStockBalances(selectedLocationId).then(setStocks).catch(() => undefined)
      getCurrentShift().then(setActiveShift).catch(() => undefined)
      window.dispatchEvent(new CustomEvent('pawpos:shift_change'))
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Gagal memproses transaksi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack spacing={2}>
      {/* Search & Store Area (Section 6: height 44-48px, radius 10-12px, border tipis, shadow none) */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1.5,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ flex: 1, width: '100%' }}>
          <TextField
            fullWidth
            placeholder="Cari nama produk atau SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined sx={{ color: '#94a3b8', fontSize: 20 }} />
                  </InputAdornment>
                ),
                sx: {
                  bgcolor: 'background.paper',
                  borderRadius: '10px',
                  height: 44,
                },
              },
            }}
          />
        </Box>

        {/* Compact Store selector & Filter button */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ alignSelf: { xs: 'stretch', sm: 'auto' } }}>
          {locations.length > 0 && (
            <TextField
              select
              size="small"
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              sx={{
                minWidth: 140,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px',
                  bgcolor: 'background.paper',
                  height: 44,
                },
              }}
            >
              {locations.map((loc) => (
                <MenuItem key={loc.id} value={loc.id}>
                  {loc.name}
                </MenuItem>
              ))}
            </TextField>
          )}

          <Button
            variant="outlined"
            startIcon={<TuneOutlined sx={{ fontSize: 18 }} />}
            onClick={loadData}
            sx={{
              borderRadius: '10px',
              height: 44,
              px: 2,
              fontWeight: 650,
              fontSize: '0.85rem',
            }}
          >
            Filter
          </Button>

          {/* Olsera-style Cashier Screen Lock */}
          <Button
            variant="outlined"
            color="inherit"
            id="btn-pos-lock"
            startIcon={<LockOutlined sx={{ fontSize: 18 }} />}
            onClick={lockScreen}
            sx={{
              borderRadius: '10px',
              height: 44,
              px: 2,
              fontWeight: 650,
              fontSize: '0.85rem',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              whiteSpace: 'nowrap',
            }}
            title="Kunci layar terminal kasir (membutuhkan PIN untuk membuka kembali)"
          >
            Kunci Layar
          </Button>
        </Stack>
      </Box>

      {holdAlert && (
        <Alert severity="info" onClose={() => setHoldAlert(null)} sx={{ borderRadius: '10px' }}>
          {holdAlert}
        </Alert>
      )}

      {loadError && (
        <Alert severity="error" onClose={() => setLoadError(null)} sx={{ borderRadius: '10px' }}>
          {loadError}
        </Alert>
      )}

      {/* Cashier Shift Status Banner */}
      {!loading && !activeShift && (
        <Alert
          severity="warning"
          variant="outlined"
          sx={{
            borderRadius: '12px',
            bgcolor: '#fffbeb',
            borderColor: '#fde68a',
            color: '#92400e',
            '& .MuiAlert-icon': {
              alignSelf: { xs: 'flex-start', sm: 'center' },
              mt: { xs: 0.25, sm: 0 },
            },
            '& .MuiAlert-message': {
              width: '100%',
              p: 0,
            },
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            spacing={{ xs: 1.5, sm: 2 }}
          >
            <Typography
              variant="body2"
              sx={{
                color: '#92400e',
                fontSize: { xs: '0.84rem', sm: '0.88rem' },
                lineHeight: 1.5,
              }}
            >
              <strong>Shift Kasir Belum Dibuka:</strong> Sesi kasir saat ini belum aktif. Buka shift kasir untuk mencatat modal kas laci awal dan merekonsiliasi transaksi.
            </Typography>
            <Button
              href="/shifts"
              color="warning"
              size="small"
              variant="contained"
              sx={{
                borderRadius: '8px',
                fontWeight: 750,
                fontSize: '0.82rem',
                whiteSpace: 'nowrap',
                px: 2.25,
                py: 0.8,
                flexShrink: 0,
                boxShadow: 'none',
                width: { xs: '100%', sm: 'auto' },
                textAlign: 'center',
                textTransform: 'none',
              }}
            >
              Buka Shift Sekarang
            </Button>
          </Stack>
        </Alert>
      )}

      {!loading && activeShift && (
        <Paper
          elevation={0}
          sx={{
            px: 2,
            py: 1,
            borderRadius: '10px',
            bgcolor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap' }}>
            <span className="status-dot-active" />
            <Typography variant="body2" sx={{ fontWeight: 750, color: '#166534' }}>
              Shift Kasir Aktif: {activeShift.cashier_name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 600 }}>
              • Modal Awal: Rp {formatThousand(activeShift.starting_cash_idr)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 600 }}>
              • Penjualan Tunai Laci: Rp {formatThousand(activeShift.total_cash_sales_idr)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 600 }}>
              • Estimasi Kas Laci: Rp {formatThousand(activeShift.starting_cash_idr + activeShift.total_cash_sales_idr)}
            </Typography>
          </Stack>
          <Button
            href="/shifts"
            size="small"
            sx={{ fontWeight: 700, color: '#166534', p: 0, textDecoration: 'underline', fontSize: '0.78rem' }}
          >
            Kelola Shift Kasir
          </Button>
        </Paper>
      )}

      {/* Olsera-style Category Filter Chips Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          overflowX: 'auto',
          py: 0.5,
          px: 0.25,
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 4 },
        }}
      >
        {[{ id: 'all', name: 'Semua' }, ...categories].map((cat) => {
          const isSelected = selectedCategory === cat.id
          const count = cat.id === 'all' ? products.length : (productCountByCategory.get(cat.id) ?? 0)
          return (
            <Chip
              key={cat.id}
              label={`${cat.name} (${count})`}
              clickable
              onClick={() => setSelectedCategory(cat.id)}
              color={isSelected ? 'primary' : 'default'}
              variant={isSelected ? 'filled' : 'outlined'}
              sx={{
                fontWeight: isSelected ? 750 : 550,
                fontSize: '0.82rem',
                height: { xs: 44, sm: 34 },
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                borderColor: isSelected ? 'primary.main' : 'divider',
              }}
            />
          )
        })}
      </Box>

      {/* Main Operational Split Layout (Section 3: Product Grid & Cart Workspace) */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2.5,
          alignItems: 'flex-start',
        }}
      >
        {/* Left Pane: Dense Product Grid (Section 8 & 9) */}
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          {loading ? (
            <PawLoading label="Memuat katalog kasir..." variant="card" />
          ) : filteredProducts.length === 0 ? (
            <Paper className="terminal-card" sx={{ p: 5, textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
              <StorefrontOutlined sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5, fontSize: '1rem' }}>
                Tidak ada produk ditemukan
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                Coba sesuaikan kata kunci pencarian Anda.
              </Typography>
            </Paper>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(auto-fill, minmax(240px, 1fr))',
                },
                gap: 1.75,
              }}
            >
              {filteredProducts.map((p) => {
                const stock = stockMap.get(p.id) ?? 0
                const isOutOfStock = stock <= 0
                const cartItem = cart.find((it) => it.product_id === p.id)
                const isSelected = Boolean(cartItem)

                return (
                  <Card
                    key={p.id}
                    variant="outlined"
                    className={`terminal-card-hover ${isSelected ? 'terminal-selected' : ''}`}
                    sx={{
                      p: 1.5,
                      opacity: isOutOfStock ? 0.65 : 1,
                      cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderRadius: '12px',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                      transition: 'border-color 120ms ease, background-color 120ms ease',
                    }}
                    onClick={() => !isOutOfStock && handleAddToCart(p)}
                  >
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                      {/* Product Thumbnail (Square ratio container) */}
                      <Box
                        sx={{
                          width: 64,
                          height: 64,
                          borderRadius: '10px',
                          bgcolor: 'background.default',
                          border: '1px solid',
                          borderColor: 'divider',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          overflow: 'hidden',
                          filter: isOutOfStock ? 'grayscale(0.7)' : 'none',
                        }}
                      >
                        {p.image_url ? (
                          <Box
                            component="img"
                            src={
                              p.image_url.startsWith('http')
                                ? p.image_url
                                : `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'}${p.image_url}`
                            }
                            alt={p.name}
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              p: 0.25,
                            }}
                          />
                        ) : (
                          <StorefrontOutlined sx={{ fontSize: 24, color: '#cbd5e1' }} />
                        )}
                      </Box>

                      {/* Product Details (Section 16: Typography Hierarchy) */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 750,
                            color: isOutOfStock ? 'text.secondary' : 'text.primary',
                            fontSize: '0.92rem',
                            lineHeight: 1.3,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            letterSpacing: '-0.015em',
                          }}
                        >
                          {p.name}
                        </Typography>

                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 850,
                            color: isOutOfStock ? '#94a3b8' : '#ea580c',
                            fontSize: '1.02rem',
                            mt: 0.35,
                            letterSpacing: '-0.02em',
                            lineHeight: 1.2,
                          }}
                          className="tnum"
                        >
                          {formatRupiah(p.selling_price_idr)}
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, overflow: 'hidden' }}>
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: '0.74rem',
                              color: 'text.secondary',
                              fontWeight: 650,
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              letterSpacing: '0.01em',
                            }}
                          >
                            {p.sku}
                          </Typography>
                          {p.category_id && categoryNameById.get(p.category_id) && (
                            <>
                              <Typography variant="caption" sx={{ color: '#cbd5e1', fontSize: '0.72rem', flexShrink: 0 }}>
                                •
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  fontSize: '0.72rem',
                                  color: 'warning.main',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                  textOverflow: 'ellipsis',
                                  overflow: 'hidden',
                                }}
                              >
                                {categoryNameById.get(p.category_id)}
                              </Typography>
                            </>
                          )}
                          <Typography variant="caption" sx={{ color: '#cbd5e1', fontSize: '0.72rem', flexShrink: 0 }}>
                            •
                          </Typography>
                          {isOutOfStock ? (
                            <Chip
                              label="Habis"
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                bgcolor: '#fee2e2',
                                color: '#dc2626',
                                borderRadius: '4px',
                                flexShrink: 0,
                                px: 0.5,
                              }}
                            />
                          ) : (
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: '0.74rem',
                                color: stock <= (p.minimum_stock ?? 2) ? 'warning.main' : 'text.secondary',
                                fontWeight: stock <= (p.minimum_stock ?? 2) ? 800 : 600,
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                              className="tnum"
                            >
                              Sisa {stock} {p.base_unit}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>

                    {/* Bottom Action Area */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        pt: 1.25,
                        mt: 1.25,
                        borderTop: '1px solid #f1f5f9',
                        minHeight: 36,
                      }}
                    >
                      {cartItem ? (
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflow: 'hidden' }}>
                            <CheckCircleOutline sx={{ fontSize: 16, color: '#ff7a30', flexShrink: 0 }} />
                            <Typography
                              sx={{
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                color: '#ea580c',
                                whiteSpace: 'nowrap',
                              }}
                              className="tnum"
                            >
                              {cartItem.quantity} di keranjang
                            </Typography>
                          </Box>

                          <Box
                            className="terminal-stepper"
                            onClick={(e) => e.stopPropagation()}
                            sx={{
                              bgcolor: 'background.default',
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: '8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              p: '2px 4px',
                              flexShrink: 0,
                            }}
                          >
                            <IconButton
                              size="small"
                              aria-label={`Kurangi ${p.name}`}
                              onClick={() => handleUpdateQuantity(p.id, -1)}
                              sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: '#ef4444' } }}
                            >
                              <RemoveOutlined sx={{ fontSize: 13 }} />
                            </IconButton>
                            <Typography
                              sx={{
                                px: 0.75,
                                fontSize: '0.84rem',
                                fontWeight: 850,
                                color: 'text.primary',
                                minWidth: 18,
                                textAlign: 'center',
                              }}
                              className="tnum"
                            >
                              {cartItem.quantity}
                            </Typography>
                            <IconButton
                              size="small"
                              aria-label={`Tambah ${p.name}`}
                              onClick={() => handleAddToCart(p)}
                              disabled={isOutOfStock}
                              sx={{ p: 0.25, color: '#ff7a30', '&:hover': { bgcolor: '#fff7f2' } }}
                            >
                              <AddOutlined sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Box>
                        </>
                      ) : isOutOfStock ? (
                        <>
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                            Tidak dapat dipesan
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled
                            sx={{
                              borderRadius: '8px',
                              px: 1.5,
                              py: 0.35,
                              minHeight: 28,
                              fontSize: '0.74rem',
                              fontWeight: 650,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Stok Habis
                          </Button>
                        </>
                      ) : (
                        <>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                            Tersedia {stock} {p.base_unit}
                          </Typography>

                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAddToCart(p)
                            }}
                            sx={{
                              borderRadius: '8px',
                              px: 1.5,
                              py: 0.35,
                              minHeight: 28,
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              borderColor: 'divider',
                              color: 'text.secondary',
                              transition: 'all 120ms ease',
                              '&:hover': {
                                borderColor: '#ff8042',
                                color: '#ff8042',
                                bgcolor: '#fff7f2',
                              },
                            }}
                          >
                            + Tambah
                          </Button>
                        </>
                      )}
                    </Box>
                  </Card>
                )
              })}
            </Box>
          )}
        </Box>

        {/* Right Pane: Cart Workspace (Section 11 & 12: radius 14px, border 1px, shadow none) */}
        <Box
          sx={{
            flex: { xs: '1 1 100%', md: '0 0 380px' },
            width: { xs: '100%', md: 380 },
          }}
        >
          <Paper
            elevation={0}
            className="terminal-card"
            sx={{
              p: 2,
              position: { xs: 'relative', md: 'sticky' },
              top: { xs: 'auto', md: 76 },
              display: 'flex',
              flexDirection: 'column',
              minHeight: 460,
              borderRadius: '14px',
            }}
          >
            {/* Cart Header */}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <ShoppingCartOutlined sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 850, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
                  Keranjang ({cart.reduce((a, b) => a + b.quantity, 0)})
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                {cart.length > 0 && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<BookmarkBorderOutlined sx={{ fontSize: 16 }} />}
                    onClick={handleHoldCart}
                    sx={{
                      fontSize: '0.72rem',
                      py: 0.35,
                      px: 0.9,
                      fontWeight: 700,
                      borderRadius: '6px',
                      borderColor: 'divider',
                    }}
                    title="Parkir pesanan aktif untuk antrean berikutnya"
                  >
                    Parkir
                  </Button>
                )}
                {heldCarts.length > 0 && (
                  <Button
                    size="small"
                    variant="contained"
                    color="warning"
                    startIcon={<PlayCircleOutline sx={{ fontSize: 16 }} />}
                    onClick={() => setHeldModalOpen(true)}
                    sx={{
                      fontSize: '0.72rem',
                      py: 0.35,
                      px: 0.9,
                      fontWeight: 750,
                      borderRadius: '6px',
                    }}
                  >
                    Parkir ({heldCarts.length})
                  </Button>
                )}
                {cart.length > 0 && (
                  <Button
                    size="small"
                    color="error"
                    onClick={() => setCart([])}
                    sx={{ fontSize: '0.74rem', p: 0.4, fontWeight: 700 }}
                  >
                    Kosongkan
                  </Button>
                )}
              </Stack>
            </Stack>

            {/* Cart Items List */}
            <Box sx={{ flex: 1, my: 1.5, overflowY: 'auto', maxHeight: 330, pr: 0.25 }}>
              {cart.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <PointOfSaleOutlined sx={{ fontSize: 38, color: '#cbd5e1', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 220, mx: 'auto', fontSize: '0.84rem' }}>
                    Keranjang transaksi masih kosong. Klik produk di sebelah kiri untuk menambahkan.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1}>
                  {cart.map((item) => (
                    <Box
                      key={item.product_id}
                      sx={{
                        p: 1.25,
                        borderRadius: '10px',
                        bgcolor: 'background.default',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ flex: 1, pr: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 750, color: 'text.primary', lineHeight: 1.25, fontSize: '0.88rem' }}>
                            {item.product_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" className="tnum" sx={{ fontSize: '0.74rem', fontWeight: 600 }}>
                            {item.quantity} × {formatRupiah(item.unit_price_idr)}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          color="default"
                          aria-label={`Hapus ${item.product_name}`}
                          onClick={() => handleRemoveItem(item.product_id)}
                          sx={{ color: '#94a3b8', p: 0.25, '&:hover': { color: '#dc2626' } }}
                        >
                          <DeleteOutline sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Stack>

                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                        <Box className="terminal-stepper">
                          <IconButton
                            size="small"
                            aria-label={`Kurangi ${item.product_name}`}
                            onClick={() => handleUpdateQuantity(item.product_id, -1)}
                            sx={{ p: 0.25 }}
                          >
                            <RemoveOutlined sx={{ fontSize: 14 }} />
                          </IconButton>
                          <Typography sx={{ px: 1, fontWeight: 850, color: 'text.primary', fontSize: '0.82rem' }} className="tnum">
                            {item.quantity}
                          </Typography>
                          <IconButton
                            size="small"
                            aria-label={`Tambah ${item.product_name}`}
                            onClick={() => handleUpdateQuantity(item.product_id, 1)}
                            sx={{ p: 0.25, color: '#ff7a30' }}
                          >
                            <AddOutlined sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>

                        <Typography variant="subtitle2" sx={{ fontWeight: 850, color: 'text.primary', fontSize: '0.92rem', letterSpacing: '-0.02em' }} className="tnum">
                          {formatRupiah(item.unit_price_idr * item.quantity)}
                        </Typography>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            {/* Financial Summary */}
            <Divider sx={{ my: 0.75, borderColor: 'divider' }} />
            <Stack spacing={0.75} sx={{ pt: 0.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.86rem', fontWeight: 550 }}>
                  Subtotal
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary' }} className="tnum">
                  {formatRupiah(subtotal)}
                </Typography>
              </Stack>

              {/* Discount Row */}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.84rem' }}>
                    Diskon {discountType === 'percent' ? `(${discountValue}%)` : ''}
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<LocalOfferOutlined sx={{ fontSize: 13 }} />}
                    onClick={() => {
                      setCustomDiscountInput(discountType === 'nominal' ? formatThousand(discountValue) : '')
                      setDiscountModalOpen(true)
                    }}
                    sx={{
                      fontSize: '0.72rem',
                      py: 0.2,
                      px: 0.75,
                      minHeight: 22,
                      fontWeight: 700,
                      borderRadius: '6px',
                      color: discountAmount > 0 ? '#dc2626' : '#64748d',
                      bgcolor: discountAmount > 0 ? '#fef2f2' : '#f1f5f9',
                    }}
                  >
                    {discountAmount > 0 ? 'Ubah' : '+ Diskon'}
                  </Button>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 750,
                    color: discountAmount > 0 ? '#dc2626' : '#94a3b8',
                  }}
                  className="tnum"
                >
                  {discountAmount > 0 ? `- ${formatRupiah(discountAmount)}` : 'Rp 0'}
                </Typography>
              </Stack>

              {/* Tax PPN 11% Row */}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.84rem' }}>
                    Pajak PPN (11%)
                  </Typography>
                  <Switch
                    size="small"
                    checked={taxEnabled}
                    onChange={(e) => setTaxEnabled(e.target.checked)}
                    inputProps={{ 'aria-label': 'Pajak PPN 11%' }}
                    sx={{ transform: 'scale(0.8)' }}
                  />
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 750,
                    color: taxEnabled ? 'text.primary' : 'text.disabled',
                  }}
                  className="tnum"
                >
                  {taxEnabled ? `+ ${formatRupiah(taxAmount)}` : 'Non-aktif'}
                </Typography>
              </Stack>

              <Divider sx={{ my: 0.25, borderColor: '#f1f5f9' }} />

              <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ pt: 0.25 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 850, color: 'text.primary', fontSize: '1.02rem', letterSpacing: '-0.02em' }}>
                  Total Tagihan
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 850,
                    color: '#ea580c',
                    letterSpacing: '-0.035em',
                    fontSize: '1.45rem',
                  }}
                  className="tnum"
                >
                  {formatRupiah(total)}
                </Typography>
              </Stack>
            </Stack>

            {/* Checkout Action Button (Primary Conversion Action - Section 12) */}
            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={<LocalAtmOutlined />}
              disabled={cart.length === 0}
              onClick={handleOpenCheckout}
              sx={{
                mt: 1.75,
                py: 1.25,
                fontSize: '0.98rem',
                fontWeight: 800,
                borderRadius: '10px',
                letterSpacing: '-0.01em',
              }}
            >
              Bayar Sekarang
            </Button>
          </Paper>
        </Box>
      </Box>

      {/* Modal Settlement Pembayaran */}
      <Dialog
        open={checkoutOpen}
        onClose={() => !submitting && setCheckoutOpen(false)}
        TransitionComponent={ModalSlideTransition}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          component="div"
          sx={{
            p: 2.5,
            pb: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 850, color: 'text.primary', fontSize: '1.2rem', letterSpacing: '-0.025em' }}>
              Penyelesaian Pembayaran
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem', fontWeight: 550 }}>
              Pilih metode transaksi dan selesaikan pelunasan pesanan kasir
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setCheckoutOpen(false)}
            disabled={submitting}
            sx={{ color: 'text.secondary' }}
          >
            <CloseOutlined fontSize="small" />
          </IconButton>
        </DialogTitle>

        <Divider sx={{ borderColor: '#e2e8f0' }} />

        <DialogContent sx={{ p: 2.5 }}>
          <Stack spacing={2.25}>
            {checkoutError && (
              <Alert severity="error" sx={{ borderRadius: '8px' }}>
                {checkoutError}
              </Alert>
            )}

            {/* Big Total Display */}
            <Box
              sx={{
                p: 2.5,
                textAlign: 'center',
                borderRadius: '12px',
                bgcolor: '#fff7ed',
                border: '1.5px solid #fed7aa',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '0.08em', color: '#9a3412', display: 'block' }}>
                TOTAL YANG HARUS DIBAYAR
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 850,
                  color: '#ea580c',
                  mt: 0.5,
                  fontSize: '2.1rem',
                  letterSpacing: '-0.035em',
                }}
                className="tnum"
              >
                {formatRupiah(total)}
              </Typography>
              {(discountAmount > 0 || taxAmount > 0) && (
                <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1 }}>
                  {discountAmount > 0 && (
                    <Chip
                      size="small"
                      label={`Diskon -${formatRupiah(discountAmount)}`}
                      sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 700, fontSize: '0.72rem' }}
                    />
                  )}
                  {taxAmount > 0 && (
                    <Chip
                      size="small"
                      label={`PPN 11% +${formatRupiah(taxAmount)}`}
                      sx={{ bgcolor: '#e0e7ff', color: '#3730a3', fontWeight: 700, fontSize: '0.72rem' }}
                    />
                  )}
                </Stack>
              )}
            </Box>

            {/* Payment Method Selector */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.75, fontWeight: 750, color: 'text.primary', fontSize: '0.85rem' }}>
                Metode Pembayaran
              </Typography>
              <Tabs
                value={paymentMethod}
                onChange={(_, val) => setPaymentMethod(val)}
                variant="fullWidth"
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '10px',
                  bgcolor: 'background.default',
                }}
              >
                <Tab icon={<LocalAtmOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Tunai" value="cash" sx={{ fontWeight: 700 }} />
                <Tab icon={<QrCode2Outlined sx={{ fontSize: 18 }} />} iconPosition="start" label="QRIS" value="qris" sx={{ fontWeight: 700 }} />
                <Tab icon={<PointOfSaleOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Debit" value="debit_card" sx={{ fontWeight: 700 }} />
                <Tab icon={<CallSplitOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Split" value="split" sx={{ fontWeight: 700 }} />
              </Tabs>
            </Box>

            {/* Payment Input based on method */}
            {paymentMethod === 'split' ? (
              <Stack spacing={2}>
                <Box
                  sx={{
                    p: 1.75,
                    borderRadius: '10px',
                    bgcolor: 'success.light',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'success.main', mb: 0.25, fontSize: '0.86rem' }}>
                    Pembayaran Gabungan (Split Payment)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    Alokasikan porsi tagihan antara Tunai di laci kas dan QRIS / Non-Tunai.
                  </Typography>
                </Box>

                <Stack spacing={1.75}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 750, color: 'text.primary' }}>
                        1. Porsi Uang Tunai (Cash)
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => {
                          const half = Math.round(total / 2)
                          setSplitCashTender(half)
                          setSplitCashTenderInput(formatThousand(half))
                          setSplitNonCashAmount(total - half)
                          setSplitNonCashAmountInput(formatThousand(total - half))
                        }}
                        sx={{ fontSize: '0.72rem', p: 0, fontWeight: 700 }}
                      >
                        Bagi Rata (50%)
                      </Button>
                    </Box>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="0"
                      value={splitCashTenderInput}
                      onChange={(e) => {
                        const formatted = formatNominalInput(e.target.value)
                        const val = parseThousand(formatted)
                        setSplitCashTenderInput(formatted)
                        setSplitCashTender(val)
                        if (val <= total) {
                          const rem = total - val
                          setSplitNonCashAmount(rem)
                          setSplitNonCashAmountInput(formatThousand(rem))
                        }
                      }}
                      slotProps={{
                        input: {
                          startAdornment: <InputAdornment position="start">Rp</InputAdornment>,
                          inputMode: 'numeric',
                          sx: { fontWeight: 750 },
                        },
                      }}
                    />
                  </Box>

                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 750, color: 'text.primary' }}>
                        2. Porsi QRIS / Non-Tunai
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => {
                          const rem = Math.max(0, total - splitCashTender)
                          setSplitNonCashAmount(rem)
                          setSplitNonCashAmountInput(formatThousand(rem))
                        }}
                        sx={{ fontSize: '0.72rem', p: 0, fontWeight: 700 }}
                      >
                        Isi Sisa Tagihan
                      </Button>
                    </Box>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="0"
                      value={splitNonCashAmountInput}
                      onChange={(e) => {
                        const formatted = formatNominalInput(e.target.value)
                        const val = parseThousand(formatted)
                        setSplitNonCashAmountInput(formatted)
                        setSplitNonCashAmount(val)
                      }}
                      slotProps={{
                        input: {
                          startAdornment: <InputAdornment position="start">Rp</InputAdornment>,
                          inputMode: 'numeric',
                          sx: { fontWeight: 750 },
                        },
                      }}
                    />
                  </Box>
                </Stack>

                {/* Realtime Reconciliation Balance Status */}
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: '10px',
                    bgcolor: splitCashTender + splitNonCashAmount >= total ? 'success.light' : 'error.light',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 750,
                          color: splitCashTender + splitNonCashAmount >= total ? 'success.main' : 'error.main',
                          fontSize: '0.85rem',
                        }}
                      >
                        {splitCashTender + splitNonCashAmount >= total ? 'Status: Lunas & Terverifikasi' : 'Status: Kurang Bayar'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {splitCashTender + splitNonCashAmount >= total
                          ? `Kembalian Tunai: ${formatRupiah(Math.max(0, splitCashTender + splitNonCashAmount - total))}`
                          : `Kekurangan: ${formatRupiah(total - (splitCashTender + splitNonCashAmount))}`}
                      </Typography>
                    </Box>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 850,
                        color: splitCashTender + splitNonCashAmount >= total ? 'success.main' : 'error.main',
                      }}
                      className="tnum"
                    >
                      {formatRupiah(splitCashTender + splitNonCashAmount)} / {formatRupiah(total)}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            ) : paymentMethod === 'cash' ? (
              <Stack spacing={1.5}>
                <TextField
                  fullWidth
                  label="Jumlah Diterima (Rp)"
                  placeholder="0"
                  value={paidAmountInput}
                  onChange={(e) => {
                    const formatted = formatNominalInput(e.target.value)
                    setPaidAmountInput(formatted)
                    setPaidAmount(parseThousand(formatted))
                  }}
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">Rp</InputAdornment>,
                      inputMode: 'numeric',
                      sx: { fontWeight: 800, fontSize: '1.15rem' },
                    },
                  }}
                />

                {/* Quick denomination buttons */}
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setPaidAmount(total)
                      setPaidAmountInput(formatThousand(total))
                    }}
                    sx={{ fontWeight: 750, borderRadius: '8px', fontSize: '0.78rem' }}
                  >
                    Uang Pas ({formatRupiah(total)})
                  </Button>
                  {[20000, 50000, 100000].map(
                    (denom) =>
                      denom >= total && (
                        <Button
                          key={denom}
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setPaidAmount(denom)
                            setPaidAmountInput(formatThousand(denom))
                          }}
                          sx={{ fontWeight: 750, borderRadius: '8px', fontSize: '0.78rem' }}
                        >
                          {formatRupiah(denom)}
                        </Button>
                      ),
                  )}
                </Stack>

                {/* Change calculation */}
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: '10px',
                    bgcolor: paidAmount >= total ? '#ecfdf5' : '#f8fafc',
                    border: '1px solid',
                    borderColor: paidAmount >= total ? '#a7f3d0' : '#e2e8f0',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" sx={{ fontWeight: 750, color: paidAmount >= total ? 'success.main' : 'text.secondary', fontSize: '0.9rem' }}>
                      Kembalian
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 850,
                        color: paidAmount >= total ? 'success.main' : 'text.primary',
                        fontSize: '1.35rem',
                        letterSpacing: '-0.02em',
                      }}
                      className="tnum"
                    >
                      {formatRupiah(change)}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            ) : (
              <Box sx={{ p: 2, textAlign: 'center', borderRadius: '10px', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary">
                  {paymentMethod === 'qris'
                    ? 'Tunjukkan QRIS dinamis pada layar pelanggan atau terminal EDC.'
                    : 'Gesek atau masukkan kartu debit pelanggan pada mesin EDC kasir.'}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#ff8042', mt: 0.5 }} className="tnum">
                  {formatRupiah(total)}
                </Typography>
              </Box>
            )}

            <TextField
              fullWidth
              size="small"
              label="Catatan Transaksi (Opsional)"
              placeholder="misal: Meja 4, take-away, diskon voucher"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Stack>
        </DialogContent>

        <Divider sx={{ borderColor: '#e2e8f0' }} />

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setCheckoutOpen(false)}
            disabled={submitting}
            sx={{ px: 2, borderRadius: '8px' }}
          >
            Batal
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirmPayment}
            disabled={
              submitting ||
              (paymentMethod === 'cash' && paidAmount < total) ||
              (paymentMethod === 'split' && splitCashTender + splitNonCashAmount < total)
            }
            sx={{ px: 3, borderRadius: '8px' }}
          >
            {submitting ? 'Memproses Transaksi...' : 'Selesaikan Transaksi'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Diskon Keranjang */}
      <Dialog
        open={discountModalOpen}
        onClose={() => setDiscountModalOpen(false)}
        TransitionComponent={ModalSlideTransition}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle
          component="div"
          sx={{
            p: 2.5,
            pb: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 850, color: 'text.primary', fontSize: '1.1rem' }}>
              Pilih / Pasang Diskon
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Terapkan potongan harga persentase atau nominal rupiah
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setDiscountModalOpen(false)} sx={{ color: 'text.secondary' }}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        </DialogTitle>
        <Divider sx={{ borderColor: '#e2e8f0' }} />
        <DialogContent sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle2" sx={{ fontWeight: 750, color: 'text.primary', fontSize: '0.85rem' }}>
              Pintasan Diskon Persentase
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
              {[5, 10, 15, 20].map((pct) => (
                <Button
                  key={pct}
                  variant={discountType === 'percent' && discountValue === pct ? 'contained' : 'outlined'}
                  onClick={() => {
                    setDiscountType('percent')
                    setDiscountValue(pct)
                    setDiscountModalOpen(false)
                  }}
                  sx={{ fontWeight: 800, borderRadius: '8px', py: 1 }}
                >
                  {pct}%
                </Button>
              ))}
            </Box>

            <Divider sx={{ my: 0.5, borderColor: '#f1f5f9' }} />

            <Typography variant="subtitle2" sx={{ fontWeight: 750, color: 'text.primary', fontSize: '0.85rem' }}>
              Atau Masukkan Diskon Nominal (Rp)
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Contoh: 10.000"
              value={customDiscountInput}
              onChange={(e) => setCustomDiscountInput(formatNominalInput(e.target.value))}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">Rp</InputAdornment>,
                  inputMode: 'numeric',
                  sx: { fontWeight: 750 },
                },
              }}
            />

            <Button
              variant="contained"
              disabled={!parseThousand(customDiscountInput)}
              onClick={() => {
                const val = parseThousand(customDiscountInput)
                if (val > 0) {
                  setDiscountType('nominal')
                  setDiscountValue(val)
                  setDiscountModalOpen(false)
                }
              }}
              sx={{ borderRadius: '8px', fontWeight: 750 }}
            >
              Terapkan Diskon Nominal
            </Button>

            {discountAmount > 0 && (
              <Button
                color="error"
                variant="text"
                onClick={() => {
                  setDiscountType('none')
                  setDiscountValue(0)
                  setDiscountModalOpen(false)
                }}
                sx={{ fontWeight: 700, fontSize: '0.82rem' }}
              >
                Hapus / Batalkan Diskon
              </Button>
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Modal Digital Thermal Receipt */}
      <Dialog
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        TransitionComponent={ModalSlideTransition}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle
          component="div"
          sx={{
            textAlign: 'center',
            pt: 2.25,
            pb: 1,
          }}
        >
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              bgcolor: '#ecfdf5',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 1,
              border: '1px solid #a7f3d0',
            }}
          >
            <CheckCircleOutline sx={{ fontSize: 22 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '1.05rem' }}>
            Transaksi Berhasil
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Struk digital telah tercatat pada ledger operasional
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ px: 2.25, pb: 2 }}>
          {completedOrder && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '10px',
                bgcolor: 'background.default',
                border: '1px dashed',
                borderColor: 'divider',
                fontFamily: 'monospace',
              }}
            >
              <Box sx={{ textAlign: 'center', pb: 1, borderBottom: '1px dashed', borderColor: 'divider', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#ff8042' }}>
                  PURR'COFFEE POS
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Terminal Register #01
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 750,
                    color: 'text.primary',
                    mt: 0.5,
                  }}
                >
                  {completedOrder.order_number}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(completedOrder.created_at).toLocaleString('id-ID')}
                </Typography>
              </Box>

              {/* Items List */}
              <Stack spacing={0.75} sx={{ mb: 1.25 }}>
                {completedOrder.items.map((it) => (
                  <Stack key={it.id} direction="row" justifyContent="space-between" alignItems="baseline">
                    <Box sx={{ flex: 1, pr: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                        {it.product_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {it.quantity} × {formatRupiah(it.unit_price_idr)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} className="tnum">
                      {formatRupiah(it.subtotal_idr)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              <Divider sx={{ borderStyle: 'dashed', borderColor: '#cbd5e1', my: 1 }} />

              {/* Financial Breakdown */}
              <Stack spacing={0.5} sx={{ pt: 0.5 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Subtotal
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }} className="tnum">
                    {formatRupiah(completedOrder.subtotal_idr)}
                  </Typography>
                </Stack>

                {completedOrder.discount_idr > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: 'error.main' }}>
                      Diskon
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main' }} className="tnum">
                      - {formatRupiah(completedOrder.discount_idr)}
                    </Typography>
                  </Stack>
                )}

                {completedOrder.tax_idr > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      PPN (11%)
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} className="tnum">
                      + {formatRupiah(completedOrder.tax_idr)}
                    </Typography>
                  </Stack>
                )}

                <Divider sx={{ borderStyle: 'dashed', borderColor: 'divider', my: 0.5 }} />

                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Total
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#ea580c' }} className="tnum">
                    {formatRupiah(completedOrder.total_idr)}
                  </Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Metode
                  </Typography>
                  <Typography variant="body2" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
                    {completedOrder.payment_method === 'split' ? 'SPLIT (CAMPURAN)' : completedOrder.payment_method}
                  </Typography>
                </Stack>

                {completedOrder.payment_method === 'split' ? (
                  <>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Porsi Tunai
                      </Typography>
                      <Typography variant="body2" className="tnum" sx={{ fontWeight: 650 }}>
                        {formatRupiah(completedOrder.cash_amount_idr ?? 0)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Porsi Non-Tunai/QRIS
                      </Typography>
                      <Typography variant="body2" className="tnum" sx={{ fontWeight: 650 }}>
                        {formatRupiah(completedOrder.non_cash_amount_idr ?? 0)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Total Diterima
                      </Typography>
                      <Typography variant="body2" className="tnum" sx={{ fontWeight: 700 }}>
                        {formatRupiah(completedOrder.paid_amount_idr)}
                      </Typography>
                    </Stack>
                  </>
                ) : (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Bayar
                    </Typography>
                    <Typography variant="body2" className="tnum">
                      {formatRupiah(completedOrder.paid_amount_idr)}
                    </Typography>
                  </Stack>
                )}

                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Kembalian
                  </Typography>
                  <Typography variant="subtitle2" color="success.main" sx={{ fontWeight: 800 }} className="tnum">
                    {formatRupiah(completedOrder.change_amount_idr)}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, pt: 0.5 }}>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            onClick={() => setReceiptOpen(false)}
            sx={{ py: 1.1, fontWeight: 750, borderRadius: '8px' }}
          >
            Transaksi Baru
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Daftar Pesanan Diparkir (Olsera Hold Cart) */}
      <Dialog
        open={heldModalOpen}
        onClose={() => setHeldModalOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={ModalSlideTransition}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.05rem', borderBottom: '1px solid', borderColor: 'divider' }}>
          Daftar Antrean Diparkir ({heldCarts.length})
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          {heldCarts.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              Tidak ada pesanan yang sedang diparkir.
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {heldCarts.map((held) => (
                <Paper
                  key={held.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderColor: 'divider',
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>
                      {held.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Jam {held.timestamp} • {held.items.length} item ({held.items.reduce((a, b) => a + b.quantity, 0)} pcs)
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main', mt: 0.5 }}>
                      {formatRupiah(held.total)}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleResumeCart(held)}
                      sx={{ borderRadius: '8px', fontWeight: 700, fontSize: '0.78rem' }}
                    >
                      Lanjutkan
                    </Button>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteHeldCart(held.id)}
                    >
                      <DeleteOutline sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid', borderColor: 'divider', px: 3, py: 1.5 }}>
          <Button onClick={() => setHeldModalOpen(false)} sx={{ fontWeight: 650 }}>
            Tutup
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
