import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StocksPage } from './StocksPage'

const sampleStocks = [
  {
    product_id: 'p-1',
    sku: 'KOP-001',
    product_name: 'Kopi Susu Gula Aren',
    base_unit: 'cup',
    minimum_stock: 5,
    location_id: 'loc-main',
    location_name: 'Toko Utama',
    quantity: 20,
    updated_at: '2026-09-04T00:00:00Z',
  },
]

const sampleLocations = [
  {
    id: 'loc-main',
    name: 'Toko Utama',
    code: 'MAIN',
    is_active: true,
    created_at: '2026-09-04T00:00:00Z',
  },
]

const sampleProducts = [
  {
    id: 'p-1',
    sku: 'KOP-001',
    name: 'Kopi Susu Gula Aren',
    purchase_price_idr: 8000,
    selling_price_idr: 18000,
    base_unit: 'cup',
    minimum_stock: 5,
    is_active: true,
    created_at: '2026-09-04T00:00:00Z',
    updated_at: '2026-09-04T00:00:00Z',
  },
]

const sampleMovements = [
  {
    id: 'mov-1',
    product_id: 'p-1',
    product_name: 'Kopi Susu Gula Aren',
    sku: 'KOP-001',
    location_id: 'loc-main',
    location_name: 'Toko Utama',
    quantity_delta: 25,
    movement_type: 'purchase_receipt',
    reason: 'PO-2026-001',
    created_at: '2026-09-04T10:00:00Z',
  },
  {
    id: 'mov-2',
    product_id: 'p-1',
    product_name: 'Kopi Susu Gula Aren',
    sku: 'KOP-001',
    location_id: 'loc-main',
    location_name: 'Toko Utama',
    quantity_delta: -5,
    movement_type: 'sale',
    reason: 'Penjualan Kasir POS',
    created_at: '2026-09-04T11:00:00Z',
  },
]

describe('StocksPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders loading then empty state when no stock entries exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/inventory/stocks')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
        }
        if (url.includes('/inventory/movements')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
        }
        if (url.includes('/inventory/locations')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: sampleLocations }) })
        }
        if (url.includes('/products')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: sampleProducts }) })
        }
        return Promise.reject(new Error('not found'))
      }),
    )

    render(<StocksPage />)
    expect(screen.getByText('Memuat data stok inventori...')).toBeInTheDocument()

    expect(await screen.findByText('Belum ada saldo stok tercatat')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Catat Saldo Awal' })).toBeInTheDocument()
  })

  it('renders stocks table when stock balances exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/inventory/stocks')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: sampleStocks }) })
        }
        if (url.includes('/inventory/movements')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: sampleMovements }) })
        }
        if (url.includes('/inventory/locations')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: sampleLocations }) })
        }
        if (url.includes('/products')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: sampleProducts }) })
        }
        return Promise.reject(new Error('not found'))
      }),
    )

    render(<StocksPage />)

    expect(await screen.findByText('Kopi Susu Gula Aren')).toBeInTheDocument()
    expect(screen.getByText('KOP-001')).toBeInTheDocument()
    expect(screen.getByText('20 cup')).toBeInTheDocument()
    expect(screen.getByText('Aman')).toBeInTheDocument()
  })

  it('switches to Buku Mutasi tab and displays movements ledger and metrics', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/inventory/stocks')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: sampleStocks }) })
        }
        if (url.includes('/inventory/movements')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: sampleMovements }) })
        }
        if (url.includes('/inventory/locations')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: sampleLocations }) })
        }
        if (url.includes('/products')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: sampleProducts }) })
        }
        return Promise.reject(new Error('not found'))
      }),
    )

    render(<StocksPage />)
    expect(await screen.findByText('Kopi Susu Gula Aren')).toBeInTheDocument()

    // Click on Buku Mutasi tab
    const tabMutasi = screen.getByRole('tab', { name: /Buku Mutasi/i })
    await user.click(tabMutasi)

    // Verify movements table columns and rows
    expect(screen.getByText('Barang Masuk (Beli)')).toBeInTheDocument()
    expect(screen.getByText('Barang Keluar (Jual)')).toBeInTheDocument()
    expect(screen.getAllByText('+25 unit').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('-5 unit').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('PO-2026-001')).toBeInTheDocument()
    expect(screen.getByText('Penjualan Kasir POS')).toBeInTheDocument()

    // Verify metrics in Buku Mutasi
    expect(screen.getByText('TOTAL BARANG MASUK')).toBeInTheDocument()
    expect(screen.getByText('TOTAL BARANG KELUAR')).toBeInTheDocument()
  })

  it('opens movement recording dialog and submits movement', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === 'POST' && url.includes('/inventory/movements')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              id: 'mov-1',
              product_id: 'p-1',
              location_id: 'loc-main',
              quantity_delta: 10,
              movement_type: 'purchase_receipt',
              created_at: '2026-09-04T00:00:00Z',
            },
          }),
        })
      }
      if (url.includes('/inventory/stocks')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
      }
      if (url.includes('/inventory/movements')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
      }
      if (url.includes('/inventory/locations')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleLocations }) })
      }
      if (url.includes('/products')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleProducts }) })
      }
      return Promise.reject(new Error('not found'))
    })

    vi.stubGlobal('fetch', fetchMock)
    render(<StocksPage />)

    const catatBtn = await screen.findByRole('button', { name: 'Catat Saldo Awal' })
    await user.click(catatBtn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Catat Pergerakan Stok' })).toBeInTheDocument()

    // Type delta
    const deltaInput = screen.getByLabelText(/Jumlah Delta Perubahan/i)
    await user.type(deltaInput, '10')

    // Submit
    await user.click(screen.getByRole('button', { name: 'Simpan Pergerakan' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/inventory/movements'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('opens Inbound Barang Masuk dialog when + Barang Masuk button is clicked', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/inventory/stocks')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: sampleStocks }) })
        }
        if (url.includes('/inventory/movements')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: sampleMovements }) })
        }
        if (url.includes('/inventory/locations')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: sampleLocations }) })
        }
        if (url.includes('/products')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: sampleProducts }) })
        }
        return Promise.reject(new Error('not found'))
      }),
    )

    render(<StocksPage />)
    const inboundBtn = await screen.findByRole('button', { name: /\+ Barang Masuk/i })
    await user.click(inboundBtn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Catat Barang Masuk/i })).toBeInTheDocument()
  })
})
