import { getTenantHeaders } from '../tenant/tenantApi'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export type Product = {
  id: string
  tenant_id?: string
  category_id?: string | null
  sku: string
  name: string
  purchase_price_idr: number
  selling_price_idr: number
  base_unit: string
  minimum_stock: number
  image_url?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Category = {
  id: string
  tenant_id?: string
  name: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateProductInput = {
  category_id?: string | null
  sku: string
  name: string
  purchase_price_idr: number
  selling_price_idr: number
  base_unit: string
  minimum_stock?: number
  image_url?: string | null
}

export type UpdateProductInput = {
  category_id?: string | null
  sku: string
  name: string
  purchase_price_idr: number
  selling_price_idr: number
  base_unit: string
  minimum_stock?: number
  image_url?: string | null
  is_active?: boolean
}

export class ProductsApiError extends Error {
  readonly code: string
  readonly requestId?: string
  readonly details?: Record<string, string>

  constructor(code: string, message: string, requestId?: string, details?: Record<string, string>) {
    super(message)
    this.name = 'ProductsApiError'
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

export async function getProducts(signal?: AbortSignal): Promise<Product[]> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/v1/products`, {
      method: 'GET',
      headers: { Accept: 'application/json', ...getTenantHeaders() },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ProductsApiError('NETWORK_ERROR', 'Koneksi ke server gagal. Periksa jaringan API.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ProductsApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new ProductsApiError(failure.code, failure.message, failure.requestId, failure.details)
  }

  const success = payload as { data?: Product[] }
  return Array.isArray(success.data) ? success.data : []
}

export async function getCategories(signal?: AbortSignal): Promise<Category[]> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/v1/categories`, {
      method: 'GET',
      headers: { Accept: 'application/json', ...getTenantHeaders() },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ProductsApiError('NETWORK_ERROR', 'Koneksi ke server gagal. Periksa jaringan API.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ProductsApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new ProductsApiError(failure.code, failure.message, failure.requestId, failure.details)
  }

  const success = payload as { data?: Category[] }
  return Array.isArray(success.data) ? success.data : []
}

export async function createCategory(name: string, signal?: AbortSignal): Promise<Category> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/v1/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getTenantHeaders(),
      },
      body: JSON.stringify({ name }),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ProductsApiError('NETWORK_ERROR', 'Koneksi ke server gagal saat membuat kategori.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ProductsApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new ProductsApiError(failure.code, failure.message, failure.requestId, failure.details)
  }

  const success = payload as { data?: Category }
  if (!success.data) {
    throw new ProductsApiError('INVALID_RESPONSE', 'Server tidak mengembalikan data kategori baru.')
  }
  return success.data
}

export async function createProduct(input: CreateProductInput, signal?: AbortSignal): Promise<Product> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/v1/products`, {
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
    throw new ProductsApiError('NETWORK_ERROR', 'Koneksi ke server gagal. Periksa jaringan API.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ProductsApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new ProductsApiError(failure.code, failure.message, failure.requestId, failure.details)
  }

  const success = payload as { data?: Product }
  if (!success.data) {
    throw new ProductsApiError('INVALID_RESPONSE', 'Server tidak mengembalikan data produk baru.')
  }
  return success.data
}

export async function uploadProductImage(
  file: File,
  signal?: AbortSignal,
): Promise<{ url: string; filename: string; size: number }> {
  const formData = new FormData()
  formData.append('file', file)

  let response: Response
  try {
    response = await fetch(`${apiBase}/api/v1/uploads`, {
      method: 'POST',
      headers: { ...getTenantHeaders() },
      body: formData,
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ProductsApiError('NETWORK_ERROR', 'Koneksi ke server gagal saat mengunggah gambar.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ProductsApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new ProductsApiError(failure.code, failure.message, failure.requestId, failure.details)
  }

  const success = payload as { data?: { url: string; filename: string; size: number } }
  if (!success.data) {
    throw new ProductsApiError('INVALID_RESPONSE', 'Server tidak mengembalikan data berkas yang diunggah.')
  }
  return success.data
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  signal?: AbortSignal,
): Promise<Product> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/v1/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
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
    throw new ProductsApiError('NETWORK_ERROR', 'Koneksi ke server gagal saat memperbarui produk.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ProductsApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new ProductsApiError(failure.code, failure.message, failure.requestId, failure.details)
  }

  const success = payload as { data?: Product }
  if (!success.data) {
    throw new ProductsApiError('INVALID_RESPONSE', 'Server tidak mengembalikan data produk yang diperbarui.')
  }
  return success.data
}

export async function deleteProduct(id: string, signal?: AbortSignal): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/v1/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        ...getTenantHeaders(),
      },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ProductsApiError('NETWORK_ERROR', 'Koneksi ke server gagal saat menghapus produk.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ProductsApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new ProductsApiError(failure.code, failure.message, failure.requestId, failure.details)
  }
}

