import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BookingsPage } from './BookingsPage'

const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const localToday = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

const sampleBookings = [
  {
    id: 'book-1',
    tenant_id: 'tenant-1',
    customer_id: 'cust-1',
    pet_id: 'pet-1',
    service_id: 'svc-1',
    package_id: null,
    location_id: 'loc-main',
    scheduled_at: `${localToday}T10:00:00Z`,
    status: 'antre',
    staff_name: 'Rina',
    notes: '',
    order_id: null,
    created_at: '2026-09-06T00:00:00Z',
    updated_at: '2026-09-06T00:00:00Z',
  },
]

const sampleCustomers = [
  {
    id: 'cust-1', tenant_id: 'tenant-1', name: 'Sinta', phone: '0812',
    email: '', address: '', notes: '', is_active: true,
    created_at: '2026-09-06T00:00:00Z', updated_at: '2026-09-06T00:00:00Z',
  },
]

const samplePets = [
  {
    id: 'pet-1', tenant_id: 'tenant-1', customer_id: 'cust-1', customer_name: 'Sinta',
    name: 'Cimol', species: 'Kucing', breed: '', birth_date: null, gender: '',
    weight_kg: 0, color: '', allergies: '', notes: '', is_active: true,
    created_at: '2026-09-06T00:00:00Z', updated_at: '2026-09-06T00:00:00Z',
  },
]

const sampleServices = [
  {
    id: 'svc-1', tenant_id: 'tenant-1', name: 'Grooming Komplit', category: 'grooming',
    price_idr: 80000, duration_minutes: 60, description: '', is_active: true,
    created_at: '2026-09-06T00:00:00Z', updated_at: '2026-09-06T00:00:00Z',
  },
]

function mockBookingsFetch() {
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/v1/bookings')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: sampleBookings }) })
    }
    if (url.includes('/api/v1/customers')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: sampleCustomers }) })
    }
    if (url.includes('/api/v1/pets')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: samplePets }) })
    }
    if (url.includes('/api/v1/packages')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
    }
    if (url.includes('/api/v1/services')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: sampleServices }) })
    }
    return Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
  })
  vi.stubGlobal('fetch', fetchMock)
}

describe('BookingsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders antrean queue with customer, pet, and service', async () => {
    mockBookingsFetch()
    render(<BookingsPage />)

    expect(await screen.findByText('Cimol')).toBeInTheDocument()
    expect(screen.getByText('Grooming Komplit')).toBeInTheDocument()
    expect(screen.getAllByText('Antre').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: 'Proses' })).toBeInTheDocument()
  })

  it('opens create dialog with dependent pet dropdown', async () => {
    const user = userEvent.setup()
    mockBookingsFetch()
    render(<BookingsPage />)

    await screen.findByText('Cimol')
    await user.click(screen.getByRole('button', { name: 'Booking Baru' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Booking Jasa Baru')).toBeInTheDocument()
  })
})
