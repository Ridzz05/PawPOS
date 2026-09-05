import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { setActiveStaff, DEFAULT_STAFF, type StaffUser } from './components/StaffSwitcher'

function setTestAuthStaff(staff: StaffUser) {
  localStorage.setItem(
    'pawpos_auth_user',
    JSON.stringify({
      id: staff.id,
      email: `${staff.role}@pawpos.id`,
      name: staff.name,
      role: staff.role,
      roleTitle: staff.role,
      avatar: '👤',
    })
  )
  setActiveStaff(staff)
}

describe('app shell', () => {
  beforeEach(() => {
    localStorage.clear()
    setTestAuthStaff(DEFAULT_STAFF)
    vi.restoreAllMocks()
  })

  it('renders the dashboard without fabricated metrics and mounts voice assistant', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ request_id: 'test-request' }) }))
    render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>)
    expect(screen.getAllByText('POS').length).toBeGreaterThan(0)
    expect(screen.getByText('ENERGY 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rekam suara' })).toBeInTheDocument()
    expect(await screen.findByText('Belum ada ringkasan operasional')).toBeInTheDocument()
    expect(screen.queryByText('Omzet hari ini')).not.toBeInTheDocument()
  })

  it('renders products page with operational catalog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [], request_id: 'test-products' }) }))
    render(<MemoryRouter initialEntries={['/products']}><App /></MemoryRouter>)
    expect(screen.getByText('KATALOG OPERASIONAL')).toBeInTheDocument()
    expect(await screen.findByText('Katalog produk masih kosong')).toBeInTheDocument()
  })

  it('enforces RBAC and displays Access Denied when cashier visits restricted /settings page', async () => {
    setTestAuthStaff({
      id: 'staff-cashier-1',
      name: 'Kasir Siti',
      role: 'cashier',
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ request_id: 'test' }) }))

    render(<MemoryRouter initialEntries={['/settings']}><App /></MemoryRouter>)

    expect(screen.getByText('Akses Halaman Dibatasi')).toBeInTheDocument()
    expect(screen.getByText('Kasir Operasional')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Buka Halaman Kerja \(Kasir POS\)/i })).toBeInTheDocument()
  })

  it('enforces RBAC and displays Access Denied when warehouse staff visits restricted /pos page', async () => {
    setTestAuthStaff({
      id: 'staff-wh-1',
      name: 'Budi Gudang',
      role: 'warehouse',
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ request_id: 'test' }) }))

    render(<MemoryRouter initialEntries={['/pos']}><App /></MemoryRouter>)

    expect(screen.getByText('Akses Halaman Dibatasi')).toBeInTheDocument()
    expect(screen.getByText('Staf Gudang & Logistik')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Buka Halaman Kerja \(Stok Inventori\)/i })).toBeInTheDocument()
  })
})
