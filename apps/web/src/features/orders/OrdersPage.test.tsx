import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrdersPage } from './OrdersPage'
import * as ordersApi from '../pos/ordersApi'

const mockOrders: ordersApi.Order[] = [
  {
    id: 'ord-000001',
    order_number: 'ORD-20260905-0001',
    location_id: 'loc-main',
    status: 'completed',
    payment_method: 'cash',
    subtotal_idr: 50000,
    tax_idr: 0,
    discount_idr: 0,
    total_idr: 50000,
    paid_amount_idr: 100000,
    change_amount_idr: 50000,
    notes: 'Order meja 3',
    created_at: '2026-09-05T10:30:00Z',
  },
  {
    id: 'ord-000002',
    order_number: 'ORD-20260905-0002',
    location_id: 'loc-main',
    status: 'completed',
    payment_method: 'qris',
    subtotal_idr: 35000,
    tax_idr: 0,
    discount_idr: 0,
    total_idr: 35000,
    paid_amount_idr: 35000,
    change_amount_idr: 0,
    notes: 'Takeaway kopi',
    created_at: '2026-09-05T11:15:00Z',
  },
]

const mockDetail: ordersApi.OrderDetail = {
  ...mockOrders[0],
  items: [
    {
      id: 'item-1',
      order_id: 'ord-000001',
      product_id: 'prod-1',
      product_name: 'Kopi Susu Gula Aren',
      sku: 'KOP-001',
      unit_price_idr: 25000,
      quantity: 2,
      subtotal_idr: 50000,
    },
  ],
}

describe('OrdersPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders loading then empty state when no orders exist', async () => {
    vi.spyOn(ordersApi, 'getOrders').mockResolvedValue([])

    render(<OrdersPage />)

    expect(screen.getByText(/Memuat data riwayat transaksi/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Tidak ada transaksi ditemukan')).toBeInTheDocument()
      expect(screen.getByText(/Belum ada transaksi penjualan yang tersimpan/i)).toBeInTheDocument()
    })
  })

  it('renders orders table with metrics when orders exist', async () => {
    vi.spyOn(ordersApi, 'getOrders').mockResolvedValue(mockOrders)

    render(<OrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('ORD-20260905-0001')).toBeInTheDocument()
      expect(screen.getByText('ORD-20260905-0002')).toBeInTheDocument()
    })

    // Check financial metrics
    expect(screen.getByText('TOTAL PENJUALAN')).toBeInTheDocument()
    expect(screen.getByText('TOTAL STRUK TRANSAKSI')).toBeInTheDocument()
    expect(screen.getByText('2 Order')).toBeInTheDocument()
    expect(screen.getByText('Tunai (Cash)')).toBeInTheDocument()
    expect(screen.getAllByText('QRIS').length).toBeGreaterThan(0)
  })

  it('filters orders by search query and payment method chips', async () => {
    vi.spyOn(ordersApi, 'getOrders').mockResolvedValue(mockOrders)

    render(<OrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('ORD-20260905-0001')).toBeInTheDocument()
      expect(screen.getByText('ORD-20260905-0002')).toBeInTheDocument()
    })

    // Filter by search query
    const searchInput = screen.getByPlaceholderText(/Cari nomor pesanan/i)
    fireEvent.change(searchInput, { target: { value: 'Takeaway' } })

    expect(screen.queryByText('ORD-20260905-0001')).not.toBeInTheDocument()
    expect(screen.getByText('ORD-20260905-0002')).toBeInTheDocument()

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } })
    expect(screen.getByText('ORD-20260905-0001')).toBeInTheDocument()

    // Filter by payment method
    fireEvent.click(screen.getByRole('button', { name: 'Tunai' }))
    expect(screen.getByText('ORD-20260905-0001')).toBeInTheDocument()
    expect(screen.queryByText('ORD-20260905-0002')).not.toBeInTheDocument()
  })

  it('opens order detail modal and displays thermal receipt breakdown', async () => {
    vi.spyOn(ordersApi, 'getOrders').mockResolvedValue(mockOrders)
    vi.spyOn(ordersApi, 'getOrderById').mockResolvedValue(mockDetail)
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    render(<OrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('ORD-20260905-0001')).toBeInTheDocument()
    })

    // Click "Lihat Struk" on the first order
    const detailButtons = screen.getAllByRole('button', { name: /Lihat Struk/i })
    fireEvent.click(detailButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/Struk Digital & Rincian Pesanan/i)).toBeInTheDocument()
      expect(screen.getByText('Kopi Susu Gula Aren')).toBeInTheDocument()
      expect(screen.getByText('RINCIAN ITEM BELANJA')).toBeInTheDocument()
      expect(screen.getByText('TOTAL DIBAYAR')).toBeInTheDocument()
    })

    // Click "Cetak Struk Thermal"
    const printBtn = screen.getByRole('button', { name: /Cetak Struk Thermal/i })
    fireEvent.click(printBtn)
    expect(printSpy).toHaveBeenCalled()

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: 'Tutup' }))
    await waitFor(() => {
      expect(screen.queryByText('Kopi Susu Gula Aren')).not.toBeInTheDocument()
    })
  })

  it('filters by Split payment chip and displays split tender breakdown in details', async () => {
    const mockSplitOrder: ordersApi.Order = {
      id: 'ord-000003',
      order_number: 'ORD-20260905-0003',
      location_id: 'loc-main',
      status: 'completed',
      payment_method: 'split',
      subtotal_idr: 40000,
      tax_idr: 0,
      discount_idr: 0,
      total_idr: 40000,
      paid_amount_idr: 50000,
      change_amount_idr: 10000,
      cash_amount_idr: 20000,
      non_cash_amount_idr: 20000,
      notes: 'Split payment order',
      created_at: '2026-09-05T12:00:00Z',
    }

    const mockSplitDetail: ordersApi.OrderDetail = {
      ...mockSplitOrder,
      items: [
        {
          id: 'item-3',
          order_id: 'ord-000003',
          product_id: 'prod-1',
          product_name: 'Kopi Susu Gula Aren',
          sku: 'KOP-001',
          unit_price_idr: 20000,
          quantity: 2,
          subtotal_idr: 40000,
        },
      ],
    }

    vi.spyOn(ordersApi, 'getOrders').mockResolvedValue([...mockOrders, mockSplitOrder])
    vi.spyOn(ordersApi, 'getOrderById').mockResolvedValue(mockSplitDetail)

    render(<OrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('ORD-20260905-0003')).toBeInTheDocument()
    })

    // Click "Split" filter chip
    const splitFilterChip = screen.getByRole('button', { name: 'Split' })
    fireEvent.click(splitFilterChip)

    // Only split order should be visible
    expect(screen.getByText('ORD-20260905-0003')).toBeInTheDocument()
    expect(screen.queryByText('ORD-20260905-0001')).not.toBeInTheDocument()
    expect(screen.queryByText('ORD-20260905-0002')).not.toBeInTheDocument()

    // Open detail modal
    const detailBtn = screen.getByRole('button', { name: /Lihat Struk/i })
    fireEvent.click(detailBtn)

    await waitFor(() => {
      expect(screen.getAllByText(/Split \(Campuran\)/i).length).toBeGreaterThan(0)
      expect(screen.getByText(/Porsi Tunai \(Kas Laci\)/i)).toBeInTheDocument()
      expect(screen.getByText(/Porsi Non-Tunai \/ QRIS/i)).toBeInTheDocument()
    })
  })
})
