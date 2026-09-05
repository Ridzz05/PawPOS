const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

type SuccessEnvelope = {
  data?: {
    text?: unknown
  }
}

export class TranscriptionApiError extends Error {
  readonly code: string
  readonly requestId?: string

  constructor(code: string, message: string, requestId?: string) {
    super(message)
    this.name = 'TranscriptionApiError'
    this.code = code
    this.requestId = requestId
  }
}

export type UploadTranscriptionOptions = {
  filename: string
  durationSeconds: number
  signal?: AbortSignal
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readErrorEnvelope(value: unknown): { code: string; message: string; requestId?: string } {
  if (!isRecord(value)) {
    return { code: 'HTTP_ERROR', message: 'Server menolak rekaman suara.' }
  }

  const error = isRecord(value.error) ? value.error : undefined
  return {
    code: typeof error?.code === 'string' ? error.code : 'HTTP_ERROR',
    message: typeof error?.message === 'string' ? error.message : 'Server menolak rekaman suara.',
    requestId: typeof value.request_id === 'string' ? value.request_id : undefined,
  }
}

export async function uploadTranscription(blob: Blob, options: UploadTranscriptionOptions): Promise<string> {
  if (blob.size === 0) {
    throw new TranscriptionApiError('AUDIO_REQUIRED', 'Rekaman tidak berisi suara.')
  }

  const formData = new FormData()
  formData.append('file', blob, options.filename)
  formData.append('duration_seconds', String(Math.max(0, options.durationSeconds)))

  let response: Response
  try {
    response = await fetch(`${apiBase}/api/v1/assistant/transcriptions`, {
      method: 'POST',
      body: formData,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new TranscriptionApiError('NETWORK_ERROR', 'Koneksi ke server gagal. Periksa jaringan lalu coba lagi.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new TranscriptionApiError('INVALID_RESPONSE', 'Server mengirim respons yang tidak dapat dibaca.')
  }

  if (!response.ok) {
    const failure = readErrorEnvelope(payload)
    throw new TranscriptionApiError(failure.code, failure.message, failure.requestId)
  }


  const success = payload as SuccessEnvelope
  const text = success.data?.text
  if (typeof text !== 'string' || text.trim() === '') {
    throw new TranscriptionApiError('INVALID_RESPONSE', 'Server tidak mengembalikan hasil transkripsi.')
  }
  return text.trim()
}
