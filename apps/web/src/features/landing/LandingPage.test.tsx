import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingPage } from './LandingPage'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('LandingPage component', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    vi.restoreAllMocks()

    // Mock window.speechSynthesis
    if (typeof window !== 'undefined') {
      window.speechSynthesis = {
        speak: vi.fn(),
        cancel: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        getVoices: vi.fn().mockReturnValue([]),
        onvoiceschanged: null,
        paused: false,
        pending: false,
        speaking: false,
      } as unknown as SpeechSynthesis

      // @ts-expect-error mock utterance
      window.SpeechSynthesisUtterance = class {
        lang = ''
        onend: (() => void) | null = null
        onerror: (() => void) | null = null
        constructor(public text: string) {}
      }
    }
  })

  it('renders brand header with navigation links and CTA', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    expect(screen.getAllByAltText('PawPOS Logo').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Coba Gratis' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fitur Unggulan' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Harga Paket' })).toBeInTheDocument()

    const navCta = screen.getByRole('button', { name: 'Masuk Kasir POS' })
    expect(navCta).toBeInTheDocument()
    fireEvent.click(navCta)
    expect(mockNavigate).toHaveBeenCalledWith('/pos')
  })

  it('renders hero section with headlines, dual CTAs, and 3D hero image', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/Sistem POS & Copilot AI Cerdas untuk/i)).toBeInTheDocument()
    expect(screen.getByText(/Toko Hewan & Pet Clinic/i)).toBeInTheDocument()
    expect(screen.getByText(/Kelola kasir kilat, pantau stok pakan otomatis/i)).toBeInTheDocument()

    // Hero CTA button
    const heroCta = screen.getByRole('button', { name: 'Buka Terminal Kasir POS' })
    expect(heroCta).toBeInTheDocument()
    fireEvent.click(heroCta)
    expect(mockNavigate).toHaveBeenCalledWith('/pos')

    // 3D Hero image
    const heroImg = screen.getByAltText(/PawPOS 3D/i)
    expect(heroImg).toBeInTheDocument()
    expect(heroImg).toHaveAttribute('src', '/branding/landing-hero-3d.png')

    // Floating badges in Hero
    expect(screen.getByText('Split Payment Sukses')).toBeInTheDocument()
    expect(screen.getByText(/Rp 45.000 • Tunai \+ QRIS/i)).toBeInTheDocument()
    expect(screen.getByText(/AI Copilot \(ElevenLabs\)/i)).toBeInTheDocument()
  })

  it('renders key metrics bar correctly', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    expect(screen.getByText('500+')).toBeInTheDocument()
    expect(screen.getByText('Pet Shop & Pet Clinic Aktif')).toBeInTheDocument()
    expect(screen.getByText('< 0.2s')).toBeInTheDocument()
    expect(screen.getByText('Kecepatan Split Payment & Struk')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('Akurasi Kas Laci & Z-Report')).toBeInTheDocument()
    expect(screen.getByText('99.9%')).toBeInTheDocument()
    expect(screen.getByText('Uptime Transaksi Cloud POS')).toBeInTheDocument()
  })

  it('renders 3 core feature pillars with 3D illustration assets', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    // Feature 1: Checkout & Split
    expect(screen.getByText('Kasir POS Kilat & Multi-Tender Split Payment')).toBeInTheDocument()
    const checkoutImg = screen.getByAltText('Kasir POS Kilat dan Split Payment')
    expect(checkoutImg).toBeInTheDocument()
    expect(checkoutImg).toHaveAttribute('src', '/branding/feature-checkout-3d.png')

    // Feature 2: AI Copilot
    expect(screen.getByText('Asisten AI Suara (Groq 120B + ElevenLabs)')).toBeInTheDocument()
    const copilotImg = screen.getByAltText('AI Copilot Groq 120B dan ElevenLabs Voice')
    expect(copilotImg).toBeInTheDocument()
    expect(copilotImg).toHaveAttribute('src', '/branding/feature-ai-copilot-3d.png')

    // Feature 3: Inventory
    expect(screen.getByText('Manajemen Stok Real-Time & Buku Mutasi')).toBeInTheDocument()
    const inventoryImg = screen.getByAltText('Manajemen Stok Inventori Pet Shop')
    expect(inventoryImg).toBeInTheDocument()
    expect(inventoryImg).toHaveAttribute('src', '/branding/feature-inventory-3d.png')
  })

  it('interacts with AI Voice Simulator question switcher and audio speech synthesis', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Uji Coba Suara AI Asisten PawPOS Sekarang')).toBeInTheDocument()

    // Default question 0 is active
    expect(screen.getByText(/Berapa sisa stok pakan kitten di toko saat ini\?/i)).toBeInTheDocument()
    expect(screen.getByText(/Royal Canin Kitten 1kg tersisa 30 pcs di Toko Utama/i)).toBeInTheDocument()

    // Switch to question 1: Split Payment
    const splitQuestionBtn = screen.getByText('💳 Panduan Split Payment')
    fireEvent.click(splitQuestionBtn)
    expect(screen.getByText(/Bagaimana SOP kasir melayani pembayaran campuran/i)).toBeInTheDocument()
    expect(screen.getByText(/Di layar pembayaran kasir, pilih Split/i)).toBeInTheDocument()

    // Test Play audio button
    const playBtn = screen.getByRole('button', { name: /Dengarkan Suara AI/i })
    fireEvent.click(playBtn)
    expect(window.speechSynthesis.speak).toHaveBeenCalled()
  })

  it('renders SaaS pricing tiers and navigates to POS when buttons are clicked', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Investasi Transparan untuk Setiap Skala Toko')).toBeInTheDocument()

    // Tier 1
    expect(screen.getByText('Starter')).toBeInTheDocument()
    expect(screen.getByText('Rp 0')).toBeInTheDocument()
    const starterBtn = screen.getByRole('button', { name: 'Mulai Gratis' })
    fireEvent.click(starterBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/pos')

    // Tier 2
    expect(screen.getByText('Pro Pet Store')).toBeInTheDocument()
    expect(screen.getByText('PALING POPULER')).toBeInTheDocument()
    expect(screen.getByText('Rp 149.000')).toBeInTheDocument()
    const proBtn = screen.getByRole('button', { name: 'Pilih Pro Pet Store' })
    fireEvent.click(proBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/pos')

    // Tier 3
    expect(screen.getByText('Enterprise Clinic')).toBeInTheDocument()
    expect(screen.getByText('Rp 399.000')).toBeInTheDocument()
  })

  it('renders testimonials and bottom CTA banner', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    // Testimonials
    expect(screen.getByText('Dipercaya oleh Ratusan Pengusaha Toko Hewan')).toBeInTheDocument()
    expect(screen.getByText('Budi Kurniawan')).toBeInTheDocument()
    expect(screen.getByText('drh. Jessica Tan')).toBeInTheDocument()
    expect(screen.getByText('Andi Lestari')).toBeInTheDocument()

    // Bottom banner
    expect(screen.getByText('Siap Modernisasi Toko Hewan Anda Hari Ini?')).toBeInTheDocument()
    const bottomCta = screen.getByRole('button', { name: 'Buka Terminal Kasir PawPOS Sekarang' })
    expect(bottomCta).toBeInTheDocument()
    fireEvent.click(bottomCta)
    expect(mockNavigate).toHaveBeenCalledWith('/pos')

    // Footer
    expect(screen.getByText(/PawPOS adalah platform SaaS Point of Sale dan Copilot AI cerdas/i)).toBeInTheDocument()
    expect(screen.getByText(/support@pawpos\.id/i)).toBeInTheDocument()
  })
})
