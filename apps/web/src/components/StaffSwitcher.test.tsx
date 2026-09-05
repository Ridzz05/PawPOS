import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StaffSwitcher, setActiveStaff, DEFAULT_STAFF } from './StaffSwitcher'

describe('StaffSwitcher', () => {
  beforeEach(() => {
    localStorage.clear()
    setActiveStaff(DEFAULT_STAFF)
    vi.restoreAllMocks()
  })

  it('renders default staff name and OWNER badge', () => {
    render(<StaffSwitcher />)
    expect(screen.getByRole('button', { name: /pilih operator staf kasir/i })).toBeInTheDocument()
    expect(screen.getByText('Pemilik Toko')).toBeInTheDocument()
    expect(screen.getByText('OWNER')).toBeInTheDocument()
  })

  it('opens modal and allows switching to Kasir mode', async () => {
    const user = userEvent.setup()
    render(<StaffSwitcher />)

    const btn = screen.getByRole('button', { name: /pilih operator staf kasir/i })
    await user.click(btn)

    expect(screen.getByText('Ganti Operator & Peran Staf')).toBeInTheDocument()

    // Click quick preset 'Kasir Mode'
    const kasirPresetBtn = screen.getByRole('button', { name: /kasir mode/i })
    await user.click(kasirPresetBtn)

    // Save operator
    const saveBtn = screen.getByRole('button', { name: /simpan operator/i })
    await user.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('Kasir Siti')).toBeInTheDocument()
      expect(screen.getByText('KASIR')).toBeInTheDocument()
    })
  })

  it('allows switching to Manager mode and Gudang mode', async () => {
    const user = userEvent.setup()
    render(<StaffSwitcher />)

    const btn = screen.getByRole('button', { name: /pilih operator staf kasir/i })
    await user.click(btn)

    // Click Manager mode
    await user.click(screen.getByRole('button', { name: /manager mode/i }))
    await user.click(screen.getByRole('button', { name: /simpan operator/i }))

    await waitFor(() => {
      expect(screen.getByText('Manajer Hendra')).toBeInTheDocument()
      expect(screen.getByText('MANAGER')).toBeInTheDocument()
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // Open again and switch to Gudang mode
    await user.click(screen.getByRole('button', { name: /pilih operator staf kasir/i }))
    await user.click(screen.getByRole('button', { name: /gudang mode/i }))
    await user.click(screen.getByRole('button', { name: /simpan operator/i }))

    await waitFor(() => {
      expect(screen.getByText('Budi Gudang')).toBeInTheDocument()
      expect(screen.getByText('GUDANG')).toBeInTheDocument()
    })
  })
})
