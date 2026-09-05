import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowForwardOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  HeadsetMicOutlined,
  Inventory2Outlined,
  MenuOutlined,
  PointOfSaleOutlined,
  QueryStatsOutlined,
  ReceiptLongOutlined,
  SecurityOutlined,
  SpeedOutlined,
  StarOutlined,
  StorefrontOutlined,
  VolumeUpOutlined,
  VolumeOffOutlined,
  WidgetsOutlined,
} from '@mui/icons-material'
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'

const BRAND_LOGO = '/branding/pawpos_logo_enhanced.png'
const HERO_3D = '/branding/landing-hero-3d.png'
const FEATURE_CHECKOUT = '/branding/feature-checkout-3d.png'
const FEATURE_COPILOT = '/branding/feature-ai-copilot-3d.png'
const FEATURE_INVENTORY = '/branding/feature-inventory-3d.png'
const SOCIAL_MASCOT = '/branding/social-mascot-avatar.png'
const SOCIAL_EMBLEM = '/branding/social-emblem-avatar.png'

const DEMO_VOICE_QUESTIONS = [
  {
    title: '📦 Cek Stok Pakan Kitten',
    question: 'Berapa sisa stok pakan kitten di toko saat ini?',
    answer: 'Berdasarkan data toko PawPOS, Royal Canin Kitten 1kg tersisa 30 pcs di Toko Utama, dan Cat Choice tersisa 35 pcs. Semua persediaan dalam batas aman.',
  },
  {
    title: '💳 Panduan Split Payment',
    question: 'Bagaimana SOP kasir melayani pembayaran campuran (Split Payment)?',
    answer: 'Di layar pembayaran kasir, pilih Split. Masukkan porsi non-tunai (QRIS/Debit), lalu masukkan uang tunai. Sistem otomatis menghitung kembalian dan mencatat kas laci secara tepat tanpa selisih.',
  },
  {
    title: '🐱 Rekomendasi Nutrisi Kucing',
    question: 'Apa rekomendasi nutrisi untuk anak kucing yang baru lepas sapih?',
    answer: 'Anak kucing membutuhkan formula tinggi protein (minimal 34%), kalsium untuk pembentukan tulang, dan tekstur kibble kecil atau wet food lembut yang mudah dicerna.',
  },
]

export function LandingPage() {
  const navigate = useNavigate()
  const [activeDemoIdx, setActiveDemoIdx] = useState(0)
  const [isPlayingDemoVoice, setIsPlayingDemoVoice] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function playSampleVoice(text: string) {
    if (typeof window === 'undefined') return

    if (isPlayingDemoVoice) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      setIsPlayingDemoVoice(false)
      return
    }

    if ('speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'id-ID'
      utterance.onend = () => setIsPlayingDemoVoice(false)
      utterance.onerror = () => setIsPlayingDemoVoice(false)
      window.speechSynthesis.speak(utterance)
      setIsPlayingDemoVoice(true)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#FAFAFC', color: '#1E293B', overflowX: 'hidden' }}>
      {/* 1. STICKY GLASS HEADER */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
          color: '#1E293B',
          py: 0.8,
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            {/* Logo */}
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
              <Box
                component="img"
                src={BRAND_LOGO}
                alt="PawPOS Logo"
                sx={{ height: { xs: 30, sm: 42 }, width: 'auto', objectFit: 'contain' }}
              />
            </Stack>

            {/* Desktop Navigation Links */}
            <Stack direction="row" spacing={3} sx={{ display: { xs: 'none', md: 'flex' } }}>
              <Button href="#features" sx={{ color: '#475569', fontWeight: 600, textTransform: 'none', '&:hover': { color: '#FF8A3D' } }}>
                Fitur Unggulan
              </Button>
              <Button href="#ai-copilot" sx={{ color: '#475569', fontWeight: 600, textTransform: 'none', '&:hover': { color: '#FF8A3D' } }}>
                AI Copilot 120B
              </Button>
              <Button href="#pricing" sx={{ color: '#475569', fontWeight: 600, textTransform: 'none', '&:hover': { color: '#FF8A3D' } }}>
                Harga Paket
              </Button>
              <Button href="#testimonials" sx={{ color: '#475569', fontWeight: 600, textTransform: 'none', '&:hover': { color: '#FF8A3D' } }}>
                Testimoni
              </Button>
            </Stack>

            {/* Header Actions */}
            <Stack direction="row" spacing={{ xs: 0.75, sm: 1.25 }} alignItems="center">
              <Button
                variant="outlined"
                onClick={() => navigate('/pos')}
                id="btn-nav-pos"
                sx={{
                  display: { xs: 'none', md: 'inline-flex' },
                  borderColor: '#E2E8F0',
                  color: '#1E293B',
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: '999px',
                  px: 2,
                  py: 0.6,
                  whiteSpace: 'nowrap',
                  '&:hover': { borderColor: '#FF8A3D', bgcolor: '#FFF5ED', color: '#FF8A3D' },
                }}
              >
                Masuk Kasir POS
              </Button>

              <Button
                variant="contained"
                onClick={() => navigate('/pos')}
                id="btn-nav-cta"
                sx={{
                  bgcolor: '#FF8A3D',
                  color: '#ffffff',
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: '999px',
                  px: { xs: 1.5, sm: 2.5 },
                  py: { xs: 0.6, sm: 0.7 },
                  fontSize: { xs: '0.8rem', sm: '0.875rem' },
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 14px rgba(255, 138, 61, 0.35)',
                  '&:hover': { bgcolor: '#e67328' },
                }}
              >
                Coba Gratis
              </Button>

              <IconButton
                onClick={() => setMobileMenuOpen(true)}
                sx={{ display: { xs: 'flex', md: 'none' }, color: '#1E293B', p: 0.5 }}
                aria-label="Menu Navigasi"
              >
                <MenuOutlined />
              </IconButton>
            </Stack>
          </Stack>
        </Container>

        {/* Mobile Navigation Drawer */}
        <Drawer
          anchor="right"
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          PaperProps={{
            sx: { width: 280, p: 2.5, bgcolor: '#FFFFFF' },
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box component="img" src={BRAND_LOGO} alt="PawPOS Logo" sx={{ height: 32 }} />
            <IconButton onClick={() => setMobileMenuOpen(false)} size="small">
              <CloseOutlined />
            </IconButton>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <List disablePadding>
            {[
              { label: 'Fitur Unggulan', href: '#features' },
              { label: 'AI Copilot 120B', href: '#ai-copilot' },
              { label: 'Harga Paket', href: '#pricing' },
              { label: 'Testimoni', href: '#testimonials' },
            ].map((item) => (
              <ListItem key={item.label} disablePadding>
                <ListItemButton
                  component="a"
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  sx={{ borderRadius: '8px', py: 1.25 }}
                >
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 700, color: '#1E293B' }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1.5}>
            <Button
              variant="contained"
              fullWidth
              onClick={() => {
                setMobileMenuOpen(false)
                navigate('/login')
              }}
              sx={{ bgcolor: '#FF8A3D', color: '#fff', fontWeight: 800, borderRadius: '999px', textTransform: 'none', py: 1 }}
            >
              Buka Demo Trial Kasir POS
            </Button>
          </Stack>
        </Drawer>
      </AppBar>

      {/* 2. HERO SECTION */}
      <Box
        component="section"
        sx={{
          position: 'relative',
          pt: { xs: 6, md: 10 },
          pb: { xs: 8, md: 14 },
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255, 138, 61, 0.15), rgba(255, 255, 255, 0))',
        }}
      >
        <Container maxWidth="lg">
          <Stack spacing={3} alignItems="center" textAlign="center" sx={{ mb: { xs: 5, md: 8 } }}>
            {/* Release pill */}
            <Chip
              icon={<StarOutlined sx={{ fontSize: 16, color: '#FF8A3D !important' }} />}
              label="Didukung Groq GPT-OSS 120B & ElevenLabs AI Voice Multilingual v2"
              sx={{
                bgcolor: '#ffffff',
                border: '1px solid #FFE3CC',
                color: '#1E293B',
                fontWeight: 750,
                fontSize: { xs: '0.75rem', sm: '0.82rem' },
                py: 2.2,
                px: 1.5,
                borderRadius: '999px',
                boxShadow: '0 4px 16px rgba(255, 138, 61, 0.1)',
              }}
            />

            {/* Main Headline */}
            <Typography
              component="h1"
              variant="h2"
              sx={{
                fontWeight: 900,
                fontSize: { xs: '2.2rem', sm: '3.4rem', md: '4rem' },
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
                maxWidth: 920,
              }}
            >
              Sistem POS & Copilot AI Cerdas untuk{' '}
              <Box component="span" sx={{ color: '#FF8A3D', display: 'inline' }}>
                Toko Hewan & Pet Clinic
              </Box>
            </Typography>

            {/* Sub-headline */}
            <Typography
              variant="body1"
              sx={{
                color: '#64748B',
                fontSize: { xs: '1rem', sm: '1.2rem' },
                maxWidth: 760,
                lineHeight: 1.6,
              }}
            >
              Kelola kasir kilat, pantau stok pakan otomatis, catat multi-tender split payment tanpa selisih, dan konsultasi operasional dengan asisten suara AI yang natural dalam satu platform pintar.
            </Typography>

            {/* Dual CTA Buttons */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}>
              <Button
                variant="contained"
                size="large"
                id="hero-cta-pos"
                onClick={() => navigate('/pos')}
                endIcon={<ArrowForwardOutlined />}
                sx={{
                  bgcolor: '#FF8A3D',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  borderRadius: '999px',
                  px: 4,
                  py: 1.6,
                  boxShadow: '0 8px 24px rgba(255, 138, 61, 0.4)',
                  '&:hover': { bgcolor: '#e67328' },
                }}
              >
                Buka Terminal Kasir POS
              </Button>

              <Button
                variant="outlined"
                size="large"
                id="hero-cta-demo"
                href="#ai-copilot"
                sx={{
                  borderColor: '#CBD5E1',
                  color: '#1E293B',
                  fontWeight: 750,
                  fontSize: '1.05rem',
                  borderRadius: '999px',
                  px: 3.5,
                  py: 1.6,
                  bgcolor: '#ffffff',
                  '&:hover': { borderColor: '#FF8A3D', bgcolor: '#FFF5ED', color: '#FF8A3D' },
                }}
              >
                Coba Demo AI Suara
              </Button>
            </Stack>

            {/* Trust points */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 3 }} sx={{ pt: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600 }}>
                <CheckCircleOutlined sx={{ fontSize: 16, color: '#10B981' }} /> Setup Instan 2 Menit
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600 }}>
                <CheckCircleOutlined sx={{ fontSize: 16, color: '#10B981' }} /> Tanpa Hardware Khusus
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600 }}>
                <CheckCircleOutlined sx={{ fontSize: 16, color: '#10B981' }} /> Cloud Database Aman & Terenkripsi
              </Typography>
            </Stack>
          </Stack>

          {/* 3D HERO VISUAL SHOWCASE */}
          {/* 3D HERO VISUAL SHOWCASE */}
          <Box sx={{ position: 'relative', mx: 'auto', maxWidth: 1040 }}>
            {/* Main Showcase Frame */}
            <Paper
              elevation={12}
              sx={{
                borderRadius: { xs: '18px', sm: '28px' },
                overflow: 'hidden',
                border: '1.5px solid #FFE3CC',
                boxShadow: '0 25px 60px -15px rgba(255, 138, 61, 0.22)',
                bgcolor: '#ffffff',
                lineHeight: 0,
              }}
            >
              <Box
                component="img"
                src={HERO_3D}
                alt="PawPOS 3D POS Terminal & Mascot Hero"
                sx={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  transition: 'transform 0.5s ease',
                  '&:hover': { transform: 'scale(1.015)' },
                }}
              />
            </Paper>

            {/* Desktop/Tablet Floating Card 1: Transaction Success */}
            <Paper
              elevation={8}
              sx={{
                position: 'absolute',
                top: { sm: 20, md: 32 },
                left: { sm: -16, md: -28 },
                p: { sm: 1.5, md: 2 },
                borderRadius: '16px',
                bgcolor: 'rgba(255, 255, 255, 0.96)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(226, 232, 240, 0.9)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                gap: 1.5,
                zIndex: 2,
              }}
            >
              <Avatar sx={{ bgcolor: '#DCFCE7', color: '#10B981', width: 42, height: 42 }}>
                <PointOfSaleOutlined sx={{ fontSize: 24 }} />
              </Avatar>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '0.86rem', color: '#1E293B' }}>
                  Split Payment Sukses
                </Typography>
                <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 750 }}>
                  Rp 45.000 • Tunai + QRIS
                </Typography>
              </Box>
            </Paper>

            {/* Desktop/Tablet Floating Card 2: AI Voice Active */}
            <Paper
              elevation={8}
              sx={{
                position: 'absolute',
                bottom: { sm: 24, md: 36 },
                right: { sm: -16, md: -28 },
                p: { sm: 1.5, md: 2 },
                borderRadius: '16px',
                bgcolor: 'rgba(255, 255, 255, 0.96)',
                backdropFilter: 'blur(12px)',
                border: '1px solid #FFE3CC',
                boxShadow: '0 12px 32px rgba(255, 138, 61, 0.22)',
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                gap: 1.5,
                zIndex: 2,
              }}
            >
              <Avatar src={SOCIAL_MASCOT} sx={{ width: 44, height: 44, border: '2px solid #FF8A3D' }} />
              <Box>
                <Typography sx={{ fontWeight: 850, fontSize: '0.86rem', color: '#1E293B' }}>
                  AI Copilot (ElevenLabs)
                </Typography>
                <Typography variant="caption" sx={{ color: '#FF8A3D', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  ● Suara Alami Bahasa Indonesia
                </Typography>
              </Box>
            </Paper>

            {/* Mobile Live Cards (Neatly positioned below hero image so artwork is never obscured) */}
            <Stack
              direction="row"
              spacing={1.5}
              sx={{
                display: { xs: 'flex', sm: 'none' },
                mt: 2,
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Paper
                elevation={2}
                sx={{
                  flex: '1 1 150px',
                  p: 1.25,
                  borderRadius: '12px',
                  bgcolor: '#ffffff',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Avatar sx={{ bgcolor: '#DCFCE7', color: '#10B981', width: 34, height: 34 }}>
                  <PointOfSaleOutlined sx={{ fontSize: 18 }} />
                </Avatar>
                <Box sx={{ textAlign: 'left' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.75rem', color: '#1E293B', lineHeight: 1.2 }}>
                    Split Payment Sukses
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 700, fontSize: '0.7rem' }}>
                    Rp 45.000 • Tunai + QRIS
                  </Typography>
                </Box>
              </Paper>

              <Paper
                elevation={2}
                sx={{
                  flex: '1 1 150px',
                  p: 1.25,
                  borderRadius: '12px',
                  bgcolor: '#ffffff',
                  border: '1px solid #FFE3CC',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Avatar src={SOCIAL_MASCOT} sx={{ width: 34, height: 34, border: '1.5px solid #FF8A3D' }} />
                <Box sx={{ textAlign: 'left' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.75rem', color: '#1E293B', lineHeight: 1.2 }}>
                    AI Copilot Suara
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#FF8A3D', fontWeight: 700, fontSize: '0.7rem' }}>
                    ● Bahasa Indonesia
                  </Typography>
                </Box>
              </Paper>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* 3. KEY METRICS & SOCIAL PROOF */}
      <Box sx={{ py: 6, bgcolor: '#ffffff', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 4,
              textAlign: 'center',
            }}
          >
            <Box>
              <Typography variant="h3" sx={{ fontWeight: 900, color: '#FF8A3D', letterSpacing: '-0.02em' }}>
                500+
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 600, mt: 0.5 }}>
                Pet Shop & Pet Clinic Aktif
              </Typography>
            </Box>

            <Box>
              <Typography variant="h3" sx={{ fontWeight: 900, color: '#1E293B', letterSpacing: '-0.02em' }}>
                &lt; 0.2s
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 600, mt: 0.5 }}>
                Kecepatan Split Payment & Struk
              </Typography>
            </Box>

            <Box>
              <Typography variant="h3" sx={{ fontWeight: 900, color: '#10B981', letterSpacing: '-0.02em' }}>
                100%
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 600, mt: 0.5 }}>
                Akurasi Kas Laci & Z-Report
              </Typography>
            </Box>

            <Box>
              <Typography variant="h3" sx={{ fontWeight: 900, color: '#1E293B', letterSpacing: '-0.02em' }}>
                99.9%
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 600, mt: 0.5 }}>
                Uptime Transaksi Cloud POS
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* 4. CORE CAPABILITIES (4 PILLARS WITH 3D GRAPHICS) */}
      <Box id="features" component="section" sx={{ py: { xs: 8, md: 14 } }}>
        <Container maxWidth="lg">
          <Stack spacing={2} textAlign="center" alignItems="center" sx={{ mb: 8 }}>
            <Chip label="FITUR OPERASIONAL LENGKAP" sx={{ bgcolor: '#FFF5ED', color: '#FF8A3D', fontWeight: 800, fontSize: '0.72rem' }} />
            <Typography variant="h3" component="h2" sx={{ fontWeight: 850, fontSize: { xs: '1.8rem', sm: '2.5rem' } }}>
              Dirancang Khusus untuk Kompleksitas Bisnis Toko Hewan
            </Typography>
            <Typography variant="body1" sx={{ color: '#64748B', maxWidth: 680 }}>
              Dari pakan kemasan, mainan, grooming, hingga obat-obatan vitamin — PawPOS menangani seluruh transaksi kasir dan mutasi inventori tanpa hambatan.
            </Typography>
          </Stack>

          {/* Feature Row 1: Fast POS & Split Payment */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 6 },
              borderRadius: '24px',
              border: '1px solid #E2E8F0',
              bgcolor: '#ffffff',
              mb: 6,
              transition: 'all 0.3s ease',
              '&:hover': { boxShadow: '0 20px 40px rgba(0,0,0,0.06)', borderColor: '#FFE3CC' },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: { xs: 4, md: 6 },
                alignItems: 'center',
              }}
            >
              <Box sx={{ flex: 1, width: { xs: '100%', md: '50%' } }}>
                <Stack spacing={2.5}>
                  <Chip
                    icon={<SpeedOutlined sx={{ fontSize: 16 }} />}
                    label="PENCATATAN KILAT"
                    size="small"
                    sx={{ bgcolor: '#FFF5ED', color: '#FF8A3D', fontWeight: 800, width: 'fit-content' }}
                  />
                  <Typography variant="h4" component="h3" sx={{ fontWeight: 850, color: '#1E293B', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                    Kasir POS Kilat & Multi-Tender Split Payment
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#64748B', lineHeight: 1.7 }}>
                    Pelanggan ingin membayar Rp 20.000 tunai dan sisanya via QRIS? PawPOS memproses split tender dalam satu klik. Sistem secara otomatis menghitung kembalian dan mencatat jumlah kas fisik yang tepat di laci kasir (*expected cash*), sehingga audit Z-Report di akhir shift 100% klop tanpa selisih.
                  </Typography>
                  <Stack spacing={1.5} sx={{ pt: 1 }}>
                    <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, fontSize: '0.92rem' }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 18 }} /> Scan barcode instan & pencarian SKU nama produk responsif
                    </Typography>
                    <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, fontSize: '0.92rem' }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 18 }} /> Kalkulasi PPN 11% & diskon otomatis tercetak di struk
                    </Typography>
                    <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, fontSize: '0.92rem' }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 18 }} /> Cetak struk belanja thermal & audit riwayat transaksi digital
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
              <Box sx={{ flex: 1, width: { xs: '100%', md: '50%' } }}>
                <Paper
                  elevation={4}
                  sx={{
                    borderRadius: '24px',
                    overflow: 'hidden',
                    border: '1.5px solid #FFE3CC',
                    boxShadow: '0 16px 36px rgba(255, 138, 61, 0.14)',
                    lineHeight: 0,
                    bgcolor: '#ffffff',
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 20px 45px rgba(255, 138, 61, 0.22)' },
                  }}
                >
                  <Box
                    component="img"
                    src={FEATURE_CHECKOUT}
                    alt="Kasir POS Kilat dan Split Payment"
                    sx={{
                      width: '100%',
                      height: 'auto',
                      aspectRatio: '1 / 1',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </Paper>
              </Box>
            </Box>
          </Paper>

          {/* Feature Row 2: AI Copilot & Voice */}
          <Paper
            id="ai-copilot"
            elevation={0}
            sx={{
              p: { xs: 3, md: 6 },
              borderRadius: '24px',
              border: '1px solid #E2E8F0',
              bgcolor: '#ffffff',
              mb: 6,
              transition: 'all 0.3s ease',
              '&:hover': { boxShadow: '0 20px 40px rgba(0,0,0,0.06)', borderColor: '#FFE3CC' },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column-reverse', md: 'row' },
                gap: { xs: 4, md: 6 },
                alignItems: 'center',
              }}
            >
              <Box sx={{ flex: 1, width: { xs: '100%', md: '50%' } }}>
                <Paper
                  elevation={4}
                  sx={{
                    borderRadius: '24px',
                    overflow: 'hidden',
                    border: '1.5px solid #FFE3CC',
                    boxShadow: '0 16px 36px rgba(255, 138, 61, 0.16)',
                    lineHeight: 0,
                    bgcolor: '#ffffff',
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 20px 45px rgba(255, 138, 61, 0.24)' },
                  }}
                >
                  <Box
                    component="img"
                    src={FEATURE_COPILOT}
                    alt="AI Copilot Groq 120B dan ElevenLabs Voice"
                    sx={{
                      width: '100%',
                      height: 'auto',
                      aspectRatio: '1 / 1',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </Paper>
              </Box>
              <Box sx={{ flex: 1, width: { xs: '100%', md: '50%' } }}>
                <Stack spacing={2.5}>
                  <Chip
                    icon={<HeadsetMicOutlined sx={{ fontSize: 16 }} />}
                    label="AI COPILOT RESMI TOKO"
                    size="small"
                    sx={{ bgcolor: '#FFF5ED', color: '#FF8A3D', fontWeight: 800, width: 'fit-content' }}
                  />
                  <Typography variant="h4" component="h3" sx={{ fontWeight: 850, color: '#1E293B', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                    Asisten AI Suara (Groq 120B + ElevenLabs)
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#64748B', lineHeight: 1.7 }}>
                    Kasir tidak perlu menghafal ratusan stok atau SOP pakan hewan. Cukup tekan mikrofon dan bicara: <em>"Cek stok whiskas menipis"</em> atau <em>"Rekomendasi pakan kitten umur 2 bulan"</em>. Model mutakhir Groq GPT-OSS 120B membaca data toko secara real-time dan menjawab dengan audio suara ElevenLabs yang jernih dan ramah.
                  </Typography>
                  <Stack spacing={1.5} sx={{ pt: 1 }}>
                    <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, fontSize: '0.92rem' }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 18 }} /> Transkripsi suara kasir ultra-cepat dengan Whisper Large Turbo
                    </Typography>
                    <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, fontSize: '0.92rem' }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 18 }} /> Pelafalan suara Indonesia alami dengan ElevenLabs Multilingual v2
                    </Typography>
                    <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, fontSize: '0.92rem' }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 18 }} /> Riwayat percakapan tersimpan permanen di LocalStorage
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            </Box>
          </Paper>

          {/* Feature Row 3: Inventory & Warehouse */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 6 },
              borderRadius: '24px',
              border: '1px solid #E2E8F0',
              bgcolor: '#ffffff',
              transition: 'all 0.3s ease',
              '&:hover': { boxShadow: '0 20px 40px rgba(0,0,0,0.06)', borderColor: '#FFE3CC' },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: { xs: 4, md: 6 },
                alignItems: 'center',
              }}
            >
              <Box sx={{ flex: 1, width: { xs: '100%', md: '50%' } }}>
                <Stack spacing={2.5}>
                  <Chip
                    icon={<Inventory2Outlined sx={{ fontSize: 16 }} />}
                    label="STOK & BUKU MUTASI"
                    size="small"
                    sx={{ bgcolor: '#FFF5ED', color: '#FF8A3D', fontWeight: 800, width: 'fit-content' }}
                  />
                  <Typography variant="h4" component="h3" sx={{ fontWeight: 850, color: '#1E293B', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                    Manajemen Stok Real-Time & Buku Mutasi
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#64748B', lineHeight: 1.7 }}>
                    Cegah kehabisan pakan favorit pelanggan! Sistem secara otomatis memantau kuantitas stok terhadap batas minimum (*minimum stock threshold*). Catat barang masuk supplier (*purchase receipt*), penyesuaian stok (*adjustment*), dan telusuri buku mutasi pergerakan barang dengan akurat.
                  </Typography>
                  <Stack spacing={1.5} sx={{ pt: 1 }}>
                    <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, fontSize: '0.92rem' }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 18 }} /> Peringatan otomatis stok menipis di POS & AI Assistant
                    </Typography>
                    <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, fontSize: '0.92rem' }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 18 }} /> Pencatatan buku mutasi masuk (inbound) & keluar (outbound)
                    </Typography>
                    <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, fontSize: '0.92rem' }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 18 }} /> Konversi foto produk ke format WebP ringan otomatis
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
              <Box sx={{ flex: 1, width: { xs: '100%', md: '50%' } }}>
                <Paper
                  elevation={4}
                  sx={{
                    borderRadius: '24px',
                    overflow: 'hidden',
                    border: '1.5px solid #BBF7D0',
                    boxShadow: '0 16px 36px rgba(16, 185, 129, 0.14)',
                    lineHeight: 0,
                    bgcolor: '#ffffff',
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 20px 45px rgba(16, 185, 129, 0.22)' },
                  }}
                >
                  <Box
                    component="img"
                    src={FEATURE_INVENTORY}
                    alt="Manajemen Stok Inventori Pet Shop"
                    sx={{
                      width: '100%',
                      height: 'auto',
                      aspectRatio: '1 / 1',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </Paper>
              </Box>
            </Box>
          </Paper>
        </Container>
      </Box>

      {/* 5. INTERACTIVE LIVE AI VOICE SIMULATION */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFF5ED', borderTop: '1px solid #FFE3CC', borderBottom: '1px solid #FFE3CC' }}>
        <Container maxWidth="md">
          <Stack spacing={2} textAlign="center" alignItems="center" sx={{ mb: 5 }}>
            <Chip label="DEMO INTERAKTIF" sx={{ bgcolor: '#FF8A3D', color: '#ffffff', fontWeight: 800 }} />
            <Typography variant="h3" component="h2" sx={{ fontWeight: 850, fontSize: { xs: '1.8rem', sm: '2.4rem' } }}>
              Uji Coba Suara AI Asisten PawPOS Sekarang
            </Typography>
            <Typography variant="body1" sx={{ color: '#64748B' }}>
              Pilih pertanyaan operasional di bawah dan dengarkan bagaimana AI membacakan responnya dengan suara natural.
            </Typography>
          </Stack>

          <Paper
            elevation={6}
            sx={{
              p: { xs: 2.5, sm: 4 },
              borderRadius: '24px',
              bgcolor: '#ffffff',
              border: '1.5px solid #FF8A3D',
              boxShadow: '0 16px 40px rgba(255, 138, 61, 0.15)',
            }}
          >
            {/* Prompt Selector Pills */}
            <Stack
              direction="row"
              spacing={1}
              sx={{
                overflowX: 'auto',
                pb: 1,
                mb: 3,
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              {DEMO_VOICE_QUESTIONS.map((item, idx) => (
                <Chip
                  key={idx}
                  label={item.title}
                  clickable
                  onClick={() => {
                    setActiveDemoIdx(idx)
                    if (isPlayingDemoVoice) {
                      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
                      setIsPlayingDemoVoice(false)
                    }
                  }}
                  sx={{
                    fontWeight: 700,
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    bgcolor: activeDemoIdx === idx ? '#FF8A3D' : '#F1F5F9',
                    color: activeDemoIdx === idx ? '#ffffff' : '#475569',
                    '&:hover': { bgcolor: activeDemoIdx === idx ? '#e67328' : '#e2e8f0' },
                  }}
                />
              ))}
            </Stack>

            {/* Question Bubble */}
            <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: '16px', mb: 2.5, border: '1px solid #E2E8F0' }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700 }}>
                Pertanyaan Kasir:
              </Typography>
              <Typography sx={{ fontWeight: 750, color: '#1E293B', fontSize: '1rem', mt: 0.5 }}>
                "{DEMO_VOICE_QUESTIONS[activeDemoIdx].question}"
              </Typography>
            </Box>

            {/* Answer Bubble */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                bgcolor: '#FFF5ED',
                borderRadius: '16px',
                border: '1px solid #FFE3CC',
              }}
            >
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Avatar
                  src={SOCIAL_MASCOT}
                  sx={{
                    width: { xs: 48, sm: 58 },
                    height: { xs: 48, sm: 58 },
                    border: '2px solid #FF8A3D',
                    boxShadow: '0 4px 16px rgba(255, 138, 61, 0.3)',
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                    spacing={1.25}
                    sx={{ mb: 1.5 }}
                  >
                    <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#1E293B' }}>
                      PawPOS AI Assistant <span style={{ color: '#FF8A3D' }}>(Groq GPT-OSS 120B)</span>
                    </Typography>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => playSampleVoice(DEMO_VOICE_QUESTIONS[activeDemoIdx].answer)}
                      startIcon={isPlayingDemoVoice ? <VolumeOffOutlined /> : <VolumeUpOutlined />}
                      sx={{
                        bgcolor: isPlayingDemoVoice ? '#EF4444' : '#FF8A3D',
                        color: '#ffffff',
                        fontWeight: 700,
                        textTransform: 'none',
                        borderRadius: '999px',
                        px: 2,
                        py: 0.6,
                        flexShrink: 0,
                        alignSelf: { xs: 'flex-start', sm: 'center' },
                        '&:hover': { bgcolor: isPlayingDemoVoice ? '#DC2626' : '#e67328' },
                      }}
                    >
                      {isPlayingDemoVoice ? 'Hentikan Suara' : 'Dengarkan Suara AI'}
                    </Button>
                  </Stack>
                  <Typography variant="body2" sx={{ color: '#334155', lineHeight: 1.6 }}>
                    {DEMO_VOICE_QUESTIONS[activeDemoIdx].answer}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Paper>
        </Container>
      </Box>

      {/* 6. TRANSPARENT SAAS PRICING */}
      <Box id="pricing" component="section" sx={{ py: { xs: 8, md: 14 } }}>
        <Container maxWidth="lg">
          <Stack spacing={2} textAlign="center" alignItems="center" sx={{ mb: 8 }}>
            <Chip label="PILIHAN PAKET SAAS" sx={{ bgcolor: '#FFF5ED', color: '#FF8A3D', fontWeight: 800 }} />
            <Typography variant="h3" component="h2" sx={{ fontWeight: 850, fontSize: { xs: '1.8rem', sm: '2.5rem' } }}>
              Investasi Transparan untuk Setiap Skala Toko
            </Typography>
            <Typography variant="body1" sx={{ color: '#64748B', maxWidth: 640 }}>
              Pilih paket yang sesuai dengan kebutuhan outlet Anda. Bebas upgrade atau downgrade kapan saja tanpa kontrak rumit.
            </Typography>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 4,
              alignItems: 'stretch',
            }}
          >
            {/* Tier 1: Starter */}
            <Box sx={{ height: '100%' }}>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  height: '100%',
                  borderRadius: '24px',
                  border: '1px solid #E2E8F0',
                  bgcolor: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.3s ease',
                  '&:hover': { borderColor: '#CBD5E1', transform: 'translateY(-4px)' },
                }}
              >
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 850, color: '#1E293B' }}>
                    Starter
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5, mb: 2 }}>
                    Cocok untuk toko hewan pemula atau gerai pet shop tunggal.
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 900, color: '#1E293B', mb: 3 }}>
                    Rp 0 <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 600 }}>/ bulan</span>
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  <Stack spacing={1.5}>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 16 }} /> 1 Terminal Kasir POS Aktif
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 16 }} /> Hingga 100 SKU Produk
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 16 }} /> Manajemen Kas Laci & Shift Dasar
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 16 }} /> Struk Digital & Riwayat Order
                    </Typography>
                  </Stack>
                </Box>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate('/pos')}
                  sx={{
                    mt: 4,
                    borderColor: '#E2E8F0',
                    color: '#1E293B',
                    fontWeight: 750,
                    borderRadius: '999px',
                    py: 1.2,
                    textTransform: 'none',
                    '&:hover': { borderColor: '#FF8A3D', color: '#FF8A3D', bgcolor: '#FFF5ED' },
                  }}
                >
                  Mulai Gratis
                </Button>
              </Paper>
            </Box>

            {/* Tier 2: Pro Pet Store (HIGHLIGHTED) */}
            <Box sx={{ height: '100%' }}>
              <Paper
                elevation={8}
                sx={{
                  p: 4,
                  height: '100%',
                  borderRadius: '24px',
                  border: '2px solid #FF8A3D',
                  bgcolor: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  boxShadow: '0 20px 40px rgba(255, 138, 61, 0.18)',
                  transform: { md: 'scale(1.04)' },
                }}
              >
                <Chip
                  label="PALING POPULER"
                  sx={{
                    position: 'absolute',
                    top: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bgcolor: '#FF8A3D',
                    color: '#ffffff',
                    fontWeight: 850,
                    fontSize: '0.72rem',
                    px: 1,
                  }}
                />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 850, color: '#1E293B' }}>
                    Pro Pet Store
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5, mb: 2 }}>
                    Solusi lengkap toko hewan modern yang ingin efisiensi maksimal.
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 900, color: '#FF8A3D', mb: 3 }}>
                    Rp 149.000 <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 600 }}>/ bulan</span>
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  <Stack spacing={1.5}>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 16 }} /> Multi-Terminal Kasir & Kasir Simultan
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 16 }} /> Unlimited SKU Produk & WebP Optimizer
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 16 }} /> Multi-Tender Split Payment (Tunai + QRIS)
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 16 }} /> AI Copilot Suara Groq 120B & ElevenLabs
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 16 }} /> Buku Mutasi Stok & Reorder Alert
                    </Typography>
                  </Stack>
                </Box>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => navigate('/pos')}
                  sx={{
                    mt: 4,
                    bgcolor: '#FF8A3D',
                    color: '#ffffff',
                    fontWeight: 800,
                    borderRadius: '999px',
                    py: 1.4,
                    textTransform: 'none',
                    boxShadow: '0 4px 16px rgba(255, 138, 61, 0.4)',
                    '&:hover': { bgcolor: '#e67328' },
                  }}
                >
                  Pilih Pro Pet Store
                </Button>
              </Paper>
            </Box>

            {/* Tier 3: Enterprise */}
            <Box sx={{ height: '100%' }}>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  height: '100%',
                  borderRadius: '24px',
                  border: '1px solid #E2E8F0',
                  bgcolor: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.3s ease',
                  '&:hover': { borderColor: '#CBD5E1', transform: 'translateY(-4px)' },
                }}
              >
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 850, color: '#1E293B' }}>
                    Enterprise Clinic
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5, mb: 2 }}>
                    Untuk jaringan franchise, klinik hewan, dan pet hotel terintegrasi.
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 900, color: '#1E293B', mb: 3 }}>
                    Rp 399.000 <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 600 }}>/ bulan</span>
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  <Stack spacing={1.5}>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 16 }} /> Sinkronisasi Multi-Outlet & Gudang Pusat
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 16 }} /> Rekam Medis Grooming & Vaksinasi
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 16 }} /> Custom Voice Cloning untuk Maskot Toko
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
                      <CheckCircleOutlined sx={{ color: '#10B981', fontSize: 16 }} /> Prioritas Layanan Dukungan Teknis 24/7
                    </Typography>
                  </Stack>
                </Box>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate('/pos')}
                  sx={{
                    mt: 4,
                    borderColor: '#E2E8F0',
                    color: '#1E293B',
                    fontWeight: 750,
                    borderRadius: '999px',
                    py: 1.2,
                    textTransform: 'none',
                    '&:hover': { borderColor: '#FF8A3D', color: '#FF8A3D', bgcolor: '#FFF5ED' },
                  }}
                >
                  Hubungi Sales
                </Button>
              </Paper>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* 7. TESTIMONIALS */}
      <Box id="testimonials" sx={{ py: { xs: 8, md: 12 }, bgcolor: '#ffffff', borderTop: '1px solid #E2E8F0' }}>
        <Container maxWidth="lg">
          <Stack spacing={2} textAlign="center" alignItems="center" sx={{ mb: 6 }}>
            <Chip label="CERITA PENGGUNA" sx={{ bgcolor: '#FFF5ED', color: '#FF8A3D', fontWeight: 800 }} />
            <Typography variant="h3" component="h2" sx={{ fontWeight: 850, fontSize: { xs: '1.8rem', sm: '2.4rem' } }}>
              Dipercaya oleh Ratusan Pengusaha Toko Hewan
            </Typography>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 3,
              alignItems: 'stretch',
            }}
          >
            <Box sx={{ height: '100%' }}>
              <Paper sx={{ p: 3.5, borderRadius: '20px', border: '1px solid #E2E8F0', height: '100%' }}>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={0.5} sx={{ color: '#F59E0B' }}>
                    {[...Array(5)].map((_, i) => (
                      <StarOutlined key={i} sx={{ fontSize: 18 }} />
                    ))}
                  </Stack>
                  <Typography variant="body2" sx={{ color: '#334155', lineHeight: 1.6, fontStyle: 'italic' }}>
                    "Fitur split payment dan voice copilot-nya luar biasa! Kasir kami bisa langsung tanya stok makanan kucing tanpa harus bolak-balik buka lembar gudang. Sangat hemat waktu!"
                  </Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pt: 1 }}>
                    <Avatar sx={{ bgcolor: '#FF8A3D', color: '#fff', fontWeight: 800 }}>BK</Avatar>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>Budi Kurniawan</Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>Owner, Pawsome Pet Care Kemang</Typography>
                    </Box>
                  </Stack>
                </Stack>
              </Paper>
            </Box>

            <Box sx={{ height: '100%' }}>
              <Paper sx={{ p: 3.5, borderRadius: '20px', border: '1px solid #E2E8F0', height: '100%' }}>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={0.5} sx={{ color: '#F59E0B' }}>
                    {[...Array(5)].map((_, i) => (
                      <StarOutlined key={i} sx={{ fontSize: 18 }} />
                    ))}
                  </Stack>
                  <Typography variant="body2" sx={{ color: '#334155', lineHeight: 1.6, fontStyle: 'italic' }}>
                    "Dulu tiap tutup shift kasir selalu ada selisih uang tunai. Sejak pakai PawPOS dengan sistem expected cash laci otomatis, saldo selalu 100% akurat!"
                  </Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pt: 1 }}>
                    <Avatar sx={{ bgcolor: '#10B981', color: '#fff', fontWeight: 800 }}>drh</Avatar>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>drh. Jessica Tan</Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>Kepala Klinik Satwa Sehat Surabaya</Typography>
                    </Box>
                  </Stack>
                </Stack>
              </Paper>
            </Box>

            <Box sx={{ height: '100%' }}>
              <Paper sx={{ p: 3.5, borderRadius: '20px', border: '1px solid #E2E8F0', height: '100%' }}>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={0.5} sx={{ color: '#F59E0B' }}>
                    {[...Array(5)].map((_, i) => (
                      <StarOutlined key={i} sx={{ fontSize: 18 }} />
                    ))}
                  </Stack>
                  <Typography variant="body2" sx={{ color: '#334155', lineHeight: 1.6, fontStyle: 'italic' }}>
                    "Maskot 3D Shiba CS dan suara ElevenLabs bikin pelanggan toko kami terkesan. Toko kelihatan sangat profesional dan melek teknologi AI!"
                  </Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pt: 1 }}>
                    <Avatar sx={{ bgcolor: '#6366F1', color: '#fff', fontWeight: 800 }}>AL</Avatar>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>Andi Lestari</Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>Manager, Fluffy Cat Grooming Bandung</Typography>
                    </Box>
                  </Stack>
                </Stack>
              </Paper>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* 8. HIGH-CONVERTING BOTTOM CTA BANNER */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#1E293B', color: '#ffffff', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Stack spacing={3} alignItems="center">
            <Avatar
              src={SOCIAL_EMBLEM}
              sx={{
                width: { xs: 72, sm: 88 },
                height: { xs: 72, sm: 88 },
                mb: 1,
                border: '2.5px solid #FF8A3D',
                boxShadow: '0 8px 32px rgba(255, 138, 61, 0.45)',
              }}
            />
            <Typography variant="h3" component="h2" sx={{ fontWeight: 900, fontSize: { xs: '2rem', sm: '2.8rem' }, letterSpacing: '-0.02em', color: '#ffffff' }}>
              Siap Modernisasi Toko Hewan Anda Hari Ini?
            </Typography>
            <Typography variant="body1" sx={{ color: '#E2E8F0', fontSize: '1.1rem', maxWidth: 640 }}>
              Mulai transaksi kasir pertama Anda dalam 2 menit. Tanpa kontrak, tanpa kartu kredit, dan langsung terhubung dengan Asisten AI.
            </Typography>
            <Button
              variant="contained"
              size="large"
              id="bottom-cta-pos"
              onClick={() => navigate('/pos')}
              endIcon={<ArrowForwardOutlined />}
              sx={{
                bgcolor: '#FF8A3D',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '1.1rem',
                borderRadius: '999px',
                px: 5,
                py: 1.8,
                boxShadow: '0 8px 30px rgba(255, 138, 61, 0.45)',
                '&:hover': { bgcolor: '#e67328' },
              }}
            >
              Buka Terminal Kasir PawPOS Sekarang
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* 9. FOOTER */}
      <Box sx={{ py: 6, bgcolor: '#0F172A', color: '#94A3B8', borderTop: '1px solid #334155' }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '2.5fr 1.2fr 1.2fr 1.8fr' },
              gap: 4,
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <Box
                  sx={{
                    bgcolor: '#ffffff',
                    px: 1.5,
                    py: 0.6,
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}
                >
                  <Box component="img" src={BRAND_LOGO} alt="PawPOS Logo" sx={{ height: 28, width: 'auto' }} />
                </Box>
              </Stack>
              <Typography variant="body2" sx={{ lineHeight: 1.7, color: '#94A3B8' }}>
                PawPOS adalah platform SaaS Point of Sale dan Copilot AI cerdas yang dirancang khusus untuk mengoptimalkan operasional toko hewan, pet clinic, dan salon grooming.
              </Typography>
              <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
                <Tooltip title="Instagram Resmi PawPOS">
                  <Avatar src={SOCIAL_MASCOT} sx={{ width: 34, height: 34, cursor: 'pointer', border: '1.5px solid #FF8A3D' }} />
                </Tooltip>
                <Tooltip title="TikTok Resmi PawPOS">
                  <Avatar src={SOCIAL_EMBLEM} sx={{ width: 34, height: 34, cursor: 'pointer', border: '1.5px solid #FF8A3D' }} />
                </Tooltip>
              </Stack>
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 800, color: '#ffffff', mb: 2, fontSize: '0.9rem' }}>
                Navigasi
              </Typography>
              <Stack spacing={1}>
                <Button onClick={() => navigate('/pos')} sx={{ p: 0, justifyContent: 'flex-start', color: '#94A3B8', textTransform: 'none', '&:hover': { color: '#FF8A3D' } }}>
                  Terminal Kasir
                </Button>
                <Button onClick={() => navigate('/products')} sx={{ p: 0, justifyContent: 'flex-start', color: '#94A3B8', textTransform: 'none', '&:hover': { color: '#FF8A3D' } }}>
                  Katalog Produk
                </Button>
                <Button onClick={() => navigate('/inventory/stocks')} sx={{ p: 0, justifyContent: 'flex-start', color: '#94A3B8', textTransform: 'none', '&:hover': { color: '#FF8A3D' } }}>
                  Stok Inventori
                </Button>
                <Button onClick={() => navigate('/orders')} sx={{ p: 0, justifyContent: 'flex-start', color: '#94A3B8', textTransform: 'none', '&:hover': { color: '#FF8A3D' } }}>
                  Riwayat Transaksi
                </Button>
              </Stack>
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 800, color: '#ffffff', mb: 2, fontSize: '0.9rem' }}>
                Teknologi AI
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ color: '#94A3B8' }}>Groq GPT-OSS 120B</Typography>
                <Typography variant="body2" sx={{ color: '#94A3B8' }}>Whisper Large Turbo</Typography>
                <Typography variant="body2" sx={{ color: '#94A3B8' }}>ElevenLabs Neural TTS</Typography>
                <Typography variant="body2" sx={{ color: '#94A3B8' }}>Real-time Store RAG</Typography>
              </Stack>
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 800, color: '#ffffff', mb: 2, fontSize: '0.9rem' }}>
                Hubungi Kami
              </Typography>
              <Typography variant="body2" sx={{ color: '#94A3B8', lineHeight: 1.7 }}>
                Dukungan teknis & konsultasi POS:
                <br />
                <strong>Email:</strong> support@pawpos.id
                <br />
                <strong>WhatsApp:</strong> +62 812-3456-7890
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 4, borderColor: '#334155' }} />

          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              © {new Date().getFullYear()} PawPOS Indonesia. Hak Cipta Dilindungi Undang-Undang.
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              Smart POS & AI Copilot for Pet Business
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}
