import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { StoreSwitcher } from './StoreSwitcher'
import * as tenantApi from '../features/tenant/tenantApi'

describe('StoreSwitcher', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders active store name and plan chip', () => {
    render(<StoreSwitcher />)
    expect(screen.getByRole('button', { name: /pilih merchant toko/i })).toBeInTheDocument()
    expect(screen.getByText('Default Store')).toBeInTheDocument()
    expect(screen.getByText('STARTER')).toBeInTheDocument()
  })

  it('opens store list menu and allows switching active merchant', async () => {
    vi.spyOn(tenantApi, 'getTenants').mockResolvedValue([
      tenantApi.DEFAULT_TENANT,
      {
        id: 'tenant-2',
        name: 'Kopi Kenangan Senja',
        slug: 'kenangan-senja',
        plan_type: 'pro',
        is_active: true,
        created_at: '',
        updated_at: '',
      },
    ])

    render(<StoreSwitcher />)
    const button = screen.getByRole('button', { name: /pilih merchant toko/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Kopi Kenangan Senja')).toBeInTheDocument()
    })

    // Click to select the second tenant
    fireEvent.click(screen.getByText('Kopi Kenangan Senja'))

    // Button should now display the selected tenant
    await waitFor(() => {
      expect(screen.getByText('Kopi Kenangan Senja')).toBeInTheDocument()
      expect(screen.getByText('PRO')).toBeInTheDocument()
    })
  })

  it('opens registration modal and registers a new store', async () => {
    vi.spyOn(tenantApi, 'registerTenant').mockResolvedValue({
      id: 'tenant-new',
      name: 'Kedai Kopi Baru',
      slug: 'kedai-kopi-baru',
      plan_type: 'starter',
      is_active: true,
      created_at: '',
      updated_at: '',
    })

    render(<StoreSwitcher />)
    const button = screen.getByRole('button', { name: /pilih merchant toko/i })
    fireEvent.click(button)

    const registerItem = await screen.findByText(/\+ Daftarkan Toko Baru/i)
    fireEvent.click(registerItem)

    // Modal opens
    expect(screen.getByText('Daftarkan Toko / Merchant Baru')).toBeInTheDocument()

    // Fill form
    const nameInput = screen.getByLabelText(/Nama Toko \/ Bisnis/i)
    fireEvent.change(nameInput, { target: { value: 'Kedai Kopi Baru' } })

    const submitBtn = screen.getByRole('button', { name: /Daftarkan Toko$/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Kedai Kopi Baru')).toBeInTheDocument()
    })
  })
})
