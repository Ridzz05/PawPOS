import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AddOutlined,
  CloseOutlined,
  CloudUploadOutlined,
  DeleteOutline,
  EditOutlined,
  ImageOutlined,
  RefreshOutlined,
  SearchOutlined,
  StorefrontOutlined,
  TrendingUpOutlined,
  Inventory2Outlined,
} from '@mui/icons-material'
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
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
import { convertImageToWebp, formatFileSize } from './imageConverter'
import { PawLoading } from '../../components/PawLoading'
import {
  createCategory,
  createProduct,
  deleteProduct,
  getCategories,
  getProducts,
  ProductsApiError,
  updateProduct,
  uploadProductImage,
  type Category,
  type Product,
} from './productsApi'
import { formatCurrency, formatNominalInput, parseThousand } from '../../utils/currency'
import { ModalSlideTransition } from '../../components/ModalSlideTransition'
import { useRbac } from '../auth/rbac'

export function ProductsPage() {
  const { hasPermission } = useRbac()
  const canCreateEdit = hasPermission('create_edit_products')
  const canDelete = hasPermission('delete_products')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'has_image'>('all')

  // Form states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [categoryInput, setCategoryInput] = useState('')
  const [baseUnit, setBaseUnit] = useState('pcs')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [minimumStock, setMinimumStock] = useState('0')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete modal state
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Toast / notification
  const [snackbarMessage, setSnackbarMessage] = useState('')

  // Image upload & auto-webp conversion states
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [conversionBadge, setConversionBadge] = useState<string>('')
  const [isConvertingImage, setIsConvertingImage] = useState(false)

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categories) {
      map.set(c.id, c.name)
    }
    return map
  }, [categories])

  const loadProducts = () => {
    setStatus('loading')
    setErrorMessage('')
    getProducts()
      .then((data) => {
        setProducts(data)
        setStatus('success')
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Gagal memuat produk.')
        setStatus('error')
      })
    getCategories()
      .then((data) => setCategories(data))
      .catch(() => setCategories([]))
  }

  useEffect(() => {
    loadProducts()
    const handleTenant = () => loadProducts()
    window.addEventListener('pawpos:tenant_change', handleTenant)
    return () => window.removeEventListener('pawpos:tenant_change', handleTenant)
  }, [])

  const resetForm = () => {
    setEditingProduct(null)
    setSku('')
    setName('')
    setCategoryInput('')
    setBaseUnit('pcs')
    setPurchasePrice('')
    setSellingPrice('')
    setMinimumStock('0')
    setSelectedImageFile(null)
    setImagePreview('')
    setConversionBadge('')
    setFieldErrors({})
    setSubmitError('')
  }

  const handleOpenDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p)
    setSku(p.sku)
    setName(p.name)
    setCategoryInput(p.category_id ? (categoryNameById.get(p.category_id) ?? '') : '')
    setBaseUnit(p.base_unit)
    setPurchasePrice(formatNominalInput(String(p.purchase_price_idr)))
    setSellingPrice(formatNominalInput(String(p.selling_price_idr)))
    setMinimumStock(String(p.minimum_stock))
    setSelectedImageFile(null)
    setImagePreview(
      p.image_url
        ? p.image_url.startsWith('http')
          ? p.image_url
          : `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'}${p.image_url}`
        : '',
    )
    setConversionBadge('')
    setFieldErrors({})
    setSubmitError('')
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    if (isSubmitting) return
    setDialogOpen(false)
    setEditingProduct(null)
  }

  const handleOpenDelete = (p: Product) => {
    setDeletingProduct(p)
    setDeleteError('')
  }

  const handleCloseDelete = () => {
    if (isDeleting) return
    setDeletingProduct(null)
    setDeleteError('')
  }

  const handleConfirmDelete = async () => {
    if (!deletingProduct) return
    setIsDeleting(true)
    setDeleteError('')
    try {
      await deleteProduct(deletingProduct.id)
      setProducts((prev) => prev.filter((item) => item.id !== deletingProduct.id))
      setSnackbarMessage(`Produk "${deletingProduct.name}" berhasil dihapus.`)
      setDeletingProduct(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus produk.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFieldErrors({})
    setSubmitError('')

    const errors: Record<string, string> = {}
    if (!sku.trim()) errors.sku = 'SKU wajib diisi.'
    if (!name.trim()) errors.name = 'Nama produk wajib diisi.'
    if (!baseUnit.trim()) errors.base_unit = 'Satuan dasar wajib diisi.'

    const pPrice = parseThousand(purchasePrice)
    if (!purchasePrice.trim() || isNaN(pPrice) || pPrice < 0) {
      errors.purchase_price_idr = 'Harga beli harus berupa angka non-negatif.'
    }

    const sPrice = parseThousand(sellingPrice)
    if (!sellingPrice.trim() || isNaN(sPrice) || sPrice < 0) {
      errors.selling_price_idr = 'Harga jual harus berupa angka non-negatif.'
    }

    const minStock = Number(minimumStock)
    if (isNaN(minStock) || minStock < 0) {
      errors.minimum_stock = 'Stok minimal harus berupa angka non-negatif.'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setIsSubmitting(true)
    try {
      // Resolve category name to id (create on the fly when new).
      let categoryId: string | null = null
      const cleanCategory = categoryInput.trim()
      if (cleanCategory) {
        const existing =
          categories.find((c) => c.name.toLowerCase() === cleanCategory.toLowerCase()) ??
          (await getCategories()
            .then((fresh) => {
              setCategories(fresh)
              return fresh.find((c) => c.name.toLowerCase() === cleanCategory.toLowerCase())
            })
            .catch(() => undefined))
        if (existing) {
          categoryId = existing.id
        } else {
          try {
            const created = await createCategory(cleanCategory)
            categoryId = created.id
            setCategories((prev) =>
              prev.some((c) => c.id === created.id) ? prev : [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
            )
          } catch (catErr) {
            if (catErr instanceof ProductsApiError && catErr.code === 'CATEGORY_EXISTS') {
              const fresh = await getCategories().catch(() => [] as Category[])
              setCategories(fresh)
              categoryId = fresh.find((c) => c.name.toLowerCase() === cleanCategory.toLowerCase())?.id ?? null
            } else {
              throw catErr
            }
          }
        }
      }

      if (editingProduct) {
        let imageUrl: string | null | undefined = editingProduct.image_url
        if (selectedImageFile) {
          const uploadRes = await uploadProductImage(selectedImageFile)
          imageUrl = uploadRes.url
        } else if (!imagePreview) {
          imageUrl = null
        }

        const updated = await updateProduct(editingProduct.id, {
          sku: sku.trim(),
          name: name.trim(),
          category_id: categoryId,
          base_unit: baseUnit.trim(),
          purchase_price_idr: pPrice,
          selling_price_idr: sPrice,
          minimum_stock: minStock,
          image_url: imageUrl,
        })

        setProducts((prev) => prev.map((item) => (item.id === editingProduct.id ? updated : item)))
        setSnackbarMessage(`Produk "${updated.name}" berhasil diperbarui.`)
        handleCloseDialog()
      } else {
        let imageUrl: string | undefined = undefined
        if (selectedImageFile) {
          const uploadRes = await uploadProductImage(selectedImageFile)
          imageUrl = uploadRes.url
        }

        const created = await createProduct({
          sku: sku.trim(),
          name: name.trim(),
          category_id: categoryId,
          base_unit: baseUnit.trim(),
          purchase_price_idr: pPrice,
          selling_price_idr: sPrice,
          minimum_stock: minStock,
          image_url: imageUrl,
        })

        setProducts((prev) => [created, ...prev])
        setSnackbarMessage(`Produk "${created.name}" berhasil ditambahkan.`)
        handleCloseDialog()
      }
    } catch (err) {
      if (err instanceof ProductsApiError) {
        setSubmitError(err.message)
      } else {
        setSubmitError('Terjadi kesalahan saat menyimpan produk.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchSearch) return false
      if (filterType === 'has_image') return Boolean(p.image_url)
      return true
    })
  }, [products, searchQuery, filterType])

  return (
    <Stack spacing={2.5}>
      {/* Header Bar */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-end' }}
        spacing={2}
      >
        <Box>
          <Typography variant="overline" color="primary.main">
            KATALOG OPERASIONAL
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
            Produk
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Master katalog SKU, konversi foto WebP instan, dan struktur harga jual-beli.
          </Typography>
        </Box>
        {canCreateEdit && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddOutlined />}
            onClick={handleOpenDialog}
            sx={{
              minHeight: 42,
              px: 2.5,
              borderRadius: '8px',
              width: { xs: '100%', sm: 'auto' },
              alignSelf: { xs: 'stretch', sm: 'center' },
            }}
          >
            Tambah Produk
          </Button>
        )}
      </Stack>

      {/* Catalog Metrics Bar - Flat Terminal Cards */}
      {products.length > 0 && (
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
                  TOTAL PRODUK
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 850, color: 'text.primary', mt: 0.25, fontSize: '1.35rem', letterSpacing: '-0.025em' }} className="tnum">
                  {products.length} SKU
                </Typography>
              </Box>
              <StorefrontOutlined sx={{ color: '#ff7a30', fontSize: 22 }} />
            </Stack>
          </Box>

          <Box className="terminal-card" sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                  PRODUK AKTIF
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 850, color: '#047857', mt: 0.25, fontSize: '1.35rem', letterSpacing: '-0.025em' }} className="tnum">
                  {products.filter((p) => p.is_active).length} Item
                </Typography>
              </Box>
              <TrendingUpOutlined sx={{ color: '#10b981', fontSize: 22 }} />
            </Stack>
          </Box>

          <Box className="terminal-card" sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                  DILENGKAPI FOTO
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 850, color: 'text.primary', mt: 0.25, fontSize: '1.35rem', letterSpacing: '-0.025em' }} className="tnum">
                  {products.filter((p) => Boolean(p.image_url)).length} Item
                </Typography>
              </Box>
              <ImageOutlined sx={{ color: '#6366f1', fontSize: 22 }} />
            </Stack>
          </Box>

          <Box className="terminal-card" sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                  SATUAN DASAR
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 850, color: 'text.primary', mt: 0.25, fontSize: '1.35rem', letterSpacing: '-0.025em' }} className="tnum">
                  {new Set(products.map((p) => p.base_unit)).size} Varian
                </Typography>
              </Box>
              <Inventory2Outlined sx={{ color: '#0284c7', fontSize: 22 }} />
            </Stack>
          </Box>
        </Box>
      )}

      {/* Loading state */}
      {status === 'loading' && (
        <PawLoading label="Memuat katalog produk..." variant="card" />
      )}

      {/* Error state */}
      {status === 'error' && (
        <Alert
          severity="error"
          sx={{ borderRadius: '10px' }}
          action={
            <Button color="inherit" size="small" startIcon={<RefreshOutlined />} onClick={loadProducts} sx={{ borderRadius: '8px' }}>
              Coba lagi
            </Button>
          }
        >
          {errorMessage || 'Data katalog belum dapat dimuat. Pastikan API berjalan.'}
        </Alert>
      )}

      {/* Empty State */}
      {status === 'success' && products.length === 0 && (
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
              bgcolor: 'action.hover',
              color: 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <StorefrontOutlined sx={{ fontSize: 24 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 750, color: 'text.primary', mb: 1, fontSize: '1.1rem' }}>
            Katalog produk masih kosong
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480, mx: 'auto', mb: 3, lineHeight: 1.6 }}>
            Belum ada produk yang tersimpan di database. Daftarkan produk pertama untuk mengaktifkan register kasir dan saldo inventori.
          </Typography>
          {canCreateEdit && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddOutlined />}
              onClick={handleOpenDialog}
              sx={{ px: 3, py: 1, borderRadius: '8px' }}
            >
              Tambah Produk Pertama
            </Button>
          )}
        </Paper>
      )}

      {/* Product Table with Inset Toolbar */}
      {status === 'success' && products.length > 0 && (
        <Paper
          className="terminal-card"
          elevation={0}
          sx={{
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '12px',
          }}
        >
          {/* Integrated Search & Filter Inset Toolbar */}
          <Box
            sx={{
              p: 1.75,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: 'background.default',
            }}
          >
            <TextField
              size="small"
              placeholder="Cari SKU atau nama produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ minWidth: { xs: '100%', sm: 260 } }}
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

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                label="Semua"
                size="small"
                onClick={() => setFilterType('all')}
                color={filterType === 'all' ? 'primary' : 'default'}
                variant={filterType === 'all' ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer', fontWeight: 650 }}
              />
              <Chip
                label="Dengan Foto"
                size="small"
                onClick={() => setFilterType('has_image')}
                color={filterType === 'has_image' ? 'primary' : 'default'}
                variant={filterType === 'has_image' ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer', fontWeight: 650 }}
              />
            </Stack>
          </Box>

          <TableContainer sx={{ maxHeight: 680 }}>
            <Table aria-label="Tabel katalog produk" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 160, whiteSpace: 'nowrap' }}>SKU</TableCell>
                  <TableCell sx={{ minWidth: 260 }}>Nama Produk</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Kategori</TableCell>
                  <TableCell sx={{ minWidth: 100 }}>Satuan</TableCell>
                  <TableCell align="right" sx={{ minWidth: 130 }}>Harga Beli</TableCell>
                  <TableCell align="right" sx={{ minWidth: 130 }}>Harga Jual</TableCell>
                  <TableCell align="right" sx={{ minWidth: 110 }}>Stok Min.</TableCell>
                  <TableCell align="center" sx={{ minWidth: 90 }}>Status</TableCell>
                  <TableCell align="center" sx={{ minWidth: 100 }}>Aksi</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProducts.map((p) => (
                  <TableRow
                    key={p.id}
                    hover
                    sx={{
                      transition: 'background-color 0.15s ease',
                      '&:hover': { bgcolor: 'action.hover' },
                      '&:last-child td, &:last-child th': { border: 0 },
                    }}
                  >
                    <TableCell component="th" scope="row" sx={{ whiteSpace: 'nowrap' }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 750,
                          bgcolor: 'action.hover',
                          px: 1.25,
                          py: 0.35,
                          borderRadius: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          whiteSpace: 'nowrap',
                          fontSize: '0.82rem',
                          color: 'text.primary',
                          border: '1px solid',
                          borderColor: 'divider',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {p.sku}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
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
                              width: 42,
                              height: 42,
                              borderRadius: '10px',
                              objectFit: 'cover',
                              border: '1px solid',
                              borderColor: 'divider',
                              bgcolor: 'background.default',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <Avatar
                            variant="rounded"
                            sx={{
                              width: 42,
                              height: 42,
                              borderRadius: '10px',
                              bgcolor: 'action.hover',
                              color: 'text.secondary',
                              border: '1px solid',
                              borderColor: 'divider',
                              flexShrink: 0,
                            }}
                          >
                            <ImageOutlined sx={{ fontSize: 20 }} />
                          </Avatar>
                        )}
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary', lineHeight: 1.3, fontSize: '0.92rem', letterSpacing: '-0.015em' }}>
                            {p.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.74rem', fontWeight: 550 }}>
                            ID: {p.id.slice(0, 8)}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {p.category_id && categoryNameById.get(p.category_id) ? (
                        <Chip label={categoryNameById.get(p.category_id)} size="small" variant="outlined" sx={{ fontWeight: 650, maxWidth: 160 }} />
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={p.base_unit} size="small" variant="outlined" sx={{ textTransform: 'lowercase', fontWeight: 650 }} />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.86rem' }} className="tnum">
                        {formatCurrency(p.purchase_price_idr)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 850, color: '#ea580c', fontSize: '0.94rem', letterSpacing: '-0.02em' }} className="tnum">
                        {formatCurrency(p.selling_price_idr)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" className="tnum" sx={{ fontWeight: 750, color: 'text.primary', fontSize: '0.88rem' }}>
                        {p.minimum_stock}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={p.is_active ? 'Aktif' : 'Non-aktif'}
                        color={p.is_active ? 'success' : 'default'}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          height: 22,
                        }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        {canCreateEdit && (
                          <IconButton
                            size="small"
                            aria-label={`Edit ${p.name}`}
                            onClick={() => handleOpenEdit(p)}
                            sx={{
                              color: 'text.secondary',
                              '&:hover': { color: '#ff8042', bgcolor: '#fff7f2' },
                            }}
                          >
                            <EditOutlined fontSize="small" sx={{ fontSize: 18 }} />
                          </IconButton>
                        )}
                        {canDelete && (
                          <IconButton
                            size="small"
                            aria-label={`Hapus ${p.name}`}
                            onClick={() => handleOpenDelete(p)}
                            sx={{
                              color: 'text.secondary',
                              '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' },
                            }}
                          >
                            <DeleteOutline fontSize="small" sx={{ fontSize: 18 }} />
                          </IconButton>
                        )}
                        {!canCreateEdit && !canDelete && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.72rem' }}>
                            Lihat Saja
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Modal Tambah Produk Baru */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        TransitionComponent={ModalSlideTransition}
        fullWidth
        maxWidth="sm"
        aria-labelledby="tambah-produk-title"
      >
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <DialogTitle
            id="tambah-produk-title"
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
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em', fontSize: '1.1rem' }}>
                {editingProduct ? 'Edit Data Produk' : 'Tambah Produk Baru'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {editingProduct
                  ? `Perbarui detail SKU ${editingProduct.sku} dan struktur harga`
                  : 'Daftarkan SKU baru dengan opsi konversi otomatis foto ke .webp'}
              </Typography>
            </Box>
            <IconButton
              aria-label="Tutup form"
              onClick={handleCloseDialog}
              sx={{ position: 'absolute', right: 12, top: 12, color: 'text.secondary' }}
            >
              <CloseOutlined fontSize="small" />
            </IconButton>
          </DialogTitle>

          <Divider sx={{ borderColor: 'rgba(226, 232, 240, 0.8)' }} />

          <DialogContent sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              {submitError && (
                <Alert severity="error" role="alert" sx={{ borderRadius: '12px' }}>
                  {submitError}
                </Alert>
              )}

              {/* Upload Foto Produk dengan Konversi Otomatis ke WebP */}
              <Box
                className="terminal-inset"
                sx={{
                  p: 2,
                  textAlign: 'center',
                  border: '1.5px dashed #cbd5e1',
                  borderRadius: '10px',
                  transition: 'border-color 0.2s ease',
                  '&:hover': { borderColor: '#ff8042' },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 750,
                    letterSpacing: '0.04em',
                    color: 'text.secondary',
                    display: 'block',
                    mb: 1.25,
                    textTransform: 'uppercase',
                    fontSize: '0.72rem',
                  }}
                >
                  Foto Produk (Otomatis Dikonversi ke .WebP)
                </Typography>

                {imagePreview ? (
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ textAlign: 'left' }}>
                    <Box
                      component="img"
                      src={imagePreview}
                      alt="Preview"
                      sx={{
                        width: 56,
                        height: 56,
                        objectFit: 'cover',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {selectedImageFile?.name}
                      </Typography>
                      {conversionBadge && (
                        <Chip
                          size="small"
                          color="success"
                          variant="outlined"
                          label={conversionBadge}
                          sx={{ mt: 0.5, fontSize: '0.68rem', fontWeight: 650, height: 20 }}
                        />
                      )}
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label="Hapus foto produk"
                      onClick={() => {
                        setSelectedImageFile(null)
                        setImagePreview('')
                        setConversionBadge('')
                      }}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Stack>
                ) : (
                  <Button
                    component="label"
                    variant="outlined"
                    fullWidth
                    startIcon={<CloudUploadOutlined />}
                    disabled={isSubmitting || isConvertingImage}
                    sx={{
                      py: 1.5,
                      borderStyle: 'dashed',
                      borderColor: 'divider',
                      borderRadius: '12px',
                      bgcolor: 'background.paper',
                      color: 'text.primary',
                    }}
                  >
                    {isConvertingImage
                      ? 'Mengonversi gambar ke .webp...'
                      : 'Pilih Gambar Produk (.png, .jpg, .webp)'}
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setIsConvertingImage(true)
                          try {
                            const res = await convertImageToWebp(file)
                            setSelectedImageFile(res.file)
                            setImagePreview(res.previewUrl)
                            if (res.didConvert) {
                              setConversionBadge(
                                `Format ${file.name.split('.').pop()?.toUpperCase()} otomatis dikonversi ke .webp (${formatFileSize(res.originalSize)} → ${formatFileSize(res.convertedSize)})`,
                              )
                            } else {
                              setConversionBadge(`Format .webp (${formatFileSize(res.convertedSize)})`)
                            }
                          } finally {
                            setIsConvertingImage(false)
                          }
                        }
                      }}
                    />
                  </Button>
                )}
              </Box>

              <TextField
                fullWidth
                required
                label="SKU / Kode Barang"
                placeholder="misal: KOP-001"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                error={Boolean(fieldErrors.sku)}
                helperText={fieldErrors.sku || 'Kode unik identifikasi stok'}
                disabled={isSubmitting}
              />

              <TextField
                fullWidth
                required
                label="Nama Produk"
                placeholder="misal: Kopi Susu Gula Aren"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={Boolean(fieldErrors.name)}
                helperText={fieldErrors.name}
                disabled={isSubmitting}
              />

              <Autocomplete
                freeSolo
                fullWidth
                options={categories.map((c) => c.name)}
                value={categoryInput}
                onChange={(_, value) => setCategoryInput(value ?? '')}
                onInputChange={(_, value) => setCategoryInput(value)}
                disabled={isSubmitting}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Kategori"
                    placeholder="misal: Pakan Kucing (ketik baru untuk membuat)"
                    helperText="Daftar kategori diambil dari database. Nama baru otomatis dibuat."
                  />
                )}
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  required
                  label="Satuan Dasar"
                  placeholder="misal: cup, pcs, porsi"
                  value={baseUnit}
                  onChange={(e) => setBaseUnit(e.target.value)}
                  error={Boolean(fieldErrors.base_unit)}
                  helperText={fieldErrors.base_unit}
                  disabled={isSubmitting}
                />
                <TextField
                  fullWidth
                  type="number"
                  label="Stok Minimal"
                  value={minimumStock}
                  onChange={(e) => setMinimumStock(e.target.value)}
                  error={Boolean(fieldErrors.minimum_stock)}
                  helperText={fieldErrors.minimum_stock || 'Batas peringatan restock'}
                  disabled={isSubmitting}
                />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  required
                  label="Harga Beli (Rp)"
                  placeholder="0"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(formatNominalInput(e.target.value))}
                  error={Boolean(fieldErrors.purchase_price_idr)}
                  helperText={fieldErrors.purchase_price_idr}
                  disabled={isSubmitting}
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">Rp</InputAdornment>,
                      inputMode: 'numeric',
                    },
                  }}
                />
                <TextField
                  fullWidth
                  required
                  label="Harga Jual (Rp)"
                  placeholder="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(formatNominalInput(e.target.value))}
                  error={Boolean(fieldErrors.selling_price_idr)}
                  helperText={fieldErrors.selling_price_idr}
                  disabled={isSubmitting}
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">Rp</InputAdornment>,
                      inputMode: 'numeric',
                    },
                  }}
                />
              </Stack>
            </Stack>
          </DialogContent>

          <Divider sx={{ borderColor: 'rgba(226, 232, 240, 0.8)' }} />

          <DialogActions sx={{ p: 2, gap: 1.5 }}>
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleCloseDialog}
              disabled={isSubmitting}
              sx={{ px: 2.5 }}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isSubmitting}
              sx={{ px: 3 }}
            >
              {isSubmitting ? 'Menyimpan...' : editingProduct ? 'Simpan Perubahan' : 'Simpan Produk'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Modal Konfirmasi Hapus Produk */}
      <Dialog
        open={Boolean(deletingProduct)}
        onClose={handleCloseDelete}
        TransitionComponent={ModalSlideTransition}
        maxWidth="xs"
        fullWidth
        aria-labelledby="hapus-produk-title"
      >
        <DialogTitle id="hapus-produk-title" sx={{ fontWeight: 800, pb: 1, color: 'text.primary', fontSize: '1.05rem' }}>
          Hapus Produk?
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
              {deleteError}
            </Alert>
          )}
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
            Apakah Anda yakin ingin menghapus produk{' '}
            <Box component="strong" sx={{ color: 'text.primary' }}>
              {deletingProduct?.name}
            </Box>{' '}
            ({deletingProduct?.sku})?
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.25 }}>
            Produk ini tidak akan ditampilkan lagi di katalog aktif maupun register kasir POS.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={handleCloseDelete}
            disabled={isDeleting}
            sx={{ borderRadius: '8px', color: 'text.secondary', borderColor: '#cbd5e1' }}
          >
            Batal
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            sx={{ borderRadius: '8px', fontWeight: 700 }}
          >
            {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Notification */}
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
