import { getTenantHeaders } from '../tenant/tenantApi'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export type PromoKind = 'percent' | 'nominal'

export interface Promo {
  id: string
  tenant_id?: string
  code: string
  name: string
  kind: PromoKind
  value: number
  min_spend: number
  max_discount: number
  quota: number
  used_count: number
  starts_at: string
  ends_at: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface UpsertPromoInput {
  code: string
  name: string
  kind: PromoKind
  value: number
  min_spend?: number
  max_discount?: number
  quota?: number
  starts_at?: string
  ends_at?: string
  is_active?: boolean
}

export interface ValidatePromoRequest {
  code: string
  subtotal_idr: number
}

export interface ValidatePromoResponse {
  promo_id: string
  code: string
  name: string
  kind: PromoKind
  value: number
  discount_idr: number
}

export class PromosApiError extends Error {
  readonly code: string
  readonly requestId?: string
  readonly details?: Record<string, string>

  constructor(code: string, message: string, requestId?: string, details?: Record<string, string>) {
    super(message)
    this.name = 'PromosApiError'
    this.code = code
    this.requestId = requestId
    this.details = details
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readErrorEnvelope(value: unknown): {
  code: string
  message: string
  requestId?: string
  details?: Record<string, string>
} {
  if (!isRecord(value)) {
    return { code: 'HTTP_ERROR', message: 'Terjadi kesalahan pada server.' }
  }
  const error = isRecord(value.error) ? value.error : undefined
  const details = isRecord(error?.details) ? (error.details as Record<string, string>) : undefined
  return {
    code: typeof error?.code === 'string' ? error.code : 'HTTP_ERROR',
    message: typeof error?.message === 'string' ? error.message : 'Terjadi kesalahan pada server.',
    requestId: typeof value.request_id === 'string' ? value.request_id : undefined,
    details,
  }
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
    throw new PromosApiError('NETWORK_ERROR', 'Koneksi ke server gagal. Periksa jaringan API.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = undefined
  }

  if (!response.ok) {
    const err = readErrorEnvelope(payload)
    throw new PromosApiError(err.code, err.message, err.requestId, err.details)
  }

  if (isRecord(payload) && 'data' in payload) {
    return payload.data as T
  }

  return payload as T
}

export async function fetchPromos(signal?: AbortSignal): Promise<Promo[]> {
  return request<Promo[]>('/api/v1/promos', { method: 'GET' }, signal)
}

export async function getPromoById(id: string, signal?: AbortSignal): Promise<Promo> {
  return request<Promo>(`/api/v1/promos/${encodeURIComponent(id)}`, { method: 'GET' }, signal)
}

export async function createPromo(input: UpsertPromoInput): Promise<Promo> {
  return request<Promo>('/api/v1/promos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function updatePromo(id: string, input: UpsertPromoInput): Promise<Promo> {
  return request<Promo>(`/api/v1/promos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function deletePromo(id: string): Promise<void> {
  await request<void>(`/api/v1/promos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function validatePromo(req: ValidatePromoRequest): Promise<ValidatePromoResponse> {
  return request<ValidatePromoResponse>('/api/v1/promos/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}
