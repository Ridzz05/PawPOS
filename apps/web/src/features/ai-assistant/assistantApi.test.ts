import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendAssistantChat, synthesizeSpeech } from './assistantApi'

describe('assistantApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends assistant chat request and returns reply', async () => {
    const mockResponse = {
      data: {
        reply: 'Stok pakan kitten tersedia.',
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
      },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    )

    const result = await sendAssistantChat('Cek stok kitten')
    expect(result.reply).toBe('Stok pakan kitten tersedia.')
    expect(result.model).toBe('openai/gpt-oss-120b')
  })

  it('synthesizes speech and returns audio blob', async () => {
    const mockBlob = new Blob(['mock-audio-data'], { type: 'audio/mpeg' })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      }),
    )

    const blob = await synthesizeSpeech('Halo kasir PawPOS', 'test-voice')
    expect(blob).toBeDefined()
    expect(blob.type).toBe('audio/mpeg')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/assistant/tts'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Halo kasir PawPOS',
          voice_id: 'test-voice',
        }),
      }),
    )
  })

  it('throws error when synthesizeSpeech receives failure status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: 'TTS quota exceeded' } }),
      }),
    )

    await expect(synthesizeSpeech('Halo')).rejects.toThrow('TTS quota exceeded')
  })
})
