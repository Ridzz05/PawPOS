const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export interface Tenant {
  id: string
  name: string
  slug: string
  plan_type: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RegisterTenantInput {
  name: string
  slug: string
  plan_type?: string
}

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export const DEFAULT_TENANT: Tenant = {
  id: DEFAULT_TENANT_ID,
  name: 'Default Store',
  slug: 'default-store',
  plan_type: 'starter',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export function getActiveTenant(): Tenant {
  try {
    const raw = localStorage.getItem('pawpos_active_tenant')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && parsed.id) {
        return parsed as Tenant
      }
    }
  } catch {
    // Fallback to default tenant if parsing fails
  }
  return DEFAULT_TENANT
}

export function setActiveTenant(tenant: Tenant): void {
  try {
    localStorage.setItem('pawpos_active_tenant', JSON.stringify(tenant))
    localStorage.setItem('pawpos_active_tenant_id', tenant.id)
  } catch {
    // Storage quota or restriction fallback
  }
  window.dispatchEvent(new CustomEvent('pawpos:tenant_change', { detail: tenant }))
}

export function getTenantHeaders(): Record<string, string> {
  const tenant = getActiveTenant()
  return {
    'X-Tenant-ID': tenant.id || DEFAULT_TENANT_ID,
  }
}

export class TenantApiError extends Error {
  readonly code: string
  readonly requestId?: string
  readonly details?: Record<string, string>

  constructor(code: string, message: string, requestId?: string, details?: Record<string, string>) {
    super(message)
    this.name = 'TenantApiError'
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
    return { code: 'HTTP_ERROR', message: 'Terjadi kesalahan pada server tenant.' }
  }

  const error = isRecord(value.error) ? value.error : undefined
  const details = isRecord(error?.details) ? (error.details as Record<string, string>) : undefined

  return {
    code: typeof error?.code === 'string' ? error.code : 'HTTP_ERROR',
    message: typeof error?.message === 'string' ? error.message : 'Terjadi kesalahan pada server tenant.',
    requestId: typeof value.request_id === 'string' ? value.request_id : undefined,
    details,
  }
}

export async function getTenants(signal?: AbortSignal): Promise<Tenant[]> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/v1/tenants`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new TenantApiError('NETWORK_ERROR', 'Koneksi ke server gagal. Periksa jaringan API.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new TenantApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new TenantApiError(failure.code, failure.message, failure.requestId, failure.details)
  }

  const success = payload as { data?: Tenant[] }
  return Array.isArray(success.data) ? success.data : []
}

export async function registerTenant(input: RegisterTenantInput, signal?: AbortSignal): Promise<Tenant> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/v1/tenants/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(input),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new TenantApiError('NETWORK_ERROR', 'Koneksi ke server gagal saat mendaftarkan toko.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new TenantApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new TenantApiError(failure.code, failure.message, failure.requestId, failure.details)
  }

  const success = payload as { data?: Tenant }
  if (!success.data) {
    throw new TenantApiError('INVALID_RESPONSE', 'Server tidak mengembalikan data merchant baru.')
  }
  return success.data
}
