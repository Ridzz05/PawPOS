import { getTenantHeaders } from '../tenant/tenantApi'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export type ServiceCategory = 'grooming' | 'klinik' | 'penitipan' | 'lainnya'

export interface Service {
  id: string
  tenant_id?: string
  name: string
  category: ServiceCategory
  price_idr: number
  duration_minutes: number
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PackageItem {
  service_id: string
  service_name?: string
  sessions_included: number
  duration_minutes?: number
}

export interface ServicePackage {
  id: string
  tenant_id?: string
  name: string
  price_idr: number
  description: string
  items: PackageItem[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ServiceInput {
  name: string
  category?: ServiceCategory
  price_idr?: number
  duration_minutes?: number
  description?: string
}

export interface PackageInput {
  name: string
  price_idr?: number
  description?: string
  items: { service_id: string; sessions_included: number }[]
}

export const SERVICE_CATEGORIES: { value: ServiceCategory; label: string }[] = [
  { value: 'grooming', label: 'Grooming' },
  { value: 'klinik', label: 'Klinik' },
  { value: 'penitipan', label: 'Penitipan' },
  { value: 'lainnya', label: 'Lainnya' },
]

export class ServicesApiError extends Error {
  readonly code: string
  readonly requestId?: string
  readonly details?: Record<string, string>

  constructor(code: string, message: string, requestId?: string, details?: Record<string, string>) {
    super(message)
    this.name = 'ServicesApiError'
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
    throw new ServicesApiError('NETWORK_ERROR', 'Koneksi ke server gagal. Periksa jaringan API.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ServicesApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new ServicesApiError(failure.code, failure.message, failure.requestId, failure.details)
  }

  return (payload as { data: T }).data
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export function getServices(category?: string, signal?: AbortSignal): Promise<Service[]> {
  const path = category ? `/api/v1/services?category=${encodeURIComponent(category)}` : '/api/v1/services'
  return request<Service[]>(path, { method: 'GET' }, signal)
}

export function createService(input: ServiceInput, signal?: AbortSignal): Promise<Service> {
  return request<Service>('/api/v1/services', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }, signal)
}

export function updateService(id: string, input: ServiceInput, signal?: AbortSignal): Promise<Service> {
  return request<Service>(`/api/v1/services/${encodeURIComponent(id)}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(input) }, signal)
}

export function getPackages(signal?: AbortSignal): Promise<ServicePackage[]> {
  return request<ServicePackage[]>('/api/v1/packages', { method: 'GET' }, signal)
}

export function createPackage(input: PackageInput, signal?: AbortSignal): Promise<ServicePackage> {
  return request<ServicePackage>('/api/v1/packages', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }, signal)
}

export function updatePackage(id: string, input: PackageInput, signal?: AbortSignal): Promise<ServicePackage> {
  return request<ServicePackage>(`/api/v1/packages/${encodeURIComponent(id)}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(input) }, signal)
}
