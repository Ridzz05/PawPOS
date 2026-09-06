import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  AddOutlined,
  CardGiftcardOutlined,
  CloseOutlined,
  ConfirmationNumberOutlined,
  DeleteOutline,
  EditOutlined,
  PercentOutlined,
  RefreshOutlined,
  SearchOutlined,
} from '@mui/icons-material'
import { formatRupiah } from '../../utils/currency'
import { ModalSlideTransition } from '../../components/ModalSlideTransition'
import {
  type Promo,
  type PromoKind,
  type UpsertPromoInput,
  createPromo,
  deletePromo,
  fetchPromos,
  updatePromo,
} from './promosApi'

export function PromosPage(): React.ReactElement {
  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | PromoKind>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null)
  const [formData, setFormData] = useState<UpsertPromoInput>({
    code: '',
    name: '',
    kind: 'percent',
    value: 10,
    min_spend: 0,
    max_discount: 0,
    quota: 0,
    is_active: true,
  })
  const [submitting, setSubmitting] = useState(false)

  // Snackbar Notification State
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPromos()
      setPromos(data)
    } catch {
      setSnackbar({ open: true, message: 'Gagal memuat daftar promo & voucher', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filtered list
  const filteredPromos = useMemo(() => {
    return promos.filter((p) => {
      const matchSearch =
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        p.name.toLowerCase().includes(search.toLowerCase())
      const matchKind = kindFilter === 'all' || p.kind === kindFilter
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && p.is_active) ||
        (statusFilter === 'inactive' && !p.is_active)
      return matchSearch && matchKind && matchStatus
    })
  }, [promos, search, kindFilter, statusFilter])

  // Aggregate metrics
  const totalActive = useMemo(() => promos.filter((p) => p.is_active).length, [promos])
  const totalRedemptions = useMemo(
    () => promos.reduce((sum, p) => sum + p.used_count, 0),
    [promos],
  )
  const totalQuota = useMemo(
    () => promos.reduce((sum, p) => sum + (p.quota > 0 ? p.quota : 0), 0),
    [promos],
  )

  const handleOpenCreate = () => {
    setEditingPromo(null)
    setFormData({
      code: '',
      name: '',
      kind: 'percent',
      value: 10,
      min_spend: 0,
      max_discount: 0,
      quota: 50,
      is_active: true,
    })
    setDialogOpen(true)
  }

  const handleOpenEdit = (promo: Promo) => {
    setEditingPromo(promo)
    setFormData({
      code: promo.code,
      name: promo.name,
      kind: promo.kind,
      value: promo.value,
      min_spend: promo.min_spend,
      max_discount: promo.max_discount,
      quota: promo.quota,
      is_active: promo.is_active,
    })
    setDialogOpen(true)
  }

  const handleToggleActive = async (promo: Promo) => {
    try {
      const updated = await updatePromo(promo.id, {
        code: promo.code,
        name: promo.name,
        kind: promo.kind,
        value: promo.value,
        min_spend: promo.min_spend,
        max_discount: promo.max_discount,
        quota: promo.quota,
        is_active: !promo.is_active,
      })
      setPromos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setSnackbar({
        open: true,
        message: `Promo ${promo.code} ${updated.is_active ? 'diaktifkan' : 'dinonaktifkan'}`,
        severity: 'success',
      })
    } catch {
      setSnackbar({ open: true, message: 'Gagal memperbarui status promo', severity: 'error' })
    }
  }

  const handleDelete = async (id: string, code: string) => {
    if (!window.confirm(`Yakin ingin menghapus promo ${code}?`)) return
    try {
      await deletePromo(id)
      setPromos((prev) => prev.filter((p) => p.id !== id))
      setSnackbar({ open: true, message: `Promo ${code} berhasil dihapus`, severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Gagal menghapus promo', severity: 'error' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.code.trim()) {
      setSnackbar({ open: true, message: 'Kode promo wajib diisi', severity: 'error' })
      return
    }
    if (formData.value <= 0) {
      setSnackbar({ open: true, message: 'Nilai diskon harus lebih dari 0', severity: 'error' })
      return
    }

    setSubmitting(true)
    try {
      if (editingPromo) {
        const updated = await updatePromo(editingPromo.id, formData)
        setPromos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        setSnackbar({ open: true, message: `Promo ${updated.code} berhasil diperbarui`, severity: 'success' })
      } else {
        const created = await createPromo(formData)
        setPromos((prev) => [created, ...prev])
        setSnackbar({ open: true, message: `Promo ${created.code} berhasil ditambahkan`, severity: 'success' })
      }
      setDialogOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Promo & Voucher Belanja
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Kelola kode voucher diskon kasir, batas pemakaian kuota, dan program promosi toko.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshOutlined />}
            onClick={loadData}
            sx={{ borderColor: 'divider', color: 'text.secondary' }}
          >
            Segarkan
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddOutlined />}
            onClick={handleOpenCreate}
            sx={{ fontWeight: 600 }}
          >
            Tambah Promo
          </Button>
        </Stack>
      </Stack>

      {/* KPI Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        <Card variant="outlined" sx={{ borderColor: 'divider', bgcolor: 'background.paper' }}>
          <CardContent sx={{ py: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  PROMO AKTIF
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: 'text.primary' }}>
                  {totalActive} / {promos.length}
                </Typography>
              </Box>
              <Chip
                icon={<CardGiftcardOutlined sx={{ fontSize: '18px !important' }} />}
                label="Aktif"
                size="small"
                sx={{
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(34, 197, 94, 0.15)' : '#ecfdf5',
                  color: (theme) =>
                    theme.palette.mode === 'dark' ? '#4ade80' : '#047857',
                  fontWeight: 600,
                }}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderColor: 'divider', bgcolor: 'background.paper' }}>
          <CardContent sx={{ py: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  TOTAL PEMAKAIAN VOUCHER
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: 'text.primary' }}>
                  {totalRedemptions} {totalQuota > 0 ? `/ ${totalQuota}` : 'Kali'}
                </Typography>
              </Box>
              <Chip
                icon={<ConfirmationNumberOutlined sx={{ fontSize: '18px !important' }} />}
                label="Redemptions"
                size="small"
                sx={{
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                  color: (theme) =>
                    theme.palette.mode === 'dark' ? '#60a5fa' : '#1d4ed8',
                  fontWeight: 600,
                }}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderColor: 'divider', bgcolor: 'background.paper' }}>
          <CardContent sx={{ py: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  STATUS KAMPANYE
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5, color: 'text.primary' }}>
                  Siap Digunakan di POS
                </Typography>
              </Box>
              <Chip
                icon={<PercentOutlined sx={{ fontSize: '18px !important' }} />}
                label="Diskon Otomatis"
                size="small"
                sx={{
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255, 138, 61, 0.15)' : '#fff7ed',
                  color: '#FF8A3D',
                  fontWeight: 600,
                }}
              />
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Toolbar Filter */}
      <Card variant="outlined" sx={{ borderColor: 'divider', bgcolor: 'background.paper' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '5fr 3fr 4fr' },
              gap: 2,
              alignItems: 'center',
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder="Cari kode voucher atau nama promo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl fullWidth size="small">
              <Select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value as 'all' | PromoKind)}
                displayEmpty
              >
                <MenuItem value="all">Semua Tipe Diskon</MenuItem>
                <MenuItem value="percent">Persentase (%)</MenuItem>
                <MenuItem value="nominal">Nominal (Rp)</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                displayEmpty
              >
                <MenuItem value="all">Semua Status</MenuItem>
                <MenuItem value="active">Aktif Saja</MenuItem>
                <MenuItem value="inactive">Non-Aktif Saja</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* Promos Table */}
      <TableContainer
        component={Card}
        variant="outlined"
        sx={{ borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Table size="medium">
          <TableHead>
            <TableRow sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#172238' : '#f8fafc') }}>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Kode Voucher</TableCell>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Nama Promo</TableCell>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Besar Diskon</TableCell>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Min. Belanja</TableCell>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Pemakaian / Kuota</TableCell>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Aksi
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ py: 6, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Memuat data promo & voucher...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : filteredPromos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ py: 8, textAlign: 'center' }}>
                  <Stack alignItems="center" spacing={1.5}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        bgcolor: 'background.default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px dashed',
                        borderColor: 'divider',
                      }}
                    >
                      <CardGiftcardOutlined sx={{ color: 'text.secondary', fontSize: 24 }} />
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {search ? 'Tidak ada promo yang cocok' : 'Belum ada promo terdaftar'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 360 }}>
                      {search
                        ? 'Coba ganti kata kunci pencarian atau filter status.'
                        : 'Buat kode voucher pertama untuk memberikan diskon belanja di kasir POS.'}
                    </Typography>
                    {!search && (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddOutlined />}
                        onClick={handleOpenCreate}
                        sx={{ mt: 1 }}
                      >
                        Tambah Promo Pertama
                      </Button>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ) : (
              filteredPromos.map((promo) => {
                const isExhausted = promo.quota > 0 && promo.used_count >= promo.quota
                const progress = promo.quota > 0 ? (promo.used_count / promo.quota) * 100 : 0

                return (
                  <TableRow key={promo.id} hover>
                    {/* Kode Voucher */}
                    <TableCell>
                      <Chip
                        label={promo.code}
                        size="small"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          bgcolor: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(255, 138, 61, 0.15)' : '#fff7ed',
                          color: '#FF8A3D',
                          borderColor: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(255, 138, 61, 0.3)' : '#fed7aa',
                          borderWidth: 1,
                          borderStyle: 'solid',
                        }}
                      />
                    </TableCell>

                    {/* Nama Promo */}
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        {promo.name || 'Promo Tanpa Judul'}
                      </Typography>
                    </TableCell>

                    {/* Besar Diskon */}
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        {promo.kind === 'percent'
                          ? `${promo.value}%`
                          : formatRupiah(promo.value)}
                      </Typography>
                      {promo.kind === 'percent' && promo.max_discount > 0 && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          Maks {formatRupiah(promo.max_discount)}
                        </Typography>
                      )}
                    </TableCell>

                    {/* Min Belanja */}
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {promo.min_spend > 0 ? formatRupiah(promo.min_spend) : 'Tanpa Min.'}
                      </Typography>
                    </TableCell>

                    {/* Pemakaian / Kuota */}
                    <TableCell sx={{ minWidth: 140 }}>
                      <Stack spacing={0.5}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {promo.used_count} / {promo.quota > 0 ? `${promo.quota} kuota` : '∞'}
                          </Typography>
                          {promo.quota > 0 && (
                            <Typography variant="caption" sx={{ fontWeight: 600, color: isExhausted ? 'error.main' : 'text.secondary' }}>
                              {Math.round(progress)}%
                            </Typography>
                          )}
                        </Stack>
                        {promo.quota > 0 && (
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(100, progress)}
                            color={isExhausted ? 'error' : 'primary'}
                            sx={{ height: 4, borderRadius: 2 }}
                          />
                        )}
                      </Stack>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Switch
                          size="small"
                          checked={promo.is_active}
                          onChange={() => handleToggleActive(promo)}
                        />
                        <Chip
                          label={isExhausted ? 'Habis' : promo.is_active ? 'Aktif' : 'Non-Aktif'}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            bgcolor: (theme) => {
                              if (isExhausted) return theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2'
                              return promo.is_active
                                ? theme.palette.mode === 'dark' ? 'rgba(34, 197, 94, 0.15)' : '#ecfdf5'
                                : theme.palette.mode === 'dark' ? 'rgba(148, 163, 184, 0.15)' : '#f1f5f9'
                            },
                            color: (theme) => {
                              if (isExhausted) return theme.palette.mode === 'dark' ? '#f87171' : '#b91c1c'
                              return promo.is_active
                                ? theme.palette.mode === 'dark' ? '#4ade80' : '#047857'
                                : theme.palette.mode === 'dark' ? '#94a3b8' : '#475569'
                            },
                          }}
                        />
                      </Stack>
                    </TableCell>

                    {/* Aksi */}
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Ubah Promo">
                          <IconButton size="small" onClick={() => handleOpenEdit(promo)} sx={{ color: 'text.secondary' }}>
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Hapus Promo">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(promo.id, promo.code)}
                            sx={{ color: 'error.main' }}
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Modal Dialog Form Tambah / Edit Promo */}
      <Dialog
        open={dialogOpen}
        onClose={() => !submitting && setDialogOpen(false)}
        TransitionComponent={ModalSlideTransition}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ p: 2.5, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {editingPromo ? 'Edit Promo / Voucher' : 'Tambah Promo Baru'}
            </Typography>
            <IconButton size="small" onClick={() => setDialogOpen(false)} disabled={submitting}>
              <CloseOutlined fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>

        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
            >
              {/* Kode Promo */}
              <Box>
                <TextField
                  fullWidth
                  label="Kode Voucher *"
                  placeholder="Contoh: PAWHEMAT10"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '') })
                  }
                  helperText="Huruf kapital tanpa spasi"
                  disabled={submitting}
                  autoFocus
                />
              </Box>

              {/* Nama Promo */}
              <Box>
                <TextField
                  fullWidth
                  label="Nama / Judul Promo"
                  placeholder="Diskon Akhir Pekan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={submitting}
                />
              </Box>

              {/* Tipe Diskon */}
              <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 1, display: 'block' }}>
                  JENIS POTONGAN
                </Typography>
                <RadioGroup
                  row
                  value={formData.kind}
                  onChange={(e) => setFormData({ ...formData, kind: e.target.value as PromoKind })}
                >
                  <FormControlLabel
                    value="percent"
                    control={<Radio size="small" />}
                    label="Persentase (%)"
                  />
                  <FormControlLabel
                    value="nominal"
                    control={<Radio size="small" />}
                    label="Nominal Tetap (Rp)"
                  />
                </RadioGroup>
              </Box>

              {/* Nilai Diskon */}
              <Box>
                <TextField
                  fullWidth
                  type="number"
                  label={formData.kind === 'percent' ? 'Persen Diskon (%) *' : 'Nominal Diskon (Rp) *'}
                  value={formData.value || ''}
                  onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        {formData.kind === 'percent' ? '%' : 'IDR'}
                      </InputAdornment>
                    ),
                  }}
                  disabled={submitting}
                />
              </Box>

              {/* Minimal Belanja */}
              <Box>
                <TextField
                  fullWidth
                  type="number"
                  label="Minimal Belanja (Rp)"
                  value={formData.min_spend || ''}
                  onChange={(e) => setFormData({ ...formData, min_spend: Number(e.target.value) })}
                  helperText="Isi 0 jika tanpa minimal belanja"
                  disabled={submitting}
                />
              </Box>

              {/* Batas Maksimal Diskon (Jika Persentase) */}
              {formData.kind === 'percent' && (
                <Box>
                  <TextField
                    fullWidth
                    type="number"
                    label="Maksimal Potongan (Rp)"
                    value={formData.max_discount || ''}
                    onChange={(e) => setFormData({ ...formData, max_discount: Number(e.target.value) })}
                    helperText="0 jika tanpa batas maksimal"
                    disabled={submitting}
                  />
                </Box>
              )}

              {/* Kuota Pemakaian */}
              <Box sx={{ gridColumn: formData.kind === 'percent' ? undefined : { sm: 'span 2' } }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Kuota Total Pemakaian"
                  value={formData.quota || ''}
                  onChange={(e) => setFormData({ ...formData, quota: Number(e.target.value) })}
                  helperText="0 jika tanpa batas kuota"
                  disabled={submitting}
                />
              </Box>

              {/* Status Aktif */}
              <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' } }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active ?? true}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                  }
                  label="Aktifkan voucher ini sekarang"
                />
              </Box>
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button onClick={() => setDialogOpen(false)} disabled={submitting} sx={{ color: 'text.secondary' }}>
              Batal
            </Button>
            <Button type="submit" variant="contained" color="primary" disabled={submitting}>
              {submitting ? 'Menyimpan...' : editingPromo ? 'Simpan Perubahan' : 'Buat Promo'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Feedback Toast */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ width: '100%', boxShadow: 3 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  )
}
