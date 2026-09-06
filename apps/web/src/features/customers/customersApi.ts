import { getTenantHeaders } from '../tenant/tenantApi'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export interface Customer {
  id: string
  tenant_id?: string
  name: string
  phone: string
  email: string
  address: string
  notes: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Pet {
  id: string
  tenant_id?: string
  customer_id: string
  customer_name?: string
  name: string
  species: string
  breed: string
  birth_date?: string | null
  gender: string
  weight_kg: number
  color: string
  allergies: string
  notes: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CustomerInput {
  name: string
  phone?: string
  email?: string
  address?: string
  notes?: string
}

export interface PetInput {
  customer_id: string
  name: string
  species?: string
  breed?: string
  birth_date?: string | null
  gender?: string
  weight_kg?: number
  color?: string
  allergies?: string
  notes?: string
}

export class CustomersApiError extends Error {
  readonly code: string
  readonly requestId?: string
  readonly details?: Record<string, string>

  constructor(code: string, message: string, requestId?: string, details?: Record<string, string>) {
    super(message)
    this.name = 'CustomersApiError'
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
    throw new CustomersApiError('NETWORK_ERROR', 'Koneksi ke server gagal. Periksa jaringan API.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new CustomersApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new CustomersApiError(failure.code, failure.message, failure.requestId, failure.details)
  }

  return (payload as { data: T }).data
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export function getCustomers(search?: string, signal?: AbortSignal): Promise<Customer[]> {
  const path = search?.trim() ? `/api/v1/customers?search=${encodeURIComponent(search.trim())}` : '/api/v1/customers'
  return request<Customer[]>(path, { method: 'GET' }, signal)
}

export function createCustomer(input: CustomerInput, signal?: AbortSignal): Promise<Customer> {
  return request<Customer>('/api/v1/customers', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }, signal)
}

export function updateCustomer(id: string, input: CustomerInput, signal?: AbortSignal): Promise<Customer> {
  return request<Customer>(`/api/v1/customers/${encodeURIComponent(id)}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(input) }, signal)
}

export function getPets(customerId?: string, signal?: AbortSignal): Promise<Pet[]> {
  const path = customerId ? `/api/v1/pets?customer_id=${encodeURIComponent(customerId)}` : '/api/v1/pets'
  return request<Pet[]>(path, { method: 'GET' }, signal)
}

export function createPet(input: PetInput, signal?: AbortSignal): Promise<Pet> {
  return request<Pet>('/api/v1/pets', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }, signal)
}

export function updatePet(id: string, input: PetInput, signal?: AbortSignal): Promise<Pet> {
  return request<Pet>(`/api/v1/pets/${encodeURIComponent(id)}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(input) }, signal)
}
