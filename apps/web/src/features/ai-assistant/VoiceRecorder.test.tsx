import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VoiceRecorder } from './VoiceRecorder'

type Track = { stop: ReturnType<typeof vi.fn> }

let emitAudio = true
let getUserMedia: ReturnType<typeof vi.fn>
let tracks: Track[]
const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')

class FakeMediaRecorder {
  static isTypeSupported = vi.fn((mimeType: string) => mimeType === 'audio/webm;codecs=opus')
  state: RecordingState = 'inactive'
  mimeType = 'audio/webm;codecs=opus'
  ondataavailable: ((event: BlobEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onstop: (() => void) | null = null

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? this.mimeType
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    if (emitAudio) {
      this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) } as BlobEvent)
    }
    this.state = 'inactive'
    this.onstop?.()
  }
}

function installMediaMocks() {
  tracks = [{ stop: vi.fn() }]
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => tracks })
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
}

afterEach(() => {
  vi.unstubAllGlobals()
  if (originalMediaDevices) Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices)
  else Reflect.deleteProperty(navigator, 'mediaDevices')
  vi.restoreAllMocks()
})

describe('VoiceRecorder', () => {
  beforeEach(() => {
    emitAudio = true
    installMediaMocks()
  })

  it('requests permission, records, uploads multipart audio, and displays text', async () => {
    let resolveStream!: (value: unknown) => void
    getUserMedia.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStream = resolve
        }),
    )
    let resolveFetch!: (value: unknown) => void
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<VoiceRecorder />)

    await user.click(screen.getByRole('button', { name: 'Rekam suara' }))
    expect(screen.getByText('Meminta akses mikrofon')).toBeInTheDocument()
    resolveStream({ getTracks: () => tracks })
    expect(await screen.findByText('Sedang merekam')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Selesai dan kirim' }))
    expect(await screen.findByText('Mengunggah dan mentranskripsi')).toBeInTheDocument()
    resolveFetch({
      ok: true,
      json: async () => ({ data: { text: 'Tambahkan dua produk' }, request_id: 'request-1' }),
    })
    expect(await screen.findByText('Tambahkan dua produk')).toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/assistant/transcriptions',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    )
    const request = fetchMock.mock.calls[0][1] as RequestInit
    const body = request.body as FormData
    expect(body.get('file')).toBeInstanceOf(Blob)
    expect((body.get('file') as File).name).toBe('voice.webm')
  })

  it('shows actionable copy when microphone permission is denied', async () => {
    getUserMedia.mockRejectedValue(new DOMException('permission denied', 'NotAllowedError'))
    const user = userEvent.setup()
    render(<VoiceRecorder />)

    await user.click(screen.getByRole('button', { name: 'Rekam suara' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Akses mikrofon ditolak')
    expect(screen.getByRole('button', { name: 'Rekam lagi' })).toBeInTheDocument()
  })

  it('does not upload an empty recording', async () => {
    emitAudio = false
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<VoiceRecorder />)

    await user.click(screen.getByRole('button', { name: 'Rekam suara' }))
    await screen.findByText('Sedang merekam')
    await user.click(screen.getByRole('button', { name: 'Selesai dan kirim' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Rekaman kosong')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps a backend error envelope to actionable Indonesian copy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: 'TRANSCRIPTION_NOT_CONFIGURED', message: 'provider unavailable' } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<VoiceRecorder />)

    await user.click(screen.getByRole('button', { name: 'Rekam suara' }))
    await screen.findByText('Sedang merekam')
    await user.click(screen.getByRole('button', { name: 'Selesai dan kirim' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Server belum dikonfigurasi')
    expect(screen.getByText(/input manual/)).toBeInTheDocument()
  })

  it('maps network failures and releases tracks when cancelled', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<VoiceRecorder />)

    await user.click(screen.getByRole('button', { name: 'Rekam suara' }))
    await screen.findByText('Sedang merekam')
    await user.click(screen.getByRole('button', { name: 'Batalkan' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Perekaman dibatalkan')
    expect(tracks[0].stop).toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports unsupported MediaRecorder', async () => {
    vi.stubGlobal('MediaRecorder', undefined)
    const user = userEvent.setup()
    render(<VoiceRecorder />)

    await user.click(screen.getByRole('button', { name: 'Rekam suara' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('tidak mendukung perekaman suara'))
  })
})
