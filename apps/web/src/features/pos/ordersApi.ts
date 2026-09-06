import { getTenantHeaders } from '../tenant/tenantApi'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name: string
  sku: string
  unit_price_idr: number
  quantity: number
  subtotal_idr: number
  item_kind?: string
  service_id?: string | null
}

export interface Order {
  id: string
  tenant_id?: string
  order_number: string
  location_id: string
  status: 'completed' | 'cancelled' | 'draft'
  payment_method: 'cash' | 'qris' | 'debit_card' | 'credit_card' | 'split'
  subtotal_idr: number
  tax_idr: number
  discount_idr: number
  total_idr: number
  paid_amount_idr: number
  change_amount_idr: number
  cash_amount_idr?: number
  non_cash_amount_idr?: number
  notes: string
  created_at: string
}

export interface OrderDetail extends Order {
  items: OrderItem[]
}

export interface CreateOrderItemInput {
  product_id?: string
  product_name: string
  sku: string
  unit_price_idr: number
  quantity: number
  item_kind?: string
  service_id?: string | null
}

export interface CreateOrderInput {
  location_id: string
  payment_method: 'cash' | 'qris' | 'debit_card' | 'credit_card' | 'split'
  paid_amount_idr: number
  cash_amount_idr?: number
  non_cash_amount_idr?: number
  items: CreateOrderItemInput[]
  tax_idr?: number
  discount_idr?: number
  notes?: string
}

export class OrderApiError extends Error {
  code: string
  requestId?: string

  constructor(message: string, code: string, requestId?: string) {
    super(message)
    this.name = 'OrderApiError'
    this.code = code
    this.requestId = requestId
  }
}

export async function createOrder(input: CreateOrderInput, signal?: AbortSignal): Promise<OrderDetail> {
  const res = await fetch(`${apiBase}/api/v1/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getTenantHeaders(),
    },
    body: JSON.stringify(input),
    signal,
  })

  const payload = await res.json()
  if (!res.ok) {
    throw new OrderApiError(
      payload.error?.message ?? 'Gagal memproses transaksi kasir.',
      payload.error?.code ?? 'ORDER_FAILED',
      payload.request_id,
    )
  }
  return payload.data as OrderDetail
}

export async function getOrders(locationId?: string, signal?: AbortSignal): Promise<Order[]> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  const url = new URL(`${apiBase}/api/v1/orders`, origin)
  if (locationId) {
    url.searchParams.set('location_id', locationId)
  }

  const res = await fetch(url.toString(), {
    headers: {
      ...getTenantHeaders(),
    },
    signal,
  })
  const payload = await res.json()
  if (!res.ok) {
    throw new OrderApiError(
      payload.error?.message ?? 'Gagal memuat riwayat transaksi.',
      payload.error?.code ?? 'FETCH_FAILED',
      payload.request_id,
    )
  }
  return payload.data as Order[]
}

export async function getOrderById(id: string, signal?: AbortSignal): Promise<OrderDetail> {
  const res = await fetch(`${apiBase}/api/v1/orders/${encodeURIComponent(id)}`, {
    headers: {
      ...getTenantHeaders(),
    },
    signal,
  })
  const payload = await res.json()
  if (!res.ok) {
    throw new OrderApiError(
      payload.error?.message ?? 'Gagal memuat detail transaksi.',
      payload.error?.code ?? 'FETCH_FAILED',
      payload.request_id,
    )
  }
  return payload.data as OrderDetail
}
