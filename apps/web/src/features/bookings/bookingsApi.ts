import { getTenantHeaders } from '../tenant/tenantApi'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export type BookingStatus = 'antre' | 'proses' | 'selesai' | 'batal'

export interface Booking {
  id: string
  tenant_id?: string
  customer_id: string
  pet_id: string
  service_id?: string | null
  package_id?: string | null
  location_id: string
  scheduled_at: string
  status: BookingStatus
  staff_name: string
  notes: string
  order_id?: string | null
  created_at: string
  updated_at: string
}

export interface BookingInput {
  customer_id: string
  pet_id: string
  service_id?: string | null
  package_id?: string | null
  location_id: string
  scheduled_at: string
  staff_name?: string
  notes?: string
}

export type CompletePaymentMethod = 'cash' | 'qris' | 'debit_card' | 'credit_card' | 'split'

export interface CompleteBookingInput {
  payment_method: CompletePaymentMethod
  paid_amount_idr: number
  cash_amount_idr?: number
  non_cash_amount_idr?: number
  notes?: string
}

export interface BookingCompleted {
  booking: Booking
  order: {
    id: string
    order_number: string
    total_idr: number
  }
}

export const BOOKING_STATUSES: { value: BookingStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'antre', label: 'Antre' },
  { value: 'proses', label: 'Diproses' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'batal', label: 'Batal' },
]

export class BookingsApiError extends Error {
  readonly code: string
  readonly requestId?: string

  constructor(code: string, message: string, requestId?: string) {
    super(message)
    this.name = 'BookingsApiError'
    this.code = code
    this.requestId = requestId
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function request<T>(path: string, init?: RequestInit, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...getTenantHeaders(),
        ...(init?.headers ?? {}),
      },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new BookingsApiError('NETWORK_ERROR', 'Koneksi ke server gagal. Periksa jaringan API.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new BookingsApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined
    throw new BookingsApiError(
      typeof failure?.code === 'string' ? failure.code : 'HTTP_ERROR',
      typeof failure?.message === 'string' ? failure.message : 'Permintaan booking gagal.',
    )
  }

  return (payload as { data: T }).data
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export function getBookings(filter?: { status?: string; date?: string }, signal?: AbortSignal): Promise<Booking[]> {
  const params = new URLSearchParams()
  if (filter?.status && filter.status !== 'all') params.set('status', filter.status)
  if (filter?.date) params.set('date', filter.date)
  const query = params.toString() ? `?${params.toString()}` : ''
  return request<Booking[]>(`/api/v1/bookings${query}`, { method: 'GET' }, signal)
}

export function createBooking(input: BookingInput, signal?: AbortSignal): Promise<Booking> {
  return request<Booking>('/api/v1/bookings', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }, signal)
}

export function changeBookingStatus(id: string, status: 'proses' | 'batal', notes?: string, signal?: AbortSignal): Promise<Booking> {
  return request<Booking>(
    `/api/v1/bookings/${encodeURIComponent(id)}/status`,
    { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ status, notes: notes ?? '' }) },
    signal,
  )
}

export function completeBooking(id: string, input: CompleteBookingInput, signal?: AbortSignal): Promise<BookingCompleted> {
  return request<BookingCompleted>(
    `/api/v1/bookings/${encodeURIComponent(id)}/complete`,
    { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) },
    signal,
  )
}
