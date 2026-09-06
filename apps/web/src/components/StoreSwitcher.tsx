import { useState, useEffect } from 'react'
import {
  AddBusinessOutlined,
  CheckCircleOutline,
  KeyboardArrowDownOutlined,
  StorefrontOutlined,
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
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { ModalSlideTransition } from './ModalSlideTransition'
import {
  DEFAULT_TENANT,
  getActiveTenant,
  getTenants,
  registerTenant,
  setActiveTenant,
  Tenant,
  TenantApiError,
} from '../features/tenant/tenantApi'
import { useRbac } from '../features/auth/rbac'

export function StoreSwitcher({ fullWidth = false }: { fullWidth?: boolean } = {}) {
  const { hasPermission } = useRbac()
  const canRegisterStore = hasPermission('register_store')

  const [activeTenant, setActiveTenantState] = useState<Tenant>(getActiveTenant())
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [tenants, setTenants] = useState<Tenant[]>([DEFAULT_TENANT])
  const [registerOpen, setRegisterOpen] = useState(false)
  const [registerName, setRegisterName] = useState('')
  const [registerSlug, setRegisterSlug] = useState('')
  const [registerPlan, setRegisterPlan] = useState('starter')
  const [submitting, setSubmitting] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)

  // Listen for tenant change events across components
  useEffect(() => {
    const handleTenantChange = (e: Event) => {
      const customEvent = e as CustomEvent<Tenant>
      if (customEvent.detail) {
        setActiveTenantState(customEvent.detail)
      }
    }
    window.addEventListener('pawpos:tenant_change', handleTenantChange)
    return () => {
      window.removeEventListener('pawpos:tenant_change', handleTenantChange)
    }
  }, [])

  // Fetch registered stores on mount
  useEffect(() => {
    let active = true
    getTenants()
      .then((list) => {
        if (active && list && list.length > 0) {
          setTenants(list)
        }
      })
      .catch(() => {
        // Silent fallback to default tenant
      })
    return () => {
      active = false
    }
  }, [])

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleCloseMenu = () => {
    setAnchorEl(null)
  }

  const handleSelectTenant = (t: Tenant) => {
    setActiveTenant(t)
    setActiveTenantState(t)
    handleCloseMenu()
  }

  const handleOpenRegister = () => {
    handleCloseMenu()
    setRegisterName('')
    setRegisterSlug('')
    setRegisterPlan('starter')
    setRegisterError(null)
    setRegisterOpen(true)
  }

  const handleNameChange = (val: string) => {
    setRegisterName(val)
    // Auto-generate slug from name
    const generated = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    setRegisterSlug(generated)
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!registerName.trim()) {
      setRegisterError('Nama toko wajib diisi.')
      return
    }
    if (!registerSlug.trim()) {
      setRegisterError('Slug / identifier toko wajib diisi.')
      return
    }

    setSubmitting(true)
    setRegisterError(null)

    try {
      const created = await registerTenant({
        name: registerName.trim(),
        slug: registerSlug.trim(),
        plan_type: registerPlan,
      })
      setTenants((prev) => [...prev, created])
      setActiveTenant(created)
      setActiveTenantState(created)
      setRegisterOpen(false)
    } catch (err) {
      if (err instanceof TenantApiError) {
        setRegisterError(err.message)
      } else {
        setRegisterError('Gagal mendaftarkan merchant baru. Silakan coba lagi.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        onClick={handleOpenMenu}
        aria-label="Pilih merchant toko"
        variant="outlined"
        size="small"
        fullWidth={fullWidth}
        sx={{
          textTransform: 'none',
          bgcolor: 'background.paper',
          borderColor: 'divider',
          color: 'text.primary',
          fontWeight: 650,
          borderRadius: '8px',
          width: fullWidth ? '100%' : 'auto',
          justifyContent: fullWidth ? 'space-between' : 'flex-start',
          px: { xs: 1, sm: 1.25 },
          py: 0.6,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          '&:hover': {
            bgcolor: 'action.hover',
            borderColor: 'divider',
          },
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <StorefrontOutlined sx={{ fontSize: '1.1rem', color: '#FF8A3D', flexShrink: 0 }} />
          <Typography
            variant="body2"
            noWrap
            sx={{
              fontWeight: 700,
              fontSize: '0.8rem',
              color: 'text.primary',
            }}
          >
            {activeTenant.name}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
          <Chip
            label={activeTenant.plan_type.toUpperCase()}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.6rem',
              fontWeight: 700,
              bgcolor: '#FFF5ED',
              color: '#FF8A3D',
            }}
          />
          <KeyboardArrowDownOutlined sx={{ fontSize: '0.95rem', color: '#94a3b8' }} />
        </Stack>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        PaperProps={{
          sx: {
            width: 280,
            maxWidth: '90vw',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            p: 1,
          },
        }}
      >
        <Box sx={{ px: 1.5, py: 1 }}>
          <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>
            MERCHANT / OUTLET AKTIF
          </Typography>
        </Box>

        {tenants.map((t) => {
          const isSelected = t.id === activeTenant.id
          return (
            <MenuItem
              key={t.id}
              onClick={() => handleSelectTenant(t)}
              sx={{
                borderRadius: '8px',
                my: 0.25,
                bgcolor: isSelected ? 'warning.light' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                {isSelected ? (
                  <CheckCircleOutline sx={{ fontSize: '1.1rem', color: '#ea580c' }} />
                ) : (
                  <StorefrontOutlined sx={{ fontSize: '1.1rem', color: '#94a3b8' }} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={t.name}
                secondary={t.slug + '.pawpos.id'}
                primaryTypographyProps={{
                  fontSize: '0.86rem',
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? 'primary.main' : 'text.primary',
                }}
                secondaryTypographyProps={{ fontSize: '0.72rem', color: 'text.secondary' }}
              />
            </MenuItem>
          )
        })}

        <Divider sx={{ my: 1 }} />

        {canRegisterStore ? (
          <MenuItem
            onClick={handleOpenRegister}
            sx={{
              borderRadius: '8px',
              color: '#ff8042',
              fontWeight: 650,
              fontSize: '0.84rem',
              '&:hover': { bgcolor: '#fff7ed' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <AddBusinessOutlined sx={{ fontSize: '1.15rem', color: '#ff8042' }} />
            </ListItemIcon>
            <ListItemText
              primary="+ Daftarkan Toko Baru"
              primaryTypographyProps={{ fontSize: '0.84rem', fontWeight: 700, color: '#ff8042' }}
            />
          </MenuItem>
        ) : (
          <MenuItem
            disabled
            sx={{
              borderRadius: '8px',
              fontSize: '0.84rem',
              opacity: 0.6,
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <AddBusinessOutlined sx={{ fontSize: '1.15rem', color: '#94a3b8' }} />
            </ListItemIcon>
            <ListItemText
              primary="+ Daftarkan Toko Baru (Khusus Owner)"
              primaryTypographyProps={{ fontSize: '0.8rem', color: '#94a3b8' }}
            />
          </MenuItem>
        )}
      </Menu>

      {/* Modal Slide Transition Dialog for New Merchant Registration */}
      <Dialog
        open={registerOpen}
        onClose={() => !submitting && setRegisterOpen(false)}
        TransitionComponent={ModalSlideTransition}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            p: { xs: 1, sm: 2 },
          },
        }}
      >
        <form onSubmit={handleRegisterSubmit}>
          <DialogTitle sx={{ fontWeight: 800, fontSize: '1.2rem', color: 'text.primary', pb: 0.5 }}>
            Daftarkan Toko / Merchant Baru
          </DialogTitle>
          <Typography variant="body2" sx={{ px: 3, color: 'text.secondary', fontSize: '0.84rem' }}>
            Tambahkan workspace toko terisolasi pada platform SaaS PawPOS.
          </Typography>

          <DialogContent sx={{ pt: 2.5 }}>
            <Stack spacing={2.5}>
              {registerError && (
                <Alert severity="error" sx={{ borderRadius: '8px', fontSize: '0.84rem' }}>
                  {registerError}
                </Alert>
              )}

              <TextField
                label="Nama Toko / Bisnis"
                placeholder="misal: Kopi Janji Senja"
                value={registerName}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                fullWidth
                size="small"
                autoFocus
              />

              <TextField
                label="Slug Subdomain"
                placeholder="misal: kopi-janji-senja"
                value={registerSlug}
                onChange={(e) => setRegisterSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                helperText={`Domain toko: ${registerSlug || 'slug'}.pawpos.id`}
                required
                fullWidth
                size="small"
              />

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1, display: 'block' }}>
                  PAKET LANGGANAN
                </Typography>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    type="button"
                    variant={registerPlan === 'starter' ? 'contained' : 'outlined'}
                    onClick={() => setRegisterPlan('starter')}
                    sx={{
                      flex: 1,
                      textTransform: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      bgcolor: registerPlan === 'starter' ? '#ff8042' : 'transparent',
                      color: registerPlan === 'starter' ? '#ffffff' : 'text.primary',
                      borderColor: registerPlan === 'starter' ? '#ff8042' : 'divider',
                      '&:hover': {
                        bgcolor: registerPlan === 'starter' ? '#e06b2f' : 'action.hover',
                      },
                    }}
                  >
                    Starter (Gratis)
                  </Button>
                  <Button
                    type="button"
                    variant={registerPlan === 'pro' ? 'contained' : 'outlined'}
                    onClick={() => setRegisterPlan('pro')}
                    sx={{
                      flex: 1,
                      textTransform: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      bgcolor: registerPlan === 'pro' ? '#ff8042' : 'transparent',
                      color: registerPlan === 'pro' ? '#ffffff' : 'text.primary',
                      borderColor: registerPlan === 'pro' ? '#ff8042' : 'divider',
                      '&:hover': {
                        bgcolor: registerPlan === 'pro' ? '#e06b2f' : 'action.hover',
                      },
                    }}
                  >
                    Pro Merchant
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button
              type="button"
              disabled={submitting}
              onClick={() => setRegisterOpen(false)}
              sx={{ textTransform: 'none', color: 'text.secondary', fontWeight: 650 }}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              variant="contained"
              sx={{
                textTransform: 'none',
                bgcolor: '#ff8042',
                fontWeight: 700,
                borderRadius: '8px',
                px: 3,
                '&:hover': { bgcolor: '#e06b2f' },
              }}
            >
              {submitting ? 'Mendaftarkan...' : 'Daftarkan Toko'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  )
}
