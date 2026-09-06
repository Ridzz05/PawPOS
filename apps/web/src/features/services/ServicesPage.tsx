import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AddOutlined,
  CloseOutlined,
  DeleteOutline,
  EditOutlined,
  RefreshOutlined,
  SearchOutlined,
  SpaOutlined,
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
  createPackage,
  createService,
  getPackages,
  getServices,
  ServicesApiError,
  SERVICE_CATEGORIES,
  updatePackage,
  updateService,
  type Service,
  type ServiceCategory,
  type ServicePackage,
} from './servicesApi'
import { PawLoading } from '../../components/PawLoading'
import { formatCurrency } from '../../utils/currency'
import { ModalSlideTransition } from '../../components/ModalSlideTransition'
import { useRbac } from '../auth/rbac'

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '—'
  if (minutes < 60) return `${minutes} mnt`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} jam` : `${h} jam ${m} mnt`
}

export function ServicesPage() {
  const { hasPermission } = useRbac()
  const canManage = hasPermission('manage_services')

  const [activeTab, setActiveTab] = useState<'services' | 'packages'>('services')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [services, setServices] = useState<Service[]>([])
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Service dialog
  const [svcDialogOpen, setSvcDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [svcName, setSvcName] = useState('')
  const [svcCategory, setSvcCategory] = useState<ServiceCategory>('grooming')
  const [svcPrice, setSvcPrice] = useState('')
  const [svcDuration, setSvcDuration] = useState('')
  const [svcDescription, setSvcDescription] = useState('')

  // Package dialog
  const [pkgDialogOpen, setPkgDialogOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<ServicePackage | null>(null)
  const [pkgName, setPkgName] = useState('')
  const [pkgPrice, setPkgPrice] = useState('')
  const [pkgDescription, setPkgDescription] = useState('')
  const [pkgItems, setPkgItems] = useState<{ service_id: string; sessions_included: string }[]>([
    { service_id: '', sessions_included: '1' },
  ])

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')

  const serviceNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of services) map.set(s.id, s.name)
    return map
  }, [services])

  const categoryLabel = (value: string) =>
    SERVICE_CATEGORIES.find((c) => c.value === value)?.label ?? value

  const loadData = () => {
    setStatus('loading')
    setErrorMessage('')
    Promise.all([getServices(), getPackages()])
      .then(([svcData, pkgData]) => {
        setServices(svcData)
        setPackages(pkgData)
        setStatus('success')
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Gagal memuat layanan.')
        setStatus('error')
      })
  }

  useEffect(() => {
    loadData()
    const handleTenant = () => loadData()
    window.addEventListener('pawpos:tenant_change', handleTenant)
    return () => window.removeEventListener('pawpos:tenant_change', handleTenant)
  }, [])

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return services.filter((s) => {
      if (categoryFilter && s.category !== categoryFilter) return false
      if (!q) return true
      return s.name.toLowerCase().includes(q)
    })
  }, [services, searchQuery, categoryFilter])

  const filteredPackages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return packages
    return packages.filter((p) => p.name.toLowerCase().includes(q))
  }, [packages, searchQuery])

  const resetServiceForm = () => {
    setEditingService(null)
    setSvcName('')
    setSvcCategory('grooming')
    setSvcPrice('')
    setSvcDuration('')
    setSvcDescription('')
    setFieldErrors({})
    setSubmitError('')
  }

  const resetPackageForm = () => {
    setEditingPackage(null)
    setPkgName('')
    setPkgPrice('')
    setPkgDescription('')
    setPkgItems([{ service_id: '', sessions_included: '1' }])
    setFieldErrors({})
    setSubmitError('')
  }

  const handleOpenService = (s?: Service) => {
    resetServiceForm()
    if (s) {
      setEditingService(s)
      setSvcName(s.name)
      setSvcCategory(s.category)
      setSvcPrice(String(s.price_idr))
      setSvcDuration(s.duration_minutes ? String(s.duration_minutes) : '')
      setSvcDescription(s.description)
    }
    setSvcDialogOpen(true)
  }

  const handleOpenPackage = (p?: ServicePackage) => {
    resetPackageForm()
    if (p) {
      setEditingPackage(p)
      setPkgName(p.name)
      setPkgPrice(String(p.price_idr))
      setPkgDescription(p.description)
      setPkgItems(
        p.items.length > 0
          ? p.items.map((it) => ({ service_id: it.service_id, sessions_included: String(it.sessions_included) }))
          : [{ service_id: '', sessions_included: '1' }],
      )
    }
    setPkgDialogOpen(true)
  }

  const parseRupiah = (raw: string): number | null => {
    const digits = raw.replace(/[^0-9]/g, '')
    if (!digits) return null
    return Number(digits)
  }

  const handleSubmitService = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFieldErrors({})
    setSubmitError('')
    if (!svcName.trim()) {
      setFieldErrors({ name: 'Nama layanan wajib diisi.' })
      return
    }
    const price = svcPrice.trim() === '' ? 0 : parseRupiah(svcPrice)
    if (price === null || price < 0) {
      setFieldErrors({ price_idr: 'Harga harus angka non-negatif.' })
      return
    }
    const duration = svcDuration.trim() === '' ? 0 : Number(svcDuration)
    if (isNaN(duration) || duration < 0) {
      setFieldErrors({ duration_minutes: 'Durasi harus angka non-negatif (menit).' })
      return
    }
    setIsSubmitting(true)
    try {
      const input = {
        name: svcName.trim(),
        category: svcCategory,
        price_idr: price,
        duration_minutes: Math.floor(duration),
        description: svcDescription.trim(),
      }
      if (editingService) {
        const updated = await updateService(editingService.id, input)
        setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        setSnackbarMessage(`Layanan "${updated.name}" diperbarui.`)
      } else {
        const created = await createService(input)
        setServices((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        setSnackbarMessage(`Layanan "${created.name}" ditambahkan.`)
      }
      setSvcDialogOpen(false)
      setEditingService(null)
    } catch (err) {
      setSubmitError(err instanceof ServicesApiError ? err.message : 'Gagal menyimpan layanan.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitPackage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFieldErrors({})
    setSubmitError('')
    if (!pkgName.trim()) {
      setFieldErrors({ name: 'Nama paket wajib diisi.' })
      return
    }
    const price = pkgPrice.trim() === '' ? 0 : parseRupiah(pkgPrice)
    if (price === null || price < 0) {
      setFieldErrors({ price_idr: 'Harga harus angka non-negatif.' })
      return
    }
    const items = pkgItems
      .map((it, idx) => ({ service_id: it.service_id, sessions: Number(it.sessions_included), idx }))
      .filter((it) => it.service_id)
    if (items.length === 0) {
      setFieldErrors({ items: 'Paket wajib memuat minimal satu layanan.' })
      return
    }
    for (const it of items) {
      if (!Number.isInteger(it.sessions) || it.sessions <= 0) {
        setFieldErrors({ [`items_${it.idx}`]: 'Sesi wajib bilangan bulat > 0.' })
        return
      }
    }
    setIsSubmitting(true)
    try {
      const input = {
        name: pkgName.trim(),
        price_idr: price,
        description: pkgDescription.trim(),
        items: items.map((it) => ({ service_id: it.service_id, sessions_included: it.sessions })),
      }
      if (editingPackage) {
        const updated = await updatePackage(editingPackage.id, input)
        setPackages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        setSnackbarMessage(`Paket "${updated.name}" diperbarui.`)
      } else {
        const created = await createPackage(input)
        setPackages((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        setSnackbarMessage(`Paket "${created.name}" ditambahkan.`)
      }
      setPkgDialogOpen(false)
      setEditingPackage(null)
    } catch (err) {
      setSubmitError(err instanceof ServicesApiError ? err.message : 'Gagal menyimpan paket.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-end' }} spacing={2}>
        <Box>
          <Typography variant="overline" color="primary.main">
            KATALOG JASA
          </Typography>
          <Typography variant="h4" sx={{ fontSize: { xs: '1.6rem', md: '2.1rem' }, fontWeight: 800, letterSpacing: '-0.03em', color: 'text.primary', lineHeight: 1.2 }}>
            Layanan & Paket
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Tarif grooming, klinik, dan penitipan beserta paket bundel untuk dijual di kasir.
          </Typography>
        </Box>
        {canManage && (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" color="inherit" startIcon={<AddOutlined />} onClick={() => handleOpenPackage()} sx={{ borderRadius: '8px', fontWeight: 700 }}>
              Tambah Paket
            </Button>
            <Button variant="contained" color="primary" startIcon={<AddOutlined />} onClick={() => handleOpenService()} sx={{ borderRadius: '8px', fontWeight: 700 }}>
              Tambah Layanan
            </Button>
          </Stack>
        )}
      </Stack>

      <Paper className="terminal-card" elevation={0} sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
        <Box sx={{ px: 2, pt: 1.5, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ minHeight: 40 }}>
            <Tab value="services" label={`Layanan (${services.length})`} sx={{ fontWeight: 750, textTransform: 'none' }} />
            <Tab value="packages" label={`Paket (${packages.length})`} sx={{ fontWeight: 750, textTransform: 'none' }} />
          </Tabs>
        </Box>

        <Box sx={{ p: 1.75, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            size="small"
            placeholder="Cari layanan atau paket..."
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
          {activeTab === 'services' && (
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="service-category-filter">Kategori</InputLabel>
              <Select labelId="service-category-filter" value={categoryFilter} label="Kategori" onChange={(e) => setCategoryFilter(e.target.value)} sx={{ borderRadius: '8px' }}>
                <MenuItem value="">Semua Kategori</MenuItem>
                {SERVICE_CATEGORIES.map((c) => (
                  <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Box sx={{ flex: 1 }} />
          <IconButton aria-label="Muat ulang" onClick={loadData} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
            <RefreshOutlined fontSize="small" />
          </IconButton>
        </Box>

        {status === 'loading' ? (
          <PawLoading label="Memuat data layanan..." variant="card" />
        ) : status === 'error' ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="error" sx={{ borderRadius: '8px' }}>{errorMessage}</Alert>
            <Button onClick={loadData} sx={{ mt: 2, fontWeight: 700 }}>Coba lagi</Button>
          </Box>
        ) : activeTab === 'services' ? (
          filteredServices.length === 0 ? (
            <Box sx={{ p: 5, textAlign: 'center' }}>
              <Avatar variant="rounded" sx={{ width: 48, height: 48, mx: 'auto', mb: 2, bgcolor: 'action.hover', color: 'text.secondary' }}>
                <SpaOutlined />
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 750, color: 'text.primary', mb: 1 }}>Belum ada layanan</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Daftarkan tarif grooming, klinik, atau penitipan pertama.</Typography>
              {canManage && (
                <Button variant="contained" color="primary" startIcon={<AddOutlined />} onClick={() => handleOpenService()} sx={{ borderRadius: '8px' }}>
                  Tambah Layanan Pertama
                </Button>
              )}
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 220 }}>Nama Layanan</TableCell>
                    <TableCell sx={{ minWidth: 120 }}>Kategori</TableCell>
                    <TableCell align="right" sx={{ minWidth: 130 }}>Tarif</TableCell>
                    <TableCell sx={{ minWidth: 110 }}>Durasi</TableCell>
                    {canManage && <TableCell align="center" sx={{ minWidth: 90 }}>Aksi</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredServices.map((s) => (
                    <TableRow key={s.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' }, '&:last-child td': { border: 0 } }}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary' }}>{s.name}</Typography>
                        {s.description && <Typography variant="caption" color="text.secondary">{s.description}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Chip label={categoryLabel(s.category)} size="small" variant="outlined" sx={{ fontWeight: 650 }} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 850, color: '#ea580c' }} className="tnum">{formatCurrency(s.price_idr)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{formatDuration(s.duration_minutes)}</Typography>
                      </TableCell>
                      {canManage && (
                        <TableCell align="center">
                          <IconButton size="small" aria-label={`Edit ${s.name}`} onClick={() => handleOpenService(s)} sx={{ color: 'text.secondary', '&:hover': { color: '#ff8042' } }}>
                            <EditOutlined fontSize="small" sx={{ fontSize: 18 }} />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )
        ) : filteredPackages.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 750, color: 'text.primary', mb: 1 }}>Belum ada paket bundel</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Rakit beberapa layanan menjadi satu harga paket hemat.</Typography>
            {canManage && (
              <Button variant="contained" color="primary" startIcon={<AddOutlined />} onClick={() => handleOpenPackage()} sx={{ borderRadius: '8px' }}>
                Tambah Paket Pertama
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 220 }}>Nama Paket</TableCell>
                  <TableCell sx={{ minWidth: 260 }}>Isi Layanan</TableCell>
                  <TableCell align="right" sx={{ minWidth: 130 }}>Harga Paket</TableCell>
                  {canManage && <TableCell align="center" sx={{ minWidth: 90 }}>Aksi</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPackages.map((p) => (
                  <TableRow key={p.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' }, '&:last-child td': { border: 0 } }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary' }}>{p.name}</Typography>
                      {p.description && <Typography variant="caption" color="text.secondary">{p.description}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        {p.items.map((it) => (
                          <Typography key={it.service_id} variant="caption" color="text.secondary">
                            • {it.service_name || serviceNameById.get(it.service_id) || 'Layanan'} ({it.sessions_included}x)
                          </Typography>
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 850, color: '#ea580c' }} className="tnum">{formatCurrency(p.price_idr)}</Typography>
                    </TableCell>
                    {canManage && (
                      <TableCell align="center">
                        <IconButton size="small" aria-label={`Edit ${p.name}`} onClick={() => handleOpenPackage(p)} sx={{ color: 'text.secondary', '&:hover': { color: '#ff8042' } }}>
                          <EditOutlined fontSize="small" sx={{ fontSize: 18 }} />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Service dialog */}
      <Dialog open={svcDialogOpen} onClose={() => !isSubmitting && setSvcDialogOpen(false)} TransitionComponent={ModalSlideTransition} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={handleSubmitService} noValidate>
          <DialogTitle sx={{ fontWeight: 800 }}>
            {editingService ? 'Edit Layanan' : 'Tambah Layanan Baru'}
            <IconButton aria-label="Tutup form" onClick={() => setSvcDialogOpen(false)} disabled={isSubmitting} sx={{ position: 'absolute', right: 12, top: 12 }}>
              <CloseOutlined />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 2.5 }}>
            <Stack spacing={2}>
              {submitError && <Alert severity="error" sx={{ borderRadius: '8px' }}>{submitError}</Alert>}
              <TextField fullWidth required label="Nama Layanan" placeholder="misal: Grooming Komplit Kucing" value={svcName} onChange={(e) => setSvcName(e.target.value)} error={Boolean(fieldErrors.name)} helperText={fieldErrors.name} disabled={isSubmitting} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel id="service-category-label">Kategori</InputLabel>
                  <Select labelId="service-category-label" value={svcCategory} label="Kategori" onChange={(e) => setSvcCategory(e.target.value as ServiceCategory)} disabled={isSubmitting} sx={{ borderRadius: '10px' }}>
                    {SERVICE_CATEGORIES.map((c) => (
                      <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField fullWidth label="Durasi (menit)" type="number" placeholder="0" value={svcDuration} onChange={(e) => setSvcDuration(e.target.value)} error={Boolean(fieldErrors.duration_minutes)} helperText={fieldErrors.duration_minutes} disabled={isSubmitting} slotProps={{ input: { inputProps: { min: 0 } } }} />
              </Stack>
              <TextField fullWidth label="Tarif (Rp)" placeholder="0" value={svcPrice} onChange={(e) => setSvcPrice(e.target.value.replace(/[^0-9]/g, ''))} error={Boolean(fieldErrors.price_idr)} helperText={fieldErrors.price_idr} disabled={isSubmitting} slotProps={{ input: { startAdornment: <InputAdornment position="start">Rp</InputAdornment>, inputMode: 'numeric' } }} />
              <TextField fullWidth label="Deskripsi" placeholder="opsional" value={svcDescription} onChange={(e) => setSvcDescription(e.target.value)} disabled={isSubmitting} multiline rows={2} />
            </Stack>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2, gap: 1.5 }}>
            <Button variant="outlined" color="inherit" onClick={() => setSvcDialogOpen(false)} disabled={isSubmitting} sx={{ px: 2.5 }}>Batal</Button>
            <Button type="submit" variant="contained" color="primary" disabled={isSubmitting} sx={{ px: 3 }}>
              {isSubmitting ? 'Menyimpan...' : editingService ? 'Simpan Perubahan' : 'Simpan Layanan'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Package dialog */}
      <Dialog open={pkgDialogOpen} onClose={() => !isSubmitting && setPkgDialogOpen(false)} TransitionComponent={ModalSlideTransition} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={handleSubmitPackage} noValidate>
          <DialogTitle sx={{ fontWeight: 800 }}>
            {editingPackage ? 'Edit Paket' : 'Tambah Paket Bundel'}
            <IconButton aria-label="Tutup form" onClick={() => setPkgDialogOpen(false)} disabled={isSubmitting} sx={{ position: 'absolute', right: 12, top: 12 }}>
              <CloseOutlined />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 2.5 }}>
            <Stack spacing={2}>
              {submitError && <Alert severity="error" sx={{ borderRadius: '8px' }}>{submitError}</Alert>}
              <TextField fullWidth required label="Nama Paket" placeholder="misal: Paket Grooming 3x" value={pkgName} onChange={(e) => setPkgName(e.target.value)} error={Boolean(fieldErrors.name)} helperText={fieldErrors.name} disabled={isSubmitting} />
              <TextField fullWidth label="Harga Paket (Rp)" placeholder="0" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value.replace(/[^0-9]/g, ''))} error={Boolean(fieldErrors.price_idr)} helperText={fieldErrors.price_idr} disabled={isSubmitting} slotProps={{ input: { startAdornment: <InputAdornment position="start">Rp</InputAdornment>, inputMode: 'numeric' } }} />
              <TextField fullWidth label="Deskripsi" placeholder="opsional" value={pkgDescription} onChange={(e) => setPkgDescription(e.target.value)} disabled={isSubmitting} multiline rows={2} />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 750, mb: 1 }}>Isi Layanan</Typography>
                {fieldErrors.items && <Typography variant="caption" color="error">{fieldErrors.items}</Typography>}
                <Stack spacing={1.5}>
                  {pkgItems.map((it, idx) => (
                    <Stack key={idx} direction="row" spacing={1.5} alignItems="flex-start">
                      <FormControl fullWidth>
                        <InputLabel id={`pkg-service-${idx}`}>Layanan</InputLabel>
                        <Select
                          labelId={`pkg-service-${idx}`}
                          value={it.service_id}
                          label="Layanan"
                          disabled={isSubmitting}
                          sx={{ borderRadius: '10px' }}
                          onChange={(e) => setPkgItems((prev) => prev.map((row, i) => (i === idx ? { ...row, service_id: e.target.value } : row)))}
                        >
                          {services.map((s) => (
                            <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        label="Sesi"
                        type="number"
                        value={it.sessions_included}
                        disabled={isSubmitting}
                        error={Boolean(fieldErrors[`items_${idx}`])}
                        helperText={fieldErrors[`items_${idx}`]}
                        sx={{ width: 110 }}
                        slotProps={{ input: { inputProps: { min: 1 } } }}
                        onChange={(e) => setPkgItems((prev) => prev.map((row, i) => (i === idx ? { ...row, sessions_included: e.target.value } : row)))}
                      />
                      <IconButton
                        aria-label="Hapus baris layanan"
                        disabled={isSubmitting || pkgItems.length <= 1}
                        onClick={() => setPkgItems((prev) => prev.filter((_, i) => i !== idx))}
                        sx={{ mt: 0.5 }}
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
                <Button onClick={() => setPkgItems((prev) => [...prev, { service_id: '', sessions_included: '1' }])} disabled={isSubmitting} sx={{ mt: 1.5, fontWeight: 700 }}>
                  + Tambah Baris Layanan
                </Button>
              </Box>
            </Stack>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2, gap: 1.5 }}>
            <Button variant="outlined" color="inherit" onClick={() => setPkgDialogOpen(false)} disabled={isSubmitting} sx={{ px: 2.5 }}>Batal</Button>
            <Button type="submit" variant="contained" color="primary" disabled={isSubmitting} sx={{ px: 3 }}>
              {isSubmitting ? 'Menyimpan...' : editingPackage ? 'Simpan Perubahan' : 'Simpan Paket'}
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
