import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CsAssistantWidget } from './CsAssistantWidget'
import * as assistantApi from './assistantApi'

describe('CsAssistantWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('renders collapsed floating mascot button by default', () => {
    render(<CsAssistantWidget />)
    const fabButton = screen.getByRole('button', { name: 'Buka PawPOS AI Assistant' })
    expect(fabButton).toBeInTheDocument()
    expect(screen.getByAltText('PawPOS Mascot Assistant')).toBeInTheDocument()
  })

  it('opens chat drawer when clicking the floating button', async () => {
    const user = userEvent.setup()
    render(<CsAssistantWidget />)

    const fabButton = screen.getByRole('button', { name: 'Buka PawPOS AI Assistant' })
    await user.click(fabButton)

    // Verify header and assistant name
    expect(screen.getByText('Online • Copilot Operasional Toko')).toBeInTheDocument()
    expect(screen.getAllByText('GPT-OSS 120B').length).toBeGreaterThan(0)
    // Verify welcome message
    expect(screen.getByText(/Halo! Saya/i)).toBeInTheDocument()
    // Verify quick action prompts
    expect(screen.getByText('📦 Cek Stok Menipis')).toBeInTheDocument()
    expect(screen.getByText('💰 Status Shift Kasir')).toBeInTheDocument()
  })

  it('closes the chat drawer when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<CsAssistantWidget />)

    // Open first
    await user.click(screen.getByRole('button', { name: 'Buka PawPOS AI Assistant' }))
    expect(screen.getByText('Online • Copilot Operasional Toko')).toBeInTheDocument()

    // Close via header close button
    const closeBtn = screen.getByRole('button', { name: 'Tutup asisten' })
    await user.click(closeBtn)

    // Drawer should be closed, navbar button stays permanently visible
    expect(screen.queryByText('Online • Copilot Operasional Toko')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buka PawPOS AI Assistant' })).toBeInTheDocument()
  })

  it('sends user message and displays assistant response', async () => {
    const mockReply = 'Stok Whiskas Tuna 1kg tersisa 2 sak di gudang utama.'
    const chatSpy = vi.spyOn(assistantApi, 'sendAssistantChat').mockResolvedValueOnce({
      reply: mockReply,
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
    })

    const user = userEvent.setup()
    render(<CsAssistantWidget />)

    // Open chat
    await user.click(screen.getByRole('button', { name: 'Buka PawPOS AI Assistant' }))

    // Type query
    const input = screen.getByPlaceholderText('Tanya produk, stok, shift, pet care...')
    await user.type(input, 'Cek stok whiskas tuna{enter}')

    // Input should be cleared and loading / thinking state shown
    expect(chatSpy).toHaveBeenCalledWith('Cek stok whiskas tuna', expect.any(Array))

    // Check response received
    expect(await screen.findByText(mockReply)).toBeInTheDocument()
  })

  it('triggers quick prompt when clicked', async () => {
    const mockReply = 'Semua kasir shift pagi tercatat seimbang.'
    const chatSpy = vi.spyOn(assistantApi, 'sendAssistantChat').mockResolvedValueOnce({
      reply: mockReply,
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
    })

    const user = userEvent.setup()
    render(<CsAssistantWidget />)

    // Open chat
    await user.click(screen.getByRole('button', { name: 'Buka PawPOS AI Assistant' }))

    // Click quick prompt
    const promptBtn = screen.getByText('💰 Status Shift Kasir')
    await user.click(promptBtn)

    expect(chatSpy).toHaveBeenCalledWith(
      'Bagaimana status kasir dan kondisi uang kas laci pada shift ini?',
      expect.any(Array),
    )
    expect(await screen.findByText(mockReply)).toBeInTheDocument()
  })

  it('handles chat error gracefully with error notification', async () => {
    vi.spyOn(assistantApi, 'sendAssistantChat').mockRejectedValueOnce(new Error('Network failure'))

    const user = userEvent.setup()
    render(<CsAssistantWidget />)

    await user.click(screen.getByRole('button', { name: 'Buka PawPOS AI Assistant' }))

    const input = screen.getByPlaceholderText('Tanya produk, stok, shift, pet care...')
    await user.type(input, 'Halo asisten{enter}')

    expect(await screen.findByText(/Maaf, terjadi kendala saat memproses permintaan/i)).toBeInTheDocument()
  })

  it('clears chat history when clear chat button is clicked', async () => {
    const user = userEvent.setup()
    render(<CsAssistantWidget />)

    await user.click(screen.getByRole('button', { name: 'Buka PawPOS AI Assistant' }))

    const clearBtn = screen.getByRole('button', { name: 'Bersihkan riwayat chat' })
    expect(clearBtn).toBeInTheDocument()
    await user.click(clearBtn)

    expect(screen.getByText(/Halo! Saya/i)).toBeInTheDocument()
  })
})
