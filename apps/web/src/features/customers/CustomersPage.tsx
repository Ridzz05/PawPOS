import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AddOutlined,
  CloseOutlined,
  EditOutlined,
  GroupOutlined,
  PetsOutlined,
  PhoneOutlined,
  RefreshOutlined,
  SearchOutlined,
  WarningAmberOutlined,
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
  createCustomer,
  createPet,
  CustomersApiError,
  getCustomers,
  getPets,
  updateCustomer,
  updatePet,
  type Customer,
  type Pet,
} from './customersApi'
import { ModalSlideTransition } from '../../components/ModalSlideTransition'
import { useRbac } from '../auth/rbac'

const SPECIES_OPTIONS = ['Kucing', 'Anjing', 'Kelinci', 'Burung', 'Hamster', 'Ikan', 'Reptil', 'Lainnya']
const GENDER_OPTIONS = [
  { value: '', label: 'Tidak diketahui' },
  { value: 'jantan', label: 'Jantan' },
  { value: 'betina', label: 'Betina' },
]

export function CustomersPage({ initialTab = 'customers' }: { initialTab?: 'customers' | 'pets' } = {}) {
  const { hasPermission } = useRbac()
  const canManage = hasPermission('manage_customers')

  const [activeTab, setActiveTab] = useState<'customers' | 'pets'>(initialTab)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')

  // Customer dialog
  const [custDialogOpen, setCustDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('')
  const [custEmail, setCustEmail] = useState('')
  const [custAddress, setCustAddress] = useState('')
  const [custNotes, setCustNotes] = useState('')

  // Pet dialog
  const [petDialogOpen, setPetDialogOpen] = useState(false)
  const [editingPet, setEditingPet] = useState<Pet | null>(null)
  const [petOwnerId, setPetOwnerId] = useState('')
  const [petName, setPetName] = useState('')
  const [petSpecies, setPetSpecies] = useState('Kucing')
  const [petBreed, setPetBreed] = useState('')
  const [petGender, setPetGender] = useState('')
  const [petBirthDate, setPetBirthDate] = useState('')
  const [petWeight, setPetWeight] = useState('')
  const [petColor, setPetColor] = useState('')
  const [petAllergies, setPetAllergies] = useState('')
  const [petNotes, setPetNotes] = useState('')

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of customers) map.set(c.id, c.name)
    return map
  }, [customers])

  const loadData = () => {
    setStatus('loading')
    setErrorMessage('')
    Promise.all([getCustomers(), getPets()])
      .then(([custData, petData]) => {
        setCustomers(custData)
        setPets(petData)
        setStatus('success')
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Gagal memuat data pelanggan.')
        setStatus('error')
      })
  }

  useEffect(() => {
    loadData()
    const handleTenant = () => loadData()
    window.addEventListener('pawpos:tenant_change', handleTenant)
    return () => window.removeEventListener('pawpos:tenant_change', handleTenant)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) =>
      `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q),
    )
  }, [customers, searchQuery])

  const filteredPets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return pets.filter((p) => {
      if (ownerFilter && p.customer_id !== ownerFilter) return false
      if (!q) return true
      const owner = p.customer_name || customerNameById.get(p.customer_id) || ''
      return `${p.name} ${p.species} ${p.breed} ${owner}`.toLowerCase().includes(q)
    })
  }, [pets, searchQuery, ownerFilter, customerNameById])

  const resetCustomerForm = () => {
    setEditingCustomer(null)
    setCustName('')
    setCustPhone('')
    setCustEmail('')
    setCustAddress('')
    setCustNotes('')
    setFieldErrors({})
    setSubmitError('')
  }

  const resetPetForm = () => {
    setEditingPet(null)
    setPetOwnerId('')
    setPetName('')
    setPetSpecies('Kucing')
    setPetBreed('')
    setPetGender('')
    setPetBirthDate('')
    setPetWeight('')
    setPetColor('')
    setPetAllergies('')
    setPetNotes('')
    setFieldErrors({})
    setSubmitError('')
  }

  const handleOpenCustomer = (c?: Customer) => {
    resetCustomerForm()
    if (c) {
      setEditingCustomer(c)
      setCustName(c.name)
      setCustPhone(c.phone)
      setCustEmail(c.email)
      setCustAddress(c.address)
      setCustNotes(c.notes)
    }
    setCustDialogOpen(true)
  }

  const handleOpenPet = (p?: Pet, presetOwnerId?: string) => {
    resetPetForm()
    if (p) {
      setEditingPet(p)
      setPetOwnerId(p.customer_id)
      setPetName(p.name)
      setPetSpecies(p.species || 'Kucing')
      setPetBreed(p.breed)
      setPetGender(p.gender)
      setPetBirthDate(p.birth_date || '')
      setPetWeight(p.weight_kg ? String(p.weight_kg) : '')
      setPetColor(p.color)
      setPetAllergies(p.allergies)
      setPetNotes(p.notes)
    } else if (presetOwnerId) {
      setPetOwnerId(presetOwnerId)
    }
    setPetDialogOpen(true)
  }

  const handleSubmitCustomer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFieldErrors({})
    setSubmitError('')
    if (!custName.trim()) {
      setFieldErrors({ name: 'Nama pelanggan wajib diisi.' })
      return
    }
    setIsSubmitting(true)
    try {
      const input = {
        name: custName.trim(),
        phone: custPhone.trim(),
        email: custEmail.trim(),
        address: custAddress.trim(),
        notes: custNotes.trim(),
      }
      if (editingCustomer) {
        const updated = await updateCustomer(editingCustomer.id, input)
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        setSnackbarMessage(`Pelanggan "${updated.name}" diperbarui.`)
      } else {
        const created = await createCustomer(input)
        setCustomers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        setSnackbarMessage(`Pelanggan "${created.name}" ditambahkan.`)
      }
      setCustDialogOpen(false)
      setEditingCustomer(null)
    } catch (err) {
      setSubmitError(err instanceof CustomersApiError ? err.message : 'Gagal menyimpan pelanggan.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitPet = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFieldErrors({})
    setSubmitError('')
    const errors: Record<string, string> = {}
    if (!petOwnerId) errors.customer_id = 'Pemilik wajib dipilih.'
    if (!petName.trim()) errors.name = 'Nama hewan wajib diisi.'
    const weight = petWeight.trim() === '' ? 0 : Number(petWeight)
    if (isNaN(weight) || weight < 0) errors.weight_kg = 'Berat harus angka non-negatif.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setIsSubmitting(true)
    try {
      const input = {
        customer_id: petOwnerId,
        name: petName.trim(),
        species: petSpecies.trim(),
        breed: petBreed.trim(),
        birth_date: petBirthDate || null,
        gender: petGender,
        weight_kg: weight,
        color: petColor.trim(),
        allergies: petAllergies.trim(),
        notes: petNotes.trim(),
      }
      if (editingPet) {
        const updated = await updatePet(editingPet.id, input)
        setPets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        setSnackbarMessage(`Data "${updated.name}" diperbarui.`)
      } else {
        const created = await createPet(input)
        setPets((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        setSnackbarMessage(`Hewan "${created.name}" ditambahkan.`)
      }
      setPetDialogOpen(false)
      setEditingPet(null)
    } catch (err) {
      setSubmitError(err instanceof CustomersApiError ? err.message : 'Gagal menyimpan data hewan.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const petCountByOwner = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of pets) map.set(p.customer_id, (map.get(p.customer_id) ?? 0) + 1)
    return map
  }, [pets])

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-end' }} spacing={2}>
        <Box>
          <Typography variant="overline" color="primary.main">
            DIREKTORI OPERASIONAL
          </Typography>
          <Typography variant="h4" sx={{ fontSize: { xs: '1.6rem', md: '2.1rem' }, fontWeight: 800, letterSpacing: '-0.03em', color: 'text.primary', lineHeight: 1.2 }}>
            Pelanggan & Hewan
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Basis data pemilik dan hewan untuk booking jasa, rekam medis, dan promo member.
          </Typography>
        </Box>
        {canManage && (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" color="inherit" startIcon={<PetsOutlined />} onClick={() => handleOpenPet()} sx={{ borderRadius: '8px', fontWeight: 700 }}>
              Tambah Hewan
            </Button>
            <Button variant="contained" color="primary" startIcon={<AddOutlined />} onClick={() => handleOpenCustomer()} sx={{ borderRadius: '8px', fontWeight: 700 }}>
              Tambah Pelanggan
            </Button>
          </Stack>
        )}
      </Stack>

      <Paper className="terminal-card" elevation={0} sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
        <Box sx={{ px: 2, pt: 1.5, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ minHeight: 40 }}>
            <Tab value="customers" label={`Pelanggan (${customers.length})`} sx={{ fontWeight: 750, textTransform: 'none' }} />
            <Tab value="pets" label={`Hewan (${pets.length})`} sx={{ fontWeight: 750, textTransform: 'none' }} />
          </Tabs>
        </Box>

        <Box sx={{ p: 1.75, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            size="small"
            placeholder={activeTab === 'customers' ? 'Cari nama, telepon, atau email...' : 'Cari nama hewan, ras, atau pemilik...'}
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
          {activeTab === 'pets' && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="pet-owner-filter">Filter Pemilik</InputLabel>
              <Select
                labelId="pet-owner-filter"
                value={ownerFilter}
                label="Filter Pemilik"
                onChange={(e) => setOwnerFilter(e.target.value)}
                sx={{ borderRadius: '8px' }}
              >
                <MenuItem value="">Semua Pemilik</MenuItem>
                {customers.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
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
          <Box sx={{ p: 5, textAlign: 'center', color: 'text.secondary' }}>Memuat data...</Box>
        ) : status === 'error' ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="error" sx={{ borderRadius: '8px' }}>{errorMessage}</Alert>
            <Button onClick={loadData} sx={{ mt: 2, fontWeight: 700 }}>Coba lagi</Button>
          </Box>
        ) : activeTab === 'customers' ? (
          filteredCustomers.length === 0 ? (
            <Box sx={{ p: 5, textAlign: 'center' }}>
              <Avatar variant="rounded" sx={{ width: 48, height: 48, mx: 'auto', mb: 2, bgcolor: 'action.hover', color: 'text.secondary' }}>
                <GroupOutlined />
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 750, color: 'text.primary', mb: 1 }}>Belum ada pelanggan</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Daftarkan pemilik hewan pertama untuk mengaktifkan booking dan rekam medis.</Typography>
              {canManage && (
                <Button variant="contained" color="primary" startIcon={<AddOutlined />} onClick={() => handleOpenCustomer()} sx={{ borderRadius: '8px' }}>
                  Tambah Pelanggan Pertama
                </Button>
              )}
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 220 }}>Nama Pelanggan</TableCell>
                    <TableCell sx={{ minWidth: 180 }}>Kontak</TableCell>
                    <TableCell sx={{ minWidth: 90 }}>Hewan</TableCell>
                    <TableCell sx={{ minWidth: 200 }}>Alamat</TableCell>
                    {canManage && <TableCell align="center" sx={{ minWidth: 120 }}>Aksi</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredCustomers.map((c) => (
                    <TableRow key={c.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' }, '&:last-child td': { border: 0 } }}>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar sx={{ width: 38, height: 38, bgcolor: 'primary.light', color: 'primary.main', fontWeight: 800 }}>
                            {c.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary' }}>{c.name}</Typography>
                            {c.email && <Typography variant="caption" color="text.secondary">{c.email}</Typography>}
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {c.phone ? (
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <PhoneOutlined sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.primary" className="tnum">{c.phone}</Typography>
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${petCountByOwner.get(c.id) ?? 0} ekor`}
                          size="small"
                          variant="outlined"
                          clickable
                          onClick={() => { setOwnerFilter(c.id); setActiveTab('pets') }}
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.84rem' }}>{c.address || '—'}</Typography>
                      </TableCell>
                      {canManage && (
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <IconButton size="small" aria-label={`Tambah hewan untuk ${c.name}`} onClick={() => handleOpenPet(undefined, c.id)} sx={{ color: 'text.secondary', '&:hover': { color: '#ff8042' } }}>
                              <PetsOutlined fontSize="small" sx={{ fontSize: 18 }} />
                            </IconButton>
                            <IconButton size="small" aria-label={`Edit ${c.name}`} onClick={() => handleOpenCustomer(c)} sx={{ color: 'text.secondary', '&:hover': { color: '#ff8042' } }}>
                              <EditOutlined fontSize="small" sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )
        ) : filteredPets.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <Avatar variant="rounded" sx={{ width: 48, height: 48, mx: 'auto', mb: 2, bgcolor: 'action.hover', color: 'text.secondary' }}>
              <PetsOutlined />
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 750, color: 'text.primary', mb: 1 }}>Belum ada data hewan</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Daftarkan hewan peliharaan pelanggan untuk rekam medis dan booking jasa.</Typography>
            {canManage && (
              <Button variant="contained" color="primary" startIcon={<AddOutlined />} onClick={() => handleOpenPet()} sx={{ borderRadius: '8px' }}>
                Tambah Hewan Pertama
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 200 }}>Nama Hewan</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>Spesies / Ras</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>Pemilik</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Alergi</TableCell>
                  {canManage && <TableCell align="center" sx={{ minWidth: 90 }}>Aksi</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPets.map((p) => (
                  <TableRow key={p.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' }, '&:last-child td': { border: 0 } }}>
                    <TableCell>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Avatar sx={{ width: 36, height: 36, bgcolor: 'success.light', color: 'success.main', fontWeight: 800 }}>
                          {p.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary' }}>{p.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {[p.gender === 'jantan' ? 'Jantan' : p.gender === 'betina' ? 'Betina' : null, p.weight_kg > 0 ? `${p.weight_kg} kg` : null].filter(Boolean).join(' • ') || '—'}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.primary">{[p.species, p.breed].filter(Boolean).join(' · ') || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{p.customer_name || customerNameById.get(p.customer_id) || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      {p.allergies ? (
                        <Chip icon={<WarningAmberOutlined sx={{ fontSize: '0.9rem !important' }} />} label={p.allergies} size="small" color="warning" variant="outlined" sx={{ fontWeight: 650, maxWidth: 180 }} />
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell align="center">
                        <IconButton size="small" aria-label={`Edit ${p.name}`} onClick={() => handleOpenPet(p)} sx={{ color: 'text.secondary', '&:hover': { color: '#ff8042' } }}>
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

      {/* Customer dialog */}
      <Dialog open={custDialogOpen} onClose={() => !isSubmitting && setCustDialogOpen(false)} TransitionComponent={ModalSlideTransition} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={handleSubmitCustomer} noValidate>
          <DialogTitle sx={{ fontWeight: 800 }}>
            {editingCustomer ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru'}
            <IconButton aria-label="Tutup form" onClick={() => setCustDialogOpen(false)} disabled={isSubmitting} sx={{ position: 'absolute', right: 12, top: 12 }}>
              <CloseOutlined />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 2.5 }}>
            <Stack spacing={2}>
              {submitError && <Alert severity="error" sx={{ borderRadius: '8px' }}>{submitError}</Alert>}
              <TextField fullWidth required label="Nama Lengkap" placeholder="misal: Andi Wijaya" value={custName} onChange={(e) => setCustName(e.target.value)} error={Boolean(fieldErrors.name)} helperText={fieldErrors.name} disabled={isSubmitting} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField fullWidth label="No. Telepon / WA" placeholder="misal: 08123456789" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} disabled={isSubmitting} slotProps={{ input: { inputMode: 'tel' } }} />
                <TextField fullWidth label="Email" type="email" placeholder="opsional" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} disabled={isSubmitting} />
              </Stack>
              <TextField fullWidth label="Alamat" placeholder="opsional" value={custAddress} onChange={(e) => setCustAddress(e.target.value)} disabled={isSubmitting} multiline rows={2} />
              <TextField fullWidth label="Catatan" placeholder="opsional" value={custNotes} onChange={(e) => setCustNotes(e.target.value)} disabled={isSubmitting} multiline rows={2} />
            </Stack>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2, gap: 1.5 }}>
            <Button variant="outlined" color="inherit" onClick={() => setCustDialogOpen(false)} disabled={isSubmitting} sx={{ px: 2.5 }}>Batal</Button>
            <Button type="submit" variant="contained" color="primary" disabled={isSubmitting} sx={{ px: 3 }}>
              {isSubmitting ? 'Menyimpan...' : editingCustomer ? 'Simpan Perubahan' : 'Simpan Pelanggan'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Pet dialog */}
      <Dialog open={petDialogOpen} onClose={() => !isSubmitting && setPetDialogOpen(false)} TransitionComponent={ModalSlideTransition} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={handleSubmitPet} noValidate>
          <DialogTitle sx={{ fontWeight: 800 }}>
            {editingPet ? 'Edit Data Hewan' : 'Tambah Hewan Peliharaan'}
            <IconButton aria-label="Tutup form" onClick={() => setPetDialogOpen(false)} disabled={isSubmitting} sx={{ position: 'absolute', right: 12, top: 12 }}>
              <CloseOutlined />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 2.5 }}>
            <Stack spacing={2}>
              {submitError && <Alert severity="error" sx={{ borderRadius: '8px' }}>{submitError}</Alert>}
              <FormControl fullWidth required error={Boolean(fieldErrors.customer_id)}>
                <InputLabel id="pet-owner-label">Pemilik</InputLabel>
                <Select labelId="pet-owner-label" value={petOwnerId} label="Pemilik" onChange={(e) => setPetOwnerId(e.target.value)} disabled={isSubmitting || Boolean(editingPet)} sx={{ borderRadius: '10px' }}>
                  {customers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}{c.phone ? ` • ${c.phone}` : ''}</MenuItem>
                  ))}
                </Select>
                {fieldErrors.customer_id && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>{fieldErrors.customer_id}</Typography>}
              </FormControl>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField fullWidth required label="Nama Hewan" placeholder="misal: Mochi" value={petName} onChange={(e) => setPetName(e.target.value)} error={Boolean(fieldErrors.name)} helperText={fieldErrors.name} disabled={isSubmitting} />
                <FormControl fullWidth>
                  <InputLabel id="pet-species-label">Spesies</InputLabel>
                  <Select labelId="pet-species-label" value={SPECIES_OPTIONS.includes(petSpecies) ? petSpecies : 'Lainnya'} label="Spesies" onChange={(e) => setPetSpecies(e.target.value)} disabled={isSubmitting} sx={{ borderRadius: '10px' }}>
                    {SPECIES_OPTIONS.map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField fullWidth label="Ras" placeholder="misal: Persia" value={petBreed} onChange={(e) => setPetBreed(e.target.value)} disabled={isSubmitting} />
                <FormControl fullWidth>
                  <InputLabel id="pet-gender-label">Jenis Kelamin</InputLabel>
                  <Select labelId="pet-gender-label" value={petGender} label="Jenis Kelamin" onChange={(e) => setPetGender(e.target.value)} disabled={isSubmitting} sx={{ borderRadius: '10px' }}>
                    {GENDER_OPTIONS.map((g) => (
                      <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField fullWidth label="Tanggal Lahir" type="date" value={petBirthDate} onChange={(e) => setPetBirthDate(e.target.value)} disabled={isSubmitting} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField fullWidth label="Berat (kg)" type="number" placeholder="0" value={petWeight} onChange={(e) => setPetWeight(e.target.value)} error={Boolean(fieldErrors.weight_kg)} helperText={fieldErrors.weight_kg} disabled={isSubmitting} slotProps={{ input: { inputProps: { min: 0, step: 0.1 } } }} />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField fullWidth label="Warna / Ciri" placeholder="misal: Oren belang" value={petColor} onChange={(e) => setPetColor(e.target.value)} disabled={isSubmitting} />
                <TextField fullWidth label="Alergi" placeholder="misal: Ikan, ayam" value={petAllergies} onChange={(e) => setPetAllergies(e.target.value)} disabled={isSubmitting} />
              </Stack>
              <TextField fullWidth label="Catatan Kesehatan" placeholder="opsional" value={petNotes} onChange={(e) => setPetNotes(e.target.value)} disabled={isSubmitting} multiline rows={2} />
            </Stack>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2, gap: 1.5 }}>
            <Button variant="outlined" color="inherit" onClick={() => setPetDialogOpen(false)} disabled={isSubmitting} sx={{ px: 2.5 }}>Batal</Button>
            <Button type="submit" variant="contained" color="primary" disabled={isSubmitting} sx={{ px: 3 }}>
              {isSubmitting ? 'Menyimpan...' : editingPet ? 'Simpan Perubahan' : 'Simpan Hewan'}
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
