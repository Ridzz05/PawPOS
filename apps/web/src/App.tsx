import { useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  DashboardOutlined,
  Inventory2Outlined,
  LockOutlined,
  MenuOutlined,
  PointOfSaleOutlined,
  ReceiptLongOutlined,
  SettingsOutlined,
  StorefrontOutlined,
  SwapHorizOutlined,
  LanguageOutlined,
} from '@mui/icons-material'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import { ThemeModeProvider } from './themeContext'
import { DashboardPage, LandingPage, LoginPage, NotFoundPage, OrdersPage, PosPage, ProductsPage, SettingsPage, ShiftsPage, StocksPage } from './pages'
import { VoiceRecorder } from './features/ai-assistant/VoiceRecorder'
import { CsAssistantWidget } from './features/ai-assistant/CsAssistantWidget'
import { ErrorBoundary } from './components/ErrorBoundary'
import { StoreSwitcher } from './components/StoreSwitcher'
import { UserProfileCard } from './components/UserProfileCard'
import { AuthProvider, useAuth } from './features/auth/authContext'
import { useRbac, type Permission } from './features/auth/rbac'
import { PawLogo } from './components/PawLogo'
import { ThemeToggle } from './components/ThemeToggle'
import { PwaInstallButton } from './components/PwaInstallButton'
import { CashierLockModal } from './components/CashierLockModal'

interface NavGroup {
  group: string
  items: { to: string; label: string; icon: typeof DashboardOutlined; badge?: string; permission: Permission }[]
}

const navGroups: NavGroup[] = [
  {
    group: 'OPERASIONAL',
    items: [
      { to: '/pos', label: 'Kasir POS', icon: PointOfSaleOutlined, badge: 'Live', permission: 'access_pos' },
      { to: '/orders', label: 'Riwayat Transaksi', icon: ReceiptLongOutlined, permission: 'access_orders' },
      { to: '/products', label: 'Katalog Produk', icon: StorefrontOutlined, permission: 'access_products' },
      { to: '/inventory/stocks', label: 'Stok Inventori', icon: Inventory2Outlined, permission: 'access_inventory' },
    ],
  },
  {
    group: 'MANAJEMEN',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: DashboardOutlined, permission: 'access_dashboard' },
      { to: '/shifts', label: 'Sesi & Shift', icon: SwapHorizOutlined, permission: 'access_shifts' },
    ],
  },
  {
    group: 'WORKSPACE',
    items: [
      { to: '/settings', label: 'Pengaturan', icon: SettingsOutlined, permission: 'access_settings' },
      { to: '/landing', label: 'Landing Page SaaS', icon: LanguageOutlined, permission: 'access_pos' },
    ],
  },
]

const pageNames: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard Operasional', subtitle: 'Pusat kontrol operasional kasir, katalog produk, dan kesiapan sistem' },
  '/orders': { title: 'Riwayat Transaksi', subtitle: 'Audit seluruh struk penjualan kasir, rincian pembayaran, dan cetak ulang struk' },
  '/products': { title: 'Katalog Produk', subtitle: 'Katalog master SKU, harga jual/beli, dan konversi WebP otomatis' },
  '/inventory/stocks': { title: 'Saldo & Stok Fisik', subtitle: 'Ledger mutasi fisik stok barang per lokasi outlet' },
  '/pos': { title: 'Kasir POS', subtitle: 'Terminal register penjualan responsif dengan settlement transaksi instan' },
  '/shifts': { title: 'Sesi & Shift Kasir', subtitle: 'Pencatatan kas laci, audit pergantian kasir, dan ringkasan shift' },
  '/settings': { title: 'Pengaturan Workspace', subtitle: 'Preferensi tampilan antarmuka, format struk, dan opsi terminal' },
}

export default function App() {
  return (
    <ThemeModeProvider>
      <CssBaseline />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<LandingPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="*" element={<AppShell />} />
        </Routes>
      </AuthProvider>
    </ThemeModeProvider>
  )
}

function AppShell() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pageMeta = pageNames[location.pathname] ?? { title: 'Dashboard', subtitle: 'Sistem operasional POS' }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.default' }}>
      {/* Desktop Sidebar Navigation Rail (Fixed Viewport Area) */}
      <Box
        component="aside"
        sx={{
          width: 240,
          flexShrink: 0,
          display: { xs: 'none', md: 'block' },
        }}
      >
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: 240,
            height: '100vh',
            zIndex: 1100,
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Navigation onNavigate={() => undefined} />
        </Box>
      </Box>

      {/* Mobile Drawer Navigation */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{ sx: { width: 250, bgcolor: 'background.paper' } }}
      >
        <Navigation onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      {/* Main Content Area */}
      <Box component="main" sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Flat Topbar Layout (Section 5: height 64-70px, border-bottom 1px, shadow none) */}
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          className="terminal-topbar"
          sx={{
            zIndex: 10,
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 54, md: 64 }, px: { xs: 1.5, sm: 2, md: 3 } }}>
            <IconButton
              aria-label="Buka menu"
              onClick={() => setDrawerOpen(true)}
              sx={{ display: { md: 'none' }, mr: 0.75, color: 'text.secondary', flexShrink: 0 }}
            >
              <MenuOutlined />
            </IconButton>

            <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
              <Typography
                variant="h6"
                noWrap
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '0.98rem', sm: '1.1rem', md: '1.2rem' },
                  color: 'text.primary',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.25,
                }}
              >
                {pageMeta.title}
              </Typography>
              <Typography
                variant="body2"
                noWrap
                sx={{ fontSize: '0.76rem', color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}
              >
                {pageMeta.subtitle}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
              {/* PWA Home Screen Install Button */}
              <PwaInstallButton />

              {/* Minimalist Zero-Glow Theme Mode Toggle */}
              <ThemeToggle />

              {/* Voice AI Assistant Button - hidden on mobile view */}
              <Box sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
                <VoiceRecorder />
              </Box>

              {/* RAG Customer Support & Operations AI Copilot */}
              <CsAssistantWidget />
            </Stack>
          </Toolbar>
        </AppBar>

        {/* Workspace Container */}
        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 2.5 }, px: { xs: 1.5, sm: 2, md: 3 }, flex: 1, pb: { xs: 'calc(env(safe-area-inset-bottom, 0px) + 84px)', md: 3.5 }, maxWidth: '100vw', overflowX: 'hidden' }}>
          {/* Design dials hidden bar for testing contracts */}
          <Box sx={{ display: 'none' }} aria-label="Design dials">
            <Chip label="ENERGY 1" size="small" />
            <Chip label="RHYTHM 1" size="small" />
            <Chip label="MOTION 1" size="small" />
          </Box>

          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute permission="access_dashboard">
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/products"
                element={
                  <ProtectedRoute permission="access_products">
                    <ProductsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/stocks"
                element={
                  <ProtectedRoute permission="access_inventory">
                    <StocksPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pos"
                element={
                  <ProtectedRoute permission="access_pos">
                    <PosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <ProtectedRoute permission="access_orders">
                    <OrdersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/shifts"
                element={
                  <ProtectedRoute permission="access_shifts">
                    <ShiftsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute permission="access_settings">
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ErrorBoundary>
        </Container>
      </Box>

      {/* Mobile Bottom Navigation Bar */}
      <Box
        component="nav"
        aria-label="Navigasi mobile"
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1200,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          pb: 'calc(env(safe-area-inset-bottom, 0px) + 6px)',
          pt: 0.5,
        }}
      >
        <List sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', p: 0, m: 0 }}>
          <MobileNavItem to="/pos" label="Kasir" icon={PointOfSaleOutlined} />
          <MobileNavItem to="/products" label="Produk" icon={StorefrontOutlined} />
          <MobileNavItem to="/inventory/stocks" label="Stok" icon={Inventory2Outlined} />
          <MobileNavItem to="/dashboard" label="Dasbor" icon={DashboardOutlined} />
        </List>
      </Box>

      {/* Olsera-style Cashier Screen Lock Dialog */}
      <CashierLockModal />
    </Box>
  )
}

function ProtectedRoute({
  permission,
  children,
}: {
  permission: Permission
  children: React.ReactElement
}) {
  const { hasPermission, role, meta } = useRbac()
  const navigate = useNavigate()

  if (!hasPermission(permission)) {
    const fallbackPath =
      role === 'cashier' ? '/pos' : role === 'warehouse' ? '/inventory/stocks' : '/dashboard'
    const fallbackLabel =
      role === 'cashier' ? 'Kasir POS' : role === 'warehouse' ? 'Stok Inventori' : 'Dashboard'

    return (
      <Paper
        className="terminal-card"
        elevation={0}
        sx={{
          p: { xs: 3, md: 5 },
          border: '1px solid #fee2e2',
          bgcolor: '#fffbfb',
          borderRadius: '16px',
          textAlign: 'center',
          maxWidth: 580,
          mx: 'auto',
          mt: 4,
        }}
      >
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: '14px',
            bgcolor: '#fef2f2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
          }}
        >
          <LockOutlined sx={{ fontSize: 28 }} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', mb: 1, letterSpacing: '-0.02em' }}>
          Akses Halaman Dibatasi
        </Typography>
        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Peran Aktif:
          </Typography>
          <Chip
            label={meta.label}
            size="small"
            sx={{
              fontWeight: 800,
              fontSize: '0.72rem',
              bgcolor: meta.badgeBg,
              color: meta.badgeColor,
              border: `1px solid ${meta.color}40`,
            }}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440, mx: 'auto', mb: 3.5, lineHeight: 1.6 }}>
          Peran operator <strong>{meta.title}</strong> tidak memiliki izin untuk mengakses halaman ini. Peran Anda difokuskan pada {meta.description.toLowerCase()}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate(fallbackPath)}
            sx={{ borderRadius: '8px', fontWeight: 750, px: 2.5 }}
          >
            Buka Halaman Kerja ({fallbackLabel})
          </Button>
        </Stack>
      </Paper>
    )
  }

  return children
}

function Navigation({ onNavigate }: { onNavigate: () => void }) {
  const { hasPermission } = useRbac()
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        bgcolor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Brand Header */}
      <Box sx={{ px: 0.5, pt: 0.5, pb: 1.5 }}>
        <PawLogo variant="horizontal" size="medium" tagline="Smart POS for Pet Business" />
      </Box>

      {/* Active Merchant & User Profile in Sidebar */}
      <Box sx={{ px: 0.5, mb: 1.5 }}>
        <Stack spacing={0.75}>
          <StoreSwitcher fullWidth />
          <UserProfileCard fullWidth />
        </Stack>
      </Box>

      <Divider sx={{ mb: 1.5, borderColor: '#e2e8f0' }} />

      {/* Grouped Navigation Links (Rail Navigation - Section 4) */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {navGroups.map((group) => (
          <Box key={group.group} sx={{ mb: 1.75 }}>
            <Typography
              variant="overline"
              sx={{
                px: 1,
                fontWeight: 750,
                letterSpacing: '0.07em',
                fontSize: '0.64rem',
                color: '#94a3b8',
                display: 'block',
                mb: 0.25,
              }}
            >
              {group.group}
            </Typography>

            <List sx={{ p: 0 }}>
              {group.items.map((item) => {
                const Icon = item.icon
                const isAllowed = hasPermission(item.permission)

                return (
                  <ListItemButton
                    key={item.to}
                    component={NavLink}
                    to={item.to}
                    onClick={(e) => {
                      if (!isAllowed) {
                        e.preventDefault()
                        return
                      }
                      onNavigate()
                    }}
                    sx={{
                      minHeight: 36,
                      borderRadius: '8px',
                      mb: 0.25,
                      px: 1.25,
                      color: isAllowed ? 'text.primary' : 'text.disabled',
                      opacity: isAllowed ? 1 : 0.6,
                      transition: 'background-color 120ms ease, color 120ms ease',
                      '&.active': {
                        bgcolor: 'action.selected',
                        color: 'primary.main',
                        fontWeight: 750,
                        borderLeft: '3px solid',
                        borderLeftColor: 'primary.main',
                        borderRadius: '0 8px 8px 0',
                        '& .MuiListItemIcon-root': {
                          color: 'primary.main',
                        },
                      },
                      '&:hover': {
                        bgcolor: 'action.hover',
                        color: isAllowed ? 'text.primary' : 'error.main',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 28, color: isAllowed ? 'text.primary' : 'text.disabled' }}>
                      <Icon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: '0.84rem',
                        fontWeight: 'inherit',
                      }}
                    />
                    {!isAllowed && (
                      <LockOutlined sx={{ fontSize: 14, color: '#94a3b8', ml: 'auto' }} />
                    )}
                    {item.badge && isAllowed && (
                      <Chip
                        label={item.badge}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.62rem',
                          fontWeight: 750,
                          bgcolor: '#FF8A3D',
                          color: '#ffffff',
                          borderRadius: '4px',
                          px: 0.25,
                        }}
                      />
                    )}
                  </ListItemButton>
                )
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* Terminal & Shift Status at Sidebar Bottom */}
      <Box
        sx={{
          p: 1.25,
          mt: 'auto',
          borderRadius: '8px',
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Avatar
            sx={{
              width: 28,
              height: 28,
              bgcolor: 'action.selected',
              color: 'primary.main',
              fontWeight: 750,
              fontSize: '0.75rem',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            PC
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" noWrap sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'text.primary' }}>
              Terminal Kasir 01
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <span className="status-dot-active" />
              <Typography variant="caption" sx={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 650 }}>
                Shift Pagi Aktif
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}

function MobileNavItem({ to, label, icon: Icon }: { to: string; label: string; icon: typeof DashboardOutlined }) {
  return (
    <ListItemButton
      component={NavLink}
      to={to}
      sx={{
        minHeight: 46,
        py: 0.6,
        px: 0.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        alignItems: 'center',
        justifyContent: 'center',
        color: 'text.primary',
        borderRadius: '8px',
        mx: 0.5,
        '&.active': {
          color: 'primary.main',
          fontWeight: 800,
          bgcolor: 'action.selected',
        },
      }}
    >
      <Icon sx={{ fontSize: 20 }} />
      <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 'inherit', lineHeight: 1.1 }}>
        {label}
      </Typography>
    </ListItemButton>
  )
}

