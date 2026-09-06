import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PosPage } from './PosPage'

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
  {
    id: 'prod-2',
    sku: 'ROTI-001',
    name: 'Roti Bakar Cokelat',
    purchase_price_idr: 7000,
    selling_price_idr: 15000,
    base_unit: 'porsi',
    minimum_stock: 2,
    is_active: true,
    created_at: '2026-09-04T00:00:00Z',
    updated_at: '2026-09-04T00:00:00Z',
  },
]

const sampleStocks = [
  {
    product_id: 'prod-1',
    sku: 'KOP-001',
    product_name: 'Kopi Susu Gula Aren',
    base_unit: 'cup',
    minimum_stock: 5,
    location_id: 'loc-main',
    location_name: 'Toko Utama',
    quantity: 12,
    updated_at: '2026-09-04T00:00:00Z',
  },
  {
    product_id: 'prod-2',
    sku: 'ROTI-001',
    product_name: 'Roti Bakar Cokelat',
    base_unit: 'porsi',
    minimum_stock: 2,
    location_id: 'loc-main',
    location_name: 'Toko Utama',
    quantity: 8,
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

describe('PosPage', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders products, adds item to cart, and updates total', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/products')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleProducts }) })
      }
      if (url.includes('/inventory/stocks')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleStocks }) })
      }
      if (url.includes('/inventory/locations')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleLocations }) })
      }
      return Promise.reject(new Error('not found'))
    })

    vi.stubGlobal('fetch', fetchMock)
    render(<PosPage />)

    // Wait for product to display
    const kopiProduct = await screen.findByText('Kopi Susu Gula Aren')
    expect(kopiProduct).toBeInTheDocument()
    expect(screen.getByText('Roti Bakar Cokelat')).toBeInTheDocument()

    // Click product to add to cart
    await user.click(kopiProduct)

    // Verify cart reflects item and total
    expect(screen.getByText('Keranjang (1)')).toBeInTheDocument()
    expect(screen.getByText('Total Tagihan')).toBeInTheDocument()
    expect(screen.getAllByText('Rp 18.000').length).toBeGreaterThanOrEqual(1)

    // Add again
    await user.click(kopiProduct)
    expect(screen.getByText('Keranjang (2)')).toBeInTheDocument()
    expect(screen.getAllByText('Rp 36.000').length).toBeGreaterThanOrEqual(2)
  })

  it('filters product catalog using search input', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/products')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleProducts }) })
      }
      if (url.includes('/inventory/stocks')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleStocks }) })
      }
      if (url.includes('/inventory/locations')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleLocations }) })
      }
      return Promise.reject(new Error('not found'))
    })

    vi.stubGlobal('fetch', fetchMock)
    render(<PosPage />)

    await screen.findByText('Kopi Susu Gula Aren')
    const searchInput = screen.getByPlaceholderText('Cari nama produk atau SKU...')

    await user.type(searchInput, 'Roti')

    expect(screen.queryByText('Kopi Susu Gula Aren')).not.toBeInTheDocument()
    expect(screen.getByText('Roti Bakar Cokelat')).toBeInTheDocument()
  })

  it('completes checkout flow with cash payment and displays receipt', async () => {
    const createdOrderResponse = {
      id: 'ord-123456',
      order_number: 'ORD-20260904-0001',
      location_id: 'loc-main',
      status: 'completed',
      payment_method: 'cash',
      subtotal_idr: 18000,
      tax_idr: 0,
      discount_idr: 0,
      total_idr: 18000,
      paid_amount_idr: 20000,
      change_amount_idr: 2000,
      notes: '',
      created_at: '2026-09-04T12:00:00Z',
      items: [
        {
          id: 'item-1',
          order_id: 'ord-123456',
          product_id: 'prod-1',
          product_name: 'Kopi Susu Gula Aren',
          sku: 'KOP-001',
          unit_price_idr: 18000,
          quantity: 1,
          subtotal_idr: 18000,
        },
      ],
    }

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/products')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleProducts }) })
      }
      if (url.includes('/inventory/stocks')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleStocks }) })
      }
      if (url.includes('/inventory/locations')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleLocations }) })
      }
      if (url.includes('/orders') && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ data: createdOrderResponse }) })
      }
      return Promise.reject(new Error('not found'))
    })

    vi.stubGlobal('fetch', fetchMock)
    render(<PosPage />)

    const kopiProduct = await screen.findByText('Kopi Susu Gula Aren')
    await user.click(kopiProduct)

    // Click checkout button
    const bayarBtn = screen.getByRole('button', { name: 'Bayar Sekarang' })
    await user.click(bayarBtn)

    // Expect payment modal
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Penyelesaian Pembayaran')).toBeInTheDocument()

    // Type paid amount 20000
    const paidInput = screen.getByLabelText(/Jumlah Diterima/i)
    await user.clear(paidInput)
    await user.type(paidInput, '20000')

    // Confirm checkout
    const submitBtn = screen.getByRole('button', { name: 'Selesaikan Transaksi' })
    await user.click(submitBtn)

    // Expect receipt dialog
    await waitFor(() => {
      expect(screen.getByText('Transaksi Berhasil')).toBeInTheDocument()
    })
    expect(screen.getByText('ORD-20260904-0001')).toBeInTheDocument()
    expect(screen.getByText('Rp 2.000')).toBeInTheDocument() // change
  })

  it('applies discount and tax (PPN 11%) recalculating total correctly', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/products')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleProducts }) })
      }
      if (url.includes('/inventory/stocks')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleStocks }) })
      }
      if (url.includes('/inventory/locations')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleLocations }) })
      }
      return Promise.reject(new Error('not found'))
    })

    vi.stubGlobal('fetch', fetchMock)
    render(<PosPage />)

    const kopiProduct = await screen.findByText('Kopi Susu Gula Aren')
    await user.click(kopiProduct)

    // Open discount modal
    const discountBtn = screen.getByRole('button', { name: '+ Diskon' })
    await user.click(discountBtn)

    // Select 10% preset button
    const tenPercentBtn = screen.getByRole('button', { name: '10%' })
    await user.click(tenPercentBtn)

    // Wait for discount modal to close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Verify discount applied: 10% of Rp 18.000 = Rp 1.800, Total without tax is Rp 16.200
    expect(screen.getByText('Diskon (10%)')).toBeInTheDocument()
    expect(screen.getByText('- Rp 1.800')).toBeInTheDocument()
    expect(screen.getByText('Rp 16.200')).toBeInTheDocument()

    // Toggle PPN 11%
    const ppnSwitch = screen.getByRole('switch')
    await user.click(ppnSwitch)

    // With 11% PPN on Rp 16.200: Tax = Rp 1.782, Total = Rp 17.982
    expect(screen.getByText('+ Rp 1.782')).toBeInTheDocument()
    expect(screen.getByText('Rp 17.982')).toBeInTheDocument()
  })

  it('completes split payment checkout (cash + qris) sending correct payload', async () => {
    let capturedBody: any = null
    const createdOrderResponse = {
      id: 'ord-split-001',
      order_number: 'ORD-20260904-0002',
      location_id: 'loc-main',
      status: 'completed',
      payment_method: 'split',
      subtotal_idr: 18000,
      tax_idr: 0,
      discount_idr: 0,
      total_idr: 18000,
      paid_amount_idr: 20000,
      change_amount_idr: 2000,
      cash_amount_idr: 10000,
      non_cash_amount_idr: 10000,
      notes: '',
      created_at: '2026-09-04T12:00:00Z',
      items: [
        {
          id: 'item-1',
          order_id: 'ord-split-001',
          product_id: 'prod-1',
          product_name: 'Kopi Susu Gula Aren',
          sku: 'KOP-001',
          unit_price_idr: 18000,
          quantity: 1,
          subtotal_idr: 18000,
        },
      ],
    }

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/products')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleProducts }) })
      }
      if (url.includes('/inventory/stocks')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleStocks }) })
      }
      if (url.includes('/inventory/locations')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleLocations }) })
      }
      if (url.includes('/orders') && init?.method === 'POST') {
        capturedBody = JSON.parse(init.body as string)
        return Promise.resolve({ ok: true, json: async () => ({ data: createdOrderResponse }) })
      }
      return Promise.reject(new Error('not found'))
    })

    vi.stubGlobal('fetch', fetchMock)
    render(<PosPage />)

    const kopiProduct = await screen.findByText('Kopi Susu Gula Aren')
    await user.click(kopiProduct)

    // Open checkout modal
    const bayarBtn = screen.getByRole('button', { name: 'Bayar Sekarang' })
    await user.click(bayarBtn)

    // Switch to Split tab
    const splitTab = screen.getByRole('tab', { name: /split/i })
    await user.click(splitTab)

    expect(screen.getByText('Pembayaran Gabungan (Split Payment)')).toBeInTheDocument()

    // Click "Bagi Rata (50%)" button
    const bagiRataBtn = screen.getByRole('button', { name: /Bagi Rata \(50%\)/i })
    await user.click(bagiRataBtn)

    // Submit checkout
    const submitBtn = screen.getByRole('button', { name: 'Selesaikan Transaksi' })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(capturedBody).not.toBeNull()
    })

    expect(capturedBody.payment_method).toBe('split')
    expect(capturedBody.cash_amount_idr).toBe(9000)
    expect(capturedBody.non_cash_amount_idr).toBe(9000)

    // Receipt should show split badge and breakdown
    await waitFor(() => {
      expect(screen.getByText('SPLIT (CAMPURAN)')).toBeInTheDocument()
    })
    expect(screen.getByText('Porsi Tunai')).toBeInTheDocument()
    expect(screen.getByText('Porsi Non-Tunai/QRIS')).toBeInTheDocument()
  })

  it('applies promo voucher code, recalculates discount, and submits promo with order', async () => {
    let capturedOrderBody: any = null
    const createdOrderWithPromo = {
      id: 'ord-promo-001',
      order_number: 'ORD-20260904-0003',
      location_id: 'loc-main',
      status: 'completed',
      payment_method: 'cash',
      subtotal_idr: 18000,
      tax_idr: 0,
      discount_idr: 1800,
      total_idr: 16200,
      paid_amount_idr: 16200,
      change_amount_idr: 0,
      promo_id: 'promo-001',
      promo_code: 'PAWHEMAT10',
      notes: '',
      created_at: '2026-09-04T12:00:00Z',
      items: [
        {
          id: 'item-1',
          order_id: 'ord-promo-001',
          product_id: 'prod-1',
          product_name: 'Kopi Susu Gula Aren',
          sku: 'KOP-001',
          unit_price_idr: 18000,
          quantity: 1,
          subtotal_idr: 18000,
        },
      ],
    }

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/products')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleProducts }) })
      }
      if (url.includes('/inventory/stocks')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleStocks }) })
      }
      if (url.includes('/inventory/locations')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: sampleLocations }) })
      }
      if (url.includes('/promos/validate') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              promo_id: 'promo-001',
              code: 'PAWHEMAT10',
              name: 'Hemat 10 Persen',
              kind: 'percent',
              value: 10,
              discount_idr: 1800,
            },
          }),
        })
      }
      if (url.includes('/orders') && init?.method === 'POST') {
        capturedOrderBody = JSON.parse(init.body as string)
        return Promise.resolve({ ok: true, json: async () => ({ data: createdOrderWithPromo }) })
      }
      return Promise.reject(new Error('not found'))
    })

    vi.stubGlobal('fetch', fetchMock)
    render(<PosPage />)

    const kopiProduct = await screen.findByText('Kopi Susu Gula Aren')
    await user.click(kopiProduct)

    // Open discount & voucher modal
    const discountBtn = screen.getByRole('button', { name: '+ Diskon' })
    await user.click(discountBtn)

    expect(screen.getByText('Kode Voucher / Kupon Promo')).toBeInTheDocument()

    // Type voucher code
    const voucherInput = screen.getByPlaceholderText(/Contoh: PAWHEMAT10/i)
    await user.type(voucherInput, 'pawhemat10')

    // Click Terapkan
    const terapkanBtn = screen.getByRole('button', { name: 'Terapkan' })
    await user.click(terapkanBtn)

    // Wait for discount modal to close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Verify discount applied in cart summary
    expect(screen.getByText(/Voucher \(PAWHEMAT10\)/i)).toBeInTheDocument()
    expect(screen.getByText('- Rp 1.800')).toBeInTheDocument()
    expect(screen.getByText('Rp 16.200')).toBeInTheDocument()

    // Proceed to checkout
    const bayarBtn = screen.getByRole('button', { name: 'Bayar Sekarang' })
    await user.click(bayarBtn)

    const submitBtn = screen.getByRole('button', { name: 'Selesaikan Transaksi' })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(capturedOrderBody).not.toBeNull()
    })
    expect(capturedOrderBody.promo_id).toBe('promo-001')
    expect(capturedOrderBody.promo_code).toBe('PAWHEMAT10')
    expect(capturedOrderBody.discount_idr).toBe(1800)

    // Receipt should display voucher code
    await waitFor(() => {
      expect(screen.getByText('Transaksi Berhasil')).toBeInTheDocument()
    })
    expect(screen.getByText('Voucher Promo')).toBeInTheDocument()
    expect(screen.getByText('PAWHEMAT10')).toBeInTheDocument()
  })
})
