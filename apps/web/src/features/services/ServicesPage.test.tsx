import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ServicesPage } from './ServicesPage'

const sampleServices = [
  {
    id: 'svc-1',
    tenant_id: 'tenant-1',
    name: 'Grooming Komplit Kucing',
    category: 'grooming',
    price_idr: 80000,
    duration_minutes: 60,
    description: '',
    is_active: true,
    created_at: '2026-09-04T00:00:00Z',
    updated_at: '2026-09-04T00:00:00Z',
  },
]

const samplePackages = [
  {
    id: 'pkg-1',
    tenant_id: 'tenant-1',
    name: 'Paket Grooming 3x',
    price_idr: 210000,
    description: '',
    items: [{ service_id: 'svc-1', service_name: 'Grooming Komplit Kucing', sessions_included: 3 }],
    is_active: true,
    created_at: '2026-09-04T00:00:00Z',
    updated_at: '2026-09-04T00:00:00Z',
  },
]

function mockDirectoryFetch() {
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/v1/packages')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: samplePackages }) })
    }
    return Promise.resolve({ ok: true, json: async () => ({ data: sampleServices }) })
  })
  vi.stubGlobal('fetch', fetchMock)
}

describe('ServicesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders service catalog with tariff and duration', async () => {
    mockDirectoryFetch()
    render(<ServicesPage />)

    expect(await screen.findByText('Grooming Komplit Kucing')).toBeInTheDocument()
    expect(screen.getByText('Grooming')).toBeInTheDocument()
    expect(screen.getByText('1 jam')).toBeInTheDocument()
  })

  it('switches to packages tab and shows bundle contents', async () => {
    const user = userEvent.setup()
    mockDirectoryFetch()
    render(<ServicesPage />)

    await screen.findByText('Grooming Komplit Kucing')
    await user.click(screen.getByRole('tab', { name: /Paket/ }))
    expect(await screen.findByText('Paket Grooming 3x')).toBeInTheDocument()
    expect(screen.getByText(/Grooming Komplit Kucing \(3x\)/)).toBeInTheDocument()
  })

  it('validates service dialog requires a name', async () => {
    const user = userEvent.setup()
    mockDirectoryFetch()
    render(<ServicesPage />)

    await screen.findByText('Grooming Komplit Kucing')
    await user.click(screen.getByRole('button', { name: 'Tambah Layanan' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Simpan Layanan' }))
    expect(await screen.findByText('Nama layanan wajib diisi.')).toBeInTheDocument()
  })
})
