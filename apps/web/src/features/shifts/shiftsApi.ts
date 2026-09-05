import { getTenantHeaders } from '../tenant/tenantApi'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export interface Shift {
  id: string
  tenant_id: string
  cashier_id?: string
  cashier_name: string
  status: 'open' | 'closed'
  starting_cash_idr: number
  expected_cash_idr: number
  actual_cash_idr: number
  cash_difference_idr: number
  total_cash_sales_idr: number
  total_non_cash_sales_idr: number
  transaction_count: number
  notes: string
  opened_at: string
  closed_at?: string
}

export interface OpenShiftInput {
  cashier_name: string
  starting_cash_idr: number
  notes?: string
}

export interface CloseShiftInput {
  actual_cash_idr: number
  notes?: string
  id?: string
}

export class ShiftApiError extends Error {
  readonly code: string
  readonly requestId?: string

  constructor(code: string, message: string, requestId?: string) {
    super(message)
    this.name = 'ShiftApiError'
    this.code = code
    this.requestId = requestId
  }
}

export async function getCurrentShift(): Promise<Shift | null> {
  const res = await fetch(`${apiBase}/api/v1/shifts/current`, {
    headers: {
      ...getTenantHeaders(),
    },
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null)
    const err = errorBody?.error
    throw new ShiftApiError(
      err?.code ?? 'FETCH_FAILED',
      err?.message ?? 'Gagal mengambil informasi shift saat ini.',
      errorBody?.request_id
    )
  }

  const json = await res.json()
  return json.data ?? null
}

export async function openShift(input: OpenShiftInput): Promise<Shift> {
  const res = await fetch(`${apiBase}/api/v1/shifts/open`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getTenantHeaders(),
    },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null)
    const err = errorBody?.error
    throw new ShiftApiError(
      err?.code ?? 'OPEN_SHIFT_FAILED',
      err?.message ?? 'Gagal membuka shift kasir.',
      errorBody?.request_id
    )
  }

  const json = await res.json()
  const shift = json.data as Shift
  window.dispatchEvent(new CustomEvent('pawpos:shift_change', { detail: shift }))
  return shift
}

export async function closeShift(input: CloseShiftInput): Promise<Shift> {
  const url = input.id
    ? `${apiBase}/api/v1/shifts/${input.id}/close`
    : `${apiBase}/api/v1/shifts/close`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getTenantHeaders(),
    },
    body: JSON.stringify({
      actual_cash_idr: input.actual_cash_idr,
      notes: input.notes,
    }),
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null)
    const err = errorBody?.error
    throw new ShiftApiError(
      err?.code ?? 'CLOSE_SHIFT_FAILED',
      err?.message ?? 'Gagal menutup shift kasir.',
      errorBody?.request_id
    )
  }

  const json = await res.json()
  const shift = json.data as Shift
  window.dispatchEvent(new CustomEvent('pawpos:shift_change', { detail: shift }))
  return shift
}

export async function getShifts(): Promise<Shift[]> {
  const res = await fetch(`${apiBase}/api/v1/shifts`, {
    headers: {
      ...getTenantHeaders(),
    },
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null)
    const err = errorBody?.error
    throw new ShiftApiError(
      err?.code ?? 'FETCH_FAILED',
      err?.message ?? 'Gagal mengambil riwayat shift.',
      errorBody?.request_id
    )
  }

  const json = await res.json()
  return json.data ?? []
}

export async function getShiftById(id: string): Promise<Shift> {
  const res = await fetch(`${apiBase}/api/v1/shifts/${id}`, {
    headers: {
      ...getTenantHeaders(),
    },
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null)
    const err = errorBody?.error
    throw new ShiftApiError(
      err?.code ?? 'NOT_FOUND',
      err?.message ?? 'Shift tidak ditemukan.',
      errorBody?.request_id
    )
  }

  const json = await res.json()
  return json.data as Shift
}
