import { getActiveTenant } from '../tenant/tenantApi'

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
}

export interface AssistantChatResponse {
  reply: string
  provider: string
  model: string
  context?: {
    tenant_name?: string
    products_count?: number
    low_stock_count?: number
    shift_active?: boolean
  }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080'

export async function sendAssistantChat(
  message: string,
  history: ChatMessage[] = [],
): Promise<AssistantChatResponse> {
  const tenantId = getActiveTenant().id
  const cleanHistory = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content }))

  const response = await fetch(`${apiBase}/api/v1/assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId,
    },
    body: JSON.stringify({
      message,
      history: cleanHistory,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const message = errorBody?.error?.message ?? 'Gagal memproses pesan ke asisten AI.'
    throw new Error(message)
  }

  const payload = await response.json()
  return payload.data as AssistantChatResponse
}

export async function synthesizeSpeech(text: string, voiceId?: string): Promise<Blob> {
  const response = await fetch(`${apiBase}/api/v1/assistant/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const message = errorBody?.error?.message ?? 'Gagal menghasilkan audio suara AI.'
    throw new Error(message)
  }

  return await response.blob()
}

