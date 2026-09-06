import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomersPage } from './CustomersPage'

const sampleCustomers = [
  {
    id: 'cust-1',
    tenant_id: 'tenant-1',
    name: 'Andi Wijaya',
    phone: '08123456789',
    email: 'andi@example.id',
    address: 'Jl. Mawar 1',
    notes: '',
    is_active: true,
    created_at: '2026-09-04T00:00:00Z',
    updated_at: '2026-09-04T00:00:00Z',
  },
]

const samplePets = [
  {
    id: 'pet-1',
    tenant_id: 'tenant-1',
    customer_id: 'cust-1',
    customer_name: 'Andi Wijaya',
    name: 'Mochi',
    species: 'Kucing',
    breed: 'Persia',
    birth_date: null,
    gender: 'betina',
    weight_kg: 4.5,
    color: 'Oren',
    allergies: 'Ikan',
    notes: '',
    is_active: true,
    created_at: '2026-09-04T00:00:00Z',
    updated_at: '2026-09-04T00:00:00Z',
  },
]

function mockDirectoryFetch() {
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/v1/pets')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: samplePets }) })
    }
    return Promise.resolve({ ok: true, json: async () => ({ data: sampleCustomers }) })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('CustomersPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders customer directory with contact and pet count', async () => {
    mockDirectoryFetch()
    render(<CustomersPage />)

    expect(await screen.findByText('Andi Wijaya')).toBeInTheDocument()
    expect(screen.getByText('08123456789')).toBeInTheDocument()
    expect(screen.getByText('1 ekor')).toBeInTheDocument()
  })

  it('switches to pets tab and shows owner and allergy info', async () => {
    const user = userEvent.setup()
    mockDirectoryFetch()
    render(<CustomersPage initialTab="pets" />)

    expect(await screen.findByText('Mochi')).toBeInTheDocument()
    expect(screen.getByText('Kucing · Persia')).toBeInTheDocument()
    expect(screen.getByText('Ikan')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Pelanggan/ }))
    expect(await screen.findByText('08123456789')).toBeInTheDocument()
  })

  it('opens create customer dialog with validation', async () => {
    const user = userEvent.setup()
    mockDirectoryFetch()
    render(<CustomersPage />)

    await screen.findByText('Andi Wijaya')
    await user.click(screen.getByRole('button', { name: 'Tambah Pelanggan' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Simpan Pelanggan' }))
    expect(await screen.findByText('Nama pelanggan wajib diisi.')).toBeInTheDocument()
  })
})
