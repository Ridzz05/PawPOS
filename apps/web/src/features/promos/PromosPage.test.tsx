import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import React from 'react'
import { PromosPage } from './PromosPage'
import * as promosApi from './promosApi'

vi.mock('./promosApi', () => ({
  fetchPromos: vi.fn(),
  createPromo: vi.fn(),
  updatePromo: vi.fn(),
  deletePromo: vi.fn(),
  validatePromo: vi.fn(),
}))

describe('PromosPage', () => {
  const mockPromos: promosApi.Promo[] = [
    {
      id: 'promo-1',
      code: 'PAWHEMAT10',
      name: 'Diskon 10%',
      kind: 'percent',
      value: 10,
      min_spend: 50000,
      max_discount: 20000,
      quota: 100,
      used_count: 15,
      starts_at: '2026-01-01T00:00:00Z',
      ends_at: '2026-12-31T23:59:59Z',
      is_active: true,
    },
    {
      id: 'promo-2',
      code: 'POTONGAN25K',
      name: 'Potongan Rp 25.000',
      kind: 'nominal',
      value: 25000,
      min_spend: 100000,
      max_discount: 0,
      quota: 50,
      used_count: 50,
      starts_at: '2026-01-01T00:00:00Z',
      ends_at: '2026-12-31T23:59:59Z',
      is_active: false,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders promo list and stat metrics', async () => {
    vi.mocked(promosApi.fetchPromos).mockResolvedValueOnce(mockPromos)

    render(<PromosPage />)

    expect(screen.getByText(/Memuat data promo & voucher/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('PAWHEMAT10')).toBeInTheDocument()
      expect(screen.getByText('POTONGAN25K')).toBeInTheDocument()
    })

    // Check header and metrics
    expect(screen.getByText(/Promo & Voucher Belanja/i)).toBeInTheDocument()
    expect(screen.getByText('Diskon 10%')).toBeInTheDocument()
    expect(screen.getByText('Potongan Rp 25.000')).toBeInTheDocument()
  })

  it('renders empty state when no promos exist', async () => {
    vi.mocked(promosApi.fetchPromos).mockResolvedValueOnce([])

    render(<PromosPage />)

    await waitFor(() => {
      expect(screen.getByText(/Belum ada promo terdaftar/i)).toBeInTheDocument()
    })
  })

  it('opens create promo dialog and submits new voucher', async () => {
    vi.mocked(promosApi.fetchPromos).mockResolvedValueOnce(mockPromos)
    vi.mocked(promosApi.createPromo).mockResolvedValueOnce({
      id: 'promo-3',
      code: 'DISKONBARU',
      name: 'Promo Member Baru',
      kind: 'percent',
      value: 15,
      min_spend: 30000,
      max_discount: 15000,
      quota: 25,
      used_count: 0,
      starts_at: '2026-01-01T00:00:00Z',
      ends_at: '2026-12-31T23:59:59Z',
      is_active: true,
    })

    render(<PromosPage />)

    await waitFor(() => {
      expect(screen.getByText('PAWHEMAT10')).toBeInTheDocument()
    })

    // Click Tambah Promo button
    const addButton = screen.getByRole('button', { name: /Tambah Promo/i })
    fireEvent.click(addButton)

    // Form inputs
    expect(screen.getByText('Tambah Promo Baru')).toBeInTheDocument()
    const codeInput = screen.getByLabelText(/Kode Voucher \*/i)
    fireEvent.change(codeInput, { target: { value: 'diskonbaru' } })

    const nameInput = screen.getByLabelText(/Nama \/ Judul Promo/i)
    fireEvent.change(nameInput, { target: { value: 'Promo Member Baru' } })

    // Submit button
    const submitBtn = screen.getByRole('button', { name: /Buat Promo/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(promosApi.createPromo).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DISKONBARU',
          name: 'Promo Member Baru',
        })
      )
    })
  })
})
