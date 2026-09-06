import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AddOutlined,
  CalendarMonthOutlined,
  CloseOutlined,
  PaymentsOutlined,
  PlayArrowOutlined,
  RefreshOutlined,
  SearchOutlined,
} from '@mui/icons-material'
import {
  Alert,
  Avatar,
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
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
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
import {
  BOOKING_STATUSES,
  changeBookingStatus,
  completeBooking,
  createBooking,
  getBookings,
  type Booking,
  type BookingStatus,
  type CompletePaymentMethod,
} from './bookingsApi'
import { getCustomers, getPets, type Customer, type Pet } from '../customers/customersApi'
import { getPackages, getServices, type Service, type ServicePackage } from '../services/servicesApi'
import { getLocations, type InventoryLocation } from '../inventory/inventoryApi'
import { formatCurrency } from '../../utils/currency'
import { ModalSlideTransition } from '../../components/ModalSlideTransition'
import { PawLoading } from '../../components/PawLoading'
import { useRbac } from '../auth/rbac'

const STATUS_META: Record<BookingStatus, { label: string; color: 'warning' | 'info' | 'success' | 'default' }> = {
  antre: { label: 'Antre', color: 'warning' },
  proses: { label: 'Diproses', color: 'info' },
  selesai: { label: 'Selesai', color: 'success' },
  batal: { label: 'Batal', color: 'default' },
}

const PAYMENT_METHODS: { value: CompletePaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Tunai' },
  { value: 'qris', label: 'QRIS' },
  { value: 'debit_card', label: 'Debit' },
  { value: 'split', label: 'Split' },
]

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatSchedule(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function BookingsPage() {
  const { hasPermission } = useRbac()
  const canManage = hasPermission('manage_bookings')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [locations, setLocations] = useState<InventoryLocation[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState(todayISO())

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selCustomerId, setSelCustomerId] = useState('')
  const [selPetId, setSelPetId] = useState('')
  const [offerKind, setOfferKind] = useState<'service' | 'package'>('service')
  const [selOfferId, setSelOfferId] = useState('')
  const [selLocationId, setSelLocationId] = useState('')
  const [selSchedule, setSelSchedule] = useState('')
  const [selStaff, setSelStaff] = useState('')
  const [selNotes, setSelNotes] = useState('')

  // Complete dialog
  const [completing, setCompleting] = useState<Booking | null>(null)
  const [payMethod, setPayMethod] = useState<CompletePaymentMethod>('cash')
  const [paidInput, setPaidInput] = useState('')
  const [cashInput, setCashInput] = useState('')
  const [nonCashInput, setNonCashInput] = useState('')

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const petById = useMemo(() => new Map(pets.map((p) => [p.id, p])), [pets])
  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services])
  const packageById = useMemo(() => new Map(packages.map((p) => [p.id, p])), [packages])

  const offerPrice = (b: Booking): { name: string; price: number } => {
    if (b.service_id) {
      const s = serviceById.get(b.service_id)
      return { name: s?.name ?? 'Layanan', price: s?.price_idr ?? 0 }
    }
    const p = b.package_id ? packageById.get(b.package_id) : undefined
    return { name: p?.name ?? 'Paket', price: p?.price_idr ?? 0 }
  }

  const loadData = () => {
    setStatus('loading')
    setErrorMessage('')
    Promise.all([getBookings(), getCustomers(), getPets(), getServices(), getPackages(), getLocations().catch(() => [] as InventoryLocation[])])
      .then(([bookData, custData, petData, svcData, pkgData, locData]) => {
        setBookings(bookData)
        setCustomers(custData)
        setPets(petData)
        setServices(svcData)
        setPackages(pkgData)
        setLocations(locData)
        if (locData.length > 0) setSelLocationId((prev) => prev || locData[0].id)
        setStatus('success')
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Gagal memuat booking.')
        setStatus('error')
      })
  }

  useEffect(() => {
    loadData()
    const handleTenant = () => loadData()
    window.addEventListener('pawpos:tenant_change', handleTenant)
    return () => window.removeEventListener('pawpos:tenant_change', handleTenant)
  }, [])

  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      if (dateFilter && !b.scheduled_at.startsWith(dateFilter)) return false
      if (!q) return true
      const cust = customerById.get(b.customer_id)?.name ?? ''
      const pet = petById.get(b.pet_id)?.name ?? ''
      return `${cust} ${pet} ${b.staff_name}`.toLowerCase().includes(q)
    })
  }, [bookings, searchQuery, statusFilter, dateFilter, customerById, petById])

  const availablePets = useMemo(
    () => pets.filter((p) => !selCustomerId || p.customer_id === selCustomerId),
    [pets, selCustomerId],
  )

  const openCreateDialog = () => {
    setSelCustomerId('')
    setSelPetId('')
    setOfferKind('service')
    setSelOfferId('')
    setSelSchedule(toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)))
    setSelStaff('')
    setSelNotes('')
    setFieldErrors({})
    setSubmitError('')
    setDialogOpen(true)
  }

  const handleSubmitBooking = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFieldErrors({})
    setSubmitError('')
    const errors: Record<string, string> = {}
    if (!selCustomerId) errors.customer_id = 'Pelanggan wajib dipilih.'
    if (!selPetId) errors.pet_id = 'Hewan wajib dipilih.'
    if (!selOfferId) errors.offer = offerKind === 'service' ? 'Layanan wajib dipilih.' : 'Paket wajib dipilih.'
    if (!selLocationId) errors.location_id = 'Lokasi wajib dipilih.'
    if (!selSchedule) errors.scheduled_at = 'Jadwal wajib diisi.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setIsSubmitting(true)
    try {
      const created = await createBooking({
        customer_id: selCustomerId,
        pet_id: selPetId,
        service_id: offerKind === 'service' ? selOfferId : null,
        package_id: offerKind === 'package' ? selOfferId : null,
        location_id: selLocationId,
        scheduled_at: new Date(selSchedule).toISOString(),
        staff_name: selStaff.trim(),
        notes: selNotes.trim(),
      })
      setBookings((prev) => [...prev, created].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))
      setSnackbarMessage('Booking antrean tercatat.')
      setDialogOpen(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal menyimpan booking.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = async (b: Booking, next: 'proses' | 'batal') => {
    setSubmitError('')
    try {
      const updated = await changeBookingStatus(b.id, next)
      setBookings((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      setSnackbarMessage(next === 'proses' ? 'Booking mulai diproses.' : 'Booking dibatalkan.')
    } catch (err) {
      setSnackbarMessage(err instanceof Error ? err.message : 'Gagal mengubah status.')
    }
  }

  const openCompleteDialog = (b: Booking) => {
    const { price } = offerPrice(b)
    setCompleting(b)
    setPayMethod('cash')
    setPaidInput(String(price))
    setCashInput('')
    setNonCashInput('')
    setSubmitError('')
  }

  const handleSubmitComplete = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!completing) return
    setSubmitError('')
    const paid = Number(String(paidInput).replace(/[^0-9]/g, '')) || 0
    const payload = {
      payment_method: payMethod,
      paid_amount_idr: paid,
      ...(payMethod === 'split'
        ? {
            cash_amount_idr: Number(String(cashInput).replace(/[^0-9]/g, '')) || 0,
            non_cash_amount_idr: Number(String(nonCashInput).replace(/[^0-9]/g, '')) || 0,
          }
        : {}),
    }
    setIsSubmitting(true)
    try {
      const result = await completeBooking(completing.id, payload)
      setBookings((prev) => prev.map((x) => (x.id === result.booking.id ? result.booking : x)))
      setSnackbarMessage(`Lunas. Struk ${result.order.order_number} tercatat.`)
      setCompleting(null)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal menyelesaikan booking.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeCount = bookings.filter((b) => b.status === 'antre' || b.status === 'proses').length

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-end' }} spacing={2}>
        <Box>
          <Typography variant="overline" color="primary.main">
            JASA OPERASIONAL
          </Typography>
          <Typography variant="h4" sx={{ fontSize: { xs: '1.6rem', md: '2.1rem' }, fontWeight: 800, letterSpacing: '-0.03em', color: 'text.primary', lineHeight: 1.2 }}>
            Booking & Antrean
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {activeCount} antrean aktif • Selesai otomatis menjadi struk kasir.
          </Typography>
        </Box>
        {canManage && (
          <Button variant="contained" color="primary" startIcon={<AddOutlined />} onClick={openCreateDialog} sx={{ borderRadius: '8px', fontWeight: 700 }}>
            Booking Baru
          </Button>
        )}
      </Stack>

      <Paper className="terminal-card" elevation={0} sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
        <Box sx={{ p: 1.75, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            size="small"
            placeholder="Cari pelanggan, hewan, staf..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 240 } }}
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
          <TextField
            size="small"
            type="date"
            label="Tanggal"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 170 }}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {BOOKING_STATUSES.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                size="small"
                clickable
                onClick={() => setStatusFilter(s.value)}
                color={statusFilter === s.value ? 'primary' : 'default'}
                variant={statusFilter === s.value ? 'filled' : 'outlined'}
                sx={{ fontWeight: 700, cursor: 'pointer' }}
              />
            ))}
            {dateFilter && (
              <Chip label="Semua tanggal" size="small" clickable onClick={() => setDateFilter('')} variant="outlined" sx={{ fontWeight: 700, cursor: 'pointer' }} />
            )}
          </Stack>
          <Box sx={{ flex: 1 }} />
          <IconButton aria-label="Muat ulang" onClick={loadData} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
            <RefreshOutlined fontSize="small" />
          </IconButton>
        </Box>

        {status === 'loading' ? (
          <PawLoading label="Memuat antrean..." variant="card" />
        ) : status === 'error' ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="error" sx={{ borderRadius: '8px' }}>{errorMessage}</Alert>
            <Button onClick={loadData} sx={{ mt: 2, fontWeight: 700 }}>Coba lagi</Button>
          </Box>
        ) : filteredBookings.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <Avatar variant="rounded" sx={{ width: 48, height: 48, mx: 'auto', mb: 2, bgcolor: 'action.hover', color: 'text.secondary' }}>
              <CalendarMonthOutlined />
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 750, color: 'text.primary', mb: 1 }}>Tidak ada antrean</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Belum ada booking pada filter ini. Buat booking jasa pertama.</Typography>
            {canManage && (
              <Button variant="contained" color="primary" startIcon={<AddOutlined />} onClick={openCreateDialog} sx={{ borderRadius: '8px' }}>
                Booking Baru
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 150 }}>Jadwal</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>Pelanggan & Hewan</TableCell>
                  <TableCell sx={{ minWidth: 180 }}>Layanan</TableCell>
                  <TableCell sx={{ minWidth: 110 }}>Status</TableCell>
                  {canManage && <TableCell align="center" sx={{ minWidth: 190 }}>Aksi</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredBookings.map((b) => {
                  const cust = customerById.get(b.customer_id)
                  const pet = petById.get(b.pet_id)
                  const offer = offerPrice(b)
                  const meta = STATUS_META[b.status]
                  return (
                    <TableRow key={b.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' }, '&:last-child td': { border: 0 } }}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary' }}>{formatSchedule(b.scheduled_at)}</Typography>
                        {b.staff_name && <Typography variant="caption" color="text.secondary">{b.staff_name}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary' }}>{pet?.name ?? '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">{cust?.name ?? '—'}{cust?.phone ? ` • ${cust.phone}` : ''}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 650, color: 'text.primary' }}>{offer.name}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#ea580c' }} className="tnum">{formatCurrency(offer.price)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={meta.label} size="small" color={meta.color} sx={{ fontWeight: 750 }} />
                      </TableCell>
                      {canManage && (
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.75} justifyContent="center" flexWrap="wrap">
                            {b.status === 'antre' && (
                              <Button size="small" variant="outlined" startIcon={<PlayArrowOutlined sx={{ fontSize: 15 }} />} onClick={() => handleStatusChange(b, 'proses')} sx={{ borderRadius: '8px', fontWeight: 700, fontSize: '0.72rem' }}>
                                Proses
                              </Button>
                            )}
                            {b.status === 'proses' && (
                              <Button size="small" variant="contained" color="primary" startIcon={<PaymentsOutlined sx={{ fontSize: 15 }} />} onClick={() => openCompleteDialog(b)} sx={{ borderRadius: '8px', fontWeight: 700, fontSize: '0.72rem' }}>
                                Selesai & Bayar
                              </Button>
                            )}
                            {(b.status === 'antre' || b.status === 'proses') && (
                              <Button size="small" variant="text" color="inherit" onClick={() => handleStatusChange(b, 'batal')} sx={{ borderRadius: '8px', fontWeight: 650, fontSize: '0.72rem', color: 'text.secondary' }}>
                                Batal
                              </Button>
                            )}
                            {b.status === 'selesai' && b.order_id && (
                              <Chip label="Struk tercatat" size="small" variant="outlined" sx={{ fontWeight: 650 }} />
                            )}
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onClose={() => !isSubmitting && setDialogOpen(false)} TransitionComponent={ModalSlideTransition} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={handleSubmitBooking} noValidate>
          <DialogTitle sx={{ fontWeight: 800 }}>
            Booking Jasa Baru
            <IconButton aria-label="Tutup form" onClick={() => setDialogOpen(false)} disabled={isSubmitting} sx={{ position: 'absolute', right: 12, top: 12 }}>
              <CloseOutlined />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 2.5 }}>
            <Stack spacing={2}>
              {submitError && <Alert severity="error" sx={{ borderRadius: '8px' }}>{submitError}</Alert>}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth required error={Boolean(fieldErrors.customer_id)}>
                  <InputLabel id="booking-customer-label">Pelanggan</InputLabel>
                  <Select
                    labelId="booking-customer-label"
                    value={selCustomerId}
                    label="Pelanggan"
                    disabled={isSubmitting}
                    sx={{ borderRadius: '10px' }}
                    onChange={(e) => { setSelCustomerId(e.target.value); setSelPetId('') }}
                  >
                    {customers.map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.name}{c.phone ? ` • ${c.phone}` : ''}</MenuItem>
                    ))}
                  </Select>
                  {fieldErrors.customer_id && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>{fieldErrors.customer_id}</Typography>}
                </FormControl>
                <FormControl fullWidth required error={Boolean(fieldErrors.pet_id)}>
                  <InputLabel id="booking-pet-label">Hewan</InputLabel>
                  <Select labelId="booking-pet-label" value={selPetId} label="Hewan" disabled={isSubmitting || !selCustomerId} sx={{ borderRadius: '10px' }} onChange={(e) => setSelPetId(e.target.value)}>
                    {availablePets.map((p) => (
                      <MenuItem key={p.id} value={p.id}>{p.name}{p.species ? ` • ${p.species}` : ''}</MenuItem>
                    ))}
                  </Select>
                  {fieldErrors.pet_id && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>{fieldErrors.pet_id}</Typography>}
                </FormControl>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel id="booking-kind-label">Jenis Tawaran</InputLabel>
                  <Select labelId="booking-kind-label" value={offerKind} label="Jenis Tawaran" disabled={isSubmitting} sx={{ borderRadius: '10px' }} onChange={(e) => { setOfferKind(e.target.value as 'service' | 'package'); setSelOfferId('') }}>
                    <MenuItem value="service">Layanan Satuan</MenuItem>
                    <MenuItem value="package">Paket Bundel</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth required error={Boolean(fieldErrors.offer)}>
                  <InputLabel id="booking-offer-label">{offerKind === 'service' ? 'Layanan' : 'Paket'}</InputLabel>
                  <Select labelId="booking-offer-label" value={selOfferId} label={offerKind === 'service' ? 'Layanan' : 'Paket'} disabled={isSubmitting} sx={{ borderRadius: '10px' }} onChange={(e) => setSelOfferId(e.target.value)}>
                    {offerKind === 'service'
                      ? services.map((s) => (
                        <MenuItem key={s.id} value={s.id}>{s.name} • {formatCurrency(s.price_idr)}</MenuItem>
                      ))
                      : packages.map((p) => (
                        <MenuItem key={p.id} value={p.id}>{p.name} • {formatCurrency(p.price_idr)}</MenuItem>
                      ))}
                  </Select>
                  {fieldErrors.offer && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>{fieldErrors.offer}</Typography>}
                </FormControl>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField fullWidth required label="Jadwal" type="datetime-local" value={selSchedule} onChange={(e) => setSelSchedule(e.target.value)} error={Boolean(fieldErrors.scheduled_at)} helperText={fieldErrors.scheduled_at} disabled={isSubmitting} slotProps={{ inputLabel: { shrink: true } }} />
                <FormControl fullWidth required error={Boolean(fieldErrors.location_id)}>
                  <InputLabel id="booking-location-label">Lokasi</InputLabel>
                  <Select labelId="booking-location-label" value={selLocationId} label="Lokasi" disabled={isSubmitting} sx={{ borderRadius: '10px' }} onChange={(e) => setSelLocationId(e.target.value)}>
                    {locations.map((l) => (
                      <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                    ))}
                  </Select>
                  {fieldErrors.location_id && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>{fieldErrors.location_id}</Typography>}
                </FormControl>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField fullWidth label="Staf Bertugas" placeholder="misal: Rina (Groomer)" value={selStaff} onChange={(e) => setSelStaff(e.target.value)} disabled={isSubmitting} />
                <TextField fullWidth label="Catatan" placeholder="opsional" value={selNotes} onChange={(e) => setSelNotes(e.target.value)} disabled={isSubmitting} />
              </Stack>
            </Stack>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2, gap: 1.5 }}>
            <Button variant="outlined" color="inherit" onClick={() => setDialogOpen(false)} disabled={isSubmitting} sx={{ px: 2.5 }}>Batal</Button>
            <Button type="submit" variant="contained" color="primary" disabled={isSubmitting} sx={{ px: 3 }}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan Booking'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Complete dialog */}
      <Dialog open={Boolean(completing)} onClose={() => !isSubmitting && setCompleting(null)} TransitionComponent={ModalSlideTransition} maxWidth="xs" fullWidth>
        <Box component="form" onSubmit={handleSubmitComplete} noValidate>
          <DialogTitle sx={{ fontWeight: 800 }}>Selesaikan & Bayar</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Stack spacing={2}>
              {submitError && <Alert severity="error" sx={{ borderRadius: '8px' }}>{submitError}</Alert>}
              {completing && (
                <Paper variant="outlined" sx={{ p: 1.75, borderRadius: '10px', bgcolor: 'background.default' }}>
                  <Typography variant="body2" sx={{ fontWeight: 750 }}>{offerPrice(completing).name}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 850, color: 'primary.main' }} className="tnum">
                    {formatCurrency(offerPrice(completing).price)}
                  </Typography>
                </Paper>
              )}
              <FormControl fullWidth>
                <InputLabel id="complete-method-label">Metode Bayar</InputLabel>
                <Select labelId="complete-method-label" value={payMethod} label="Metode Bayar" disabled={isSubmitting} sx={{ borderRadius: '10px' }} onChange={(e) => setPayMethod(e.target.value as CompletePaymentMethod)}>
                  {PAYMENT_METHODS.map((m) => (
                    <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                required
                label={payMethod === 'cash' ? 'Uang Diterima (Rp)' : 'Nominal Bayar (Rp)'}
                value={paidInput}
                onChange={(e) => setPaidInput(e.target.value.replace(/[^0-9]/g, ''))}
                disabled={isSubmitting}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">Rp</InputAdornment>, inputMode: 'numeric' } }}
              />
              {payMethod === 'split' && (
                <Stack direction="row" spacing={2}>
                  <TextField fullWidth label="Porsi Tunai" value={cashInput} onChange={(e) => setCashInput(e.target.value.replace(/[^0-9]/g, ''))} disabled={isSubmitting} slotProps={{ input: { inputMode: 'numeric' } }} />
                  <TextField fullWidth label="Porsi Non-Tunai" value={nonCashInput} onChange={(e) => setNonCashInput(e.target.value.replace(/[^0-9]/g, ''))} disabled={isSubmitting} slotProps={{ input: { inputMode: 'numeric' } }} />
                </Stack>
              )}
            </Stack>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2, gap: 1.5 }}>
            <Button variant="outlined" color="inherit" onClick={() => setCompleting(null)} disabled={isSubmitting} sx={{ px: 2.5 }}>Batal</Button>
            <Button type="submit" variant="contained" color="primary" disabled={isSubmitting} sx={{ px: 3 }}>
              {isSubmitting ? 'Memproses...' : 'Bayar & Selesai'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={3500}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Stack>
  )
}
