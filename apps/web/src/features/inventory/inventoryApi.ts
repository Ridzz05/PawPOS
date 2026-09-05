import { getTenantHeaders } from '../tenant/tenantApi'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export type InventoryLocation = {
  id: string
  tenant_id?: string
  name: string
  code: string
  is_active: boolean
  created_at: string
}

export type ProductStockSummary = {
  tenant_id?: string
  product_id: string
  sku: string
  product_name: string
  base_unit: string
  minimum_stock: number
  location_id: string
  location_name: string
  quantity: number
  updated_at: string
}

export type MovementType = 'opening' | 'purchase_receipt' | 'sale' | 'adjustment' | 'return'

export type StockMovement = {
  id: string
  tenant_id?: string
  product_id: string
  location_id: string
  quantity_delta: number
  movement_type: MovementType
  reference_type?: string | null
  reference_id?: string | null
  reason?: string | null
  created_at: string
}

export type StockMovementItem = {
  id: string
  tenant_id?: string
  product_id: string
  product_name: string
  sku: string
  location_id: string
  location_name: string
  quantity_delta: number
  movement_type: MovementType
  reference_type?: string | null
  reference_id?: string | null
  reason?: string | null
  created_at: string
}

export type MovementFilterParams = {
  product_id?: string
  location_id?: string
  movement_type?: string
}

export type RecordMovementInput = {
  product_id: string
  location_id: string
  quantity_delta: number
  movement_type: MovementType
  reason?: string | null
  reference_type?: string | null
}

export class InventoryApiError extends Error {
  readonly code: string
  readonly requestId?: string
  readonly details?: Record<string, string>

  constructor(code: string, message: string, requestId?: string, details?: Record<string, string>) {
    super(message)
    this.name = 'InventoryApiError'
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
    return { code: 'HTTP_ERROR', message: 'Terjadi kesalahan pada server inventori.' }
  }

  const error = isRecord(value.error) ? value.error : undefined
  const details = isRecord(error?.details) ? (error.details as Record<string, string>) : undefined

  return {
    code: typeof error?.code === 'string' ? error.code : 'HTTP_ERROR',
    message: typeof error?.message === 'string' ? error.message : 'Terjadi kesalahan pada server inventori.',
    requestId: typeof value.request_id === 'string' ? value.request_id : undefined,
    details,
  }
}

export async function getStockBalances(locationId?: string, signal?: AbortSignal): Promise<ProductStockSummary[]> {
  const url = new URL(`${apiBase}/api/v1/inventory/stocks`)
  if (locationId) {
    url.searchParams.set('location_id', locationId)
  }

  let response: Response
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json', ...getTenantHeaders() },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new InventoryApiError('NETWORK_ERROR', 'Koneksi ke server gagal. Periksa jaringan API.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new InventoryApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new InventoryApiError(failure.code, failure.message, failure.requestId, failure.details)
  }

  const success = payload as { data?: ProductStockSummary[] }
  return Array.isArray(success.data) ? success.data : []
}

export async function getLocations(signal?: AbortSignal): Promise<InventoryLocation[]> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/v1/inventory/locations`, {
      method: 'GET',
      headers: { Accept: 'application/json', ...getTenantHeaders() },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new InventoryApiError('NETWORK_ERROR', 'Koneksi ke server gagal. Periksa jaringan API.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new InventoryApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new InventoryApiError(failure.code, failure.message, failure.requestId, failure.details)
  }

  const success = payload as { data?: InventoryLocation[] }
  return Array.isArray(success.data) ? success.data : []
}

export async function recordMovement(input: RecordMovementInput, signal?: AbortSignal): Promise<StockMovement> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/v1/inventory/movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getTenantHeaders(),
      },
      body: JSON.stringify(input),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new InventoryApiError('NETWORK_ERROR', 'Koneksi ke server gagal. Periksa jaringan API.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new InventoryApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new InventoryApiError(failure.code, failure.message, failure.requestId, failure.details)
  }

  const success = payload as { data?: StockMovement }
  if (!success.data) {
    throw new InventoryApiError('INVALID_RESPONSE', 'Server tidak mengembalikan data pergerakan stok.')
  }
  return success.data
}

export async function getStockMovements(
  params?: MovementFilterParams,
  signal?: AbortSignal
): Promise<StockMovementItem[]> {
  const url = new URL(`${apiBase}/api/v1/inventory/movements`)
  if (params?.product_id) url.searchParams.set('product_id', params.product_id)
  if (params?.location_id) url.searchParams.set('location_id', params.location_id)
  if (params?.movement_type) url.searchParams.set('movement_type', params.movement_type)

  let response: Response
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json', ...getTenantHeaders() },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new InventoryApiError('NETWORK_ERROR', 'Koneksi ke server gagal. Periksa jaringan API.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new InventoryApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new InventoryApiError(failure.code, failure.message, failure.requestId, failure.details)
  }

  const success = payload as { data?: StockMovementItem[] }
  return Array.isArray(success.data) ? success.data : []
}

