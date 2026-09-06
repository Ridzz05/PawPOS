import { getTenantHeaders } from '../tenant/tenantApi'
import type { StaffRole } from './rbac'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
// Backend tidak wajib ada (mode demo lokal). Timeout pendek agar fallback instan.
const AUTH_TIMEOUT_MS = 3500

export interface BackendUser {
  id: string
  email: string
  display_name: string
  role: StaffRole
  avatar: string
  tenant_id: string
  is_active: boolean
  permissions: string[]
}

export interface BackendAuthResponse {
  token: string
  expires_at: string
  user: BackendUser
}

export class AuthApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'AuthApiError'
    this.code = code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function postAuth<T>(path: string, body: Record<string, string>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getTenantHeaders(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new AuthApiError('NETWORK_ERROR', 'Server auth tidak terjangkau.')
  } finally {
    clearTimeout(timer)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new AuthApiError('INVALID_RESPONSE', 'Server auth mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined
    const code = typeof failure?.code === 'string' ? failure.code : 'HTTP_ERROR'
    const message =
      typeof failure?.message === 'string' ? failure.message : 'Login gagal. Silakan coba kembali.'
    throw new AuthApiError(code, message)
  }

  const data = isRecord(payload) ? (payload.data as T) : undefined
  if (!data) {
    throw new AuthApiError('INVALID_RESPONSE', 'Server auth tidak mengembalikan data sesi.')
  }
  return data
}

export function loginWithBackend(email: string, password: string): Promise<BackendAuthResponse> {
  return postAuth<BackendAuthResponse>('/api/v1/auth/login', { email, password })
}

export function loginPinWithBackend(role: string, pin: string): Promise<BackendAuthResponse> {
  return postAuth<BackendAuthResponse>('/api/v1/auth/pin', { role, pin })
}

/** Best-effort: cabut sesi backend tanpa memblokir logout lokal. */
export function revokeBackendSession(token: string): void {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS)
    void fetch(`${apiBase}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...getTenantHeaders(),
      },
      signal: controller.signal,
    })
      .catch(() => undefined)
      .finally(() => clearTimeout(timer))
  } catch {
    // abaikan: logout lokal tetap jalan
  }
}
