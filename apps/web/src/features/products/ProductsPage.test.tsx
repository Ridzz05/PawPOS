import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductsPage } from './ProductsPage'

const sampleProducts = [
  {
    id: 'prod-1',
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

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders loading then empty state when no products exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], request_id: 'req-empty' }),
      }),
    )

    render(<ProductsPage />)
    expect(screen.getByText('Memuat katalog produk...')).toBeInTheDocument()

    expect(await screen.findByText('Katalog produk masih kosong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tambah Produk Pertama' })).toBeInTheDocument()
  })

  it('renders products table when products are loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: sampleProducts, request_id: 'req-list' }),
      }),
    )

    render(<ProductsPage />)

    expect(await screen.findByText('Kopi Susu Gula Aren')).toBeInTheDocument()
    expect(screen.getByText('KOP-001')).toBeInTheDocument()
    expect(screen.getByText('cup')).toBeInTheDocument()
    expect(screen.getByText('Aktif')).toBeInTheDocument()
  })

  it('opens create dialog, validates inputs, and submits new product', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      // Initial list call: empty
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], request_id: 'req-empty' }),
      })
      // Creation call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'prod-new',
            sku: 'TEA-001',
            name: 'Teh Melati Hangat',
            purchase_price_idr: 3000,
            selling_price_idr: 7000,
            base_unit: 'cup',
            minimum_stock: 2,
            is_active: true,
            created_at: '2026-09-04T00:00:00Z',
            updated_at: '2026-09-04T00:00:00Z',
          },
          request_id: 'req-create',
        }),
      })

    vi.stubGlobal('fetch', fetchMock)
    render(<ProductsPage />)

    // Wait for empty state to load
    const addBtn = await screen.findByRole('button', { name: 'Tambah Produk Pertama' })
    await user.click(addBtn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Tambah Produk Baru')).toBeInTheDocument()

    // Fill form
    await user.type(screen.getByLabelText(/SKU \/ Kode Barang/i), 'TEA-001')
    await user.type(screen.getByLabelText(/Nama Produk/i), 'Teh Melati Hangat')
    const unitInput = screen.getByLabelText(/Satuan Dasar/i)
    await user.clear(unitInput)
    await user.type(unitInput, 'cup')
    await user.type(screen.getByLabelText(/Harga Beli \(Rp\)/i), '3000')
    await user.type(screen.getByLabelText(/Harga Jual \(Rp\)/i), '7000')

    // Submit
    await user.click(screen.getByRole('button', { name: 'Simpan Produk' }))

    // Expect dialog to close and new item to appear in the table
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Teh Melati Hangat')).toBeInTheDocument()
    expect(screen.getByText('TEA-001')).toBeInTheDocument()
  }, 15000)

  it('renders error state and handles retry', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network failed'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: sampleProducts, request_id: 'req-retry' }),
      })

    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<ProductsPage />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    const retryBtn = screen.getByRole('button', { name: 'Coba lagi' })
    await user.click(retryBtn)

    expect(await screen.findByText('Kopi Susu Gula Aren')).toBeInTheDocument()
  })

  it('opens edit dialog, edits product, and submits changes', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      // Initial list call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: sampleProducts, request_id: 'req-list' }),
      })
      // Update PUT call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            ...sampleProducts[0],
            name: 'Kopi Susu Gula Aren Spesial',
            selling_price_idr: 20000,
          },
          request_id: 'req-update',
        }),
      })

    vi.stubGlobal('fetch', fetchMock)
    render(<ProductsPage />)

    // Wait for product to load
    expect(await screen.findByText('Kopi Susu Gula Aren')).toBeInTheDocument()

    // Click edit button
    const editBtn = screen.getByRole('button', { name: /Edit Kopi Susu Gula Aren/i })
    await user.click(editBtn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Edit Data Produk')).toBeInTheDocument()

    // Change name
    const nameInput = screen.getByLabelText(/Nama Produk/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Kopi Susu Gula Aren Spesial')

    // Submit edit
    await user.click(screen.getByRole('button', { name: 'Simpan Perubahan' }))

    // Expect dialog to close and updated name to show
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Kopi Susu Gula Aren Spesial')).toBeInTheDocument()
  }, 15000)

  it('opens delete confirmation dialog and deletes product', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      // Initial list call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: sampleProducts, request_id: 'req-list' }),
      })
      // Delete call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { message: 'Produk berhasil dihapus.' },
          request_id: 'req-del',
        }),
      })

    vi.stubGlobal('fetch', fetchMock)
    render(<ProductsPage />)

    // Wait for product to load
    expect(await screen.findByText('Kopi Susu Gula Aren')).toBeInTheDocument()

    // Click delete button
    const deleteBtn = screen.getByRole('button', { name: /Hapus Kopi Susu Gula Aren/i })
    await user.click(deleteBtn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Hapus Produk?')).toBeInTheDocument()

    // Confirm delete
    await user.click(screen.getByRole('button', { name: 'Ya, Hapus' }))

    // Expect product removed from table
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText('KOP-001')).not.toBeInTheDocument()
  })
})

