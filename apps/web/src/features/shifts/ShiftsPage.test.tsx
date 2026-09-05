import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShiftsPage } from './ShiftsPage'
import * as shiftsApi from './shiftsApi'

const sampleActiveShift: shiftsApi.Shift = {
  id: 'shift-001',
  tenant_id: 'tenant-test',
  cashier_name: 'Siti Rahma',
  status: 'open',
  starting_cash_idr: 100000,
  expected_cash_idr: 250000,
  actual_cash_idr: 0,
  cash_difference_idr: 0,
  total_cash_sales_idr: 150000,
  total_non_cash_sales_idr: 50000,
  transaction_count: 5,
  notes: 'Shift pagi laci 1',
  opened_at: '2026-09-04T08:00:00Z',
}

const sampleClosedShift: shiftsApi.Shift = {
  id: 'shift-000',
  tenant_id: 'tenant-test',
  cashier_name: 'Budi Santoso',
  status: 'closed',
  starting_cash_idr: 100000,
  expected_cash_idr: 200000,
  actual_cash_idr: 200000,
  cash_difference_idr: 0,
  total_cash_sales_idr: 100000,
  total_non_cash_sales_idr: 40000,
  transaction_count: 4,
  notes: 'Selesai tanpa selisih',
  opened_at: '2026-09-03T08:00:00Z',
  closed_at: '2026-09-03T16:00:00Z',
}

describe('ShiftsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders inactive shift banner when no shift is open', async () => {
    vi.spyOn(shiftsApi, 'getCurrentShift').mockResolvedValue(null)
    vi.spyOn(shiftsApi, 'getShifts').mockResolvedValue([])

    render(<ShiftsPage />)

    await waitFor(() => {
      expect(screen.getByText('Tidak Ada Shift Kasir yang Sedang Aktif')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /buka shift sekarang/i })).toBeInTheDocument()
  })

  it('opens Buka Shift dialog and allows submitting starting cash', async () => {
    vi.spyOn(shiftsApi, 'getCurrentShift').mockResolvedValue(null)
    vi.spyOn(shiftsApi, 'getShifts').mockResolvedValue([])
    const openShiftSpy = vi.spyOn(shiftsApi, 'openShift').mockResolvedValue(sampleActiveShift)

    const user = userEvent.setup()
    render(<ShiftsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /buka shift baru/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /buka shift baru/i }))

    expect(screen.getByText('Buka Shift Kasir Baru')).toBeInTheDocument()
    const nameInput = screen.getByLabelText(/nama kasir bertugas/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Kasir Budi')

    const submitBtn = screen.getByRole('button', { name: /mulai sesi shift/i })
    await user.click(submitBtn)

    expect(openShiftSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cashier_name: 'Kasir Budi',
      })
    )
  })

  it('renders active shift metrics when shift is ongoing', async () => {
    vi.spyOn(shiftsApi, 'getCurrentShift').mockResolvedValue(sampleActiveShift)
    vi.spyOn(shiftsApi, 'getShifts').mockResolvedValue([sampleClosedShift])

    render(<ShiftsPage />)

    await waitFor(() => {
      expect(screen.getByText(/SHIFT BERLANGSUNG/i)).toBeInTheDocument()
      expect(screen.getByText(/Kasir: Siti Rahma/i)).toBeInTheDocument()
    })

    // Check financial metrics
    expect(screen.getByText('MODAL AWAL KAS')).toBeInTheDocument()
    expect(screen.getByText('PENJUALAN TUNAI (CASH)')).toBeInTheDocument()
    expect(screen.getByText('ESTIMASI KAS DI LACI')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument() // 5 transactions
  })

  it('calculates physical cash denominations in Close Shift modal and checks Z-Report', async () => {
    vi.spyOn(shiftsApi, 'getCurrentShift').mockResolvedValue(sampleActiveShift)
    vi.spyOn(shiftsApi, 'getShifts').mockResolvedValue([sampleClosedShift])
    const closeShiftSpy = vi.spyOn(shiftsApi, 'closeShift').mockResolvedValue({
      ...sampleActiveShift,
      status: 'closed',
      actual_cash_idr: 250000,
      expected_cash_idr: 250000,
      cash_difference_idr: 0,
      closed_at: '2026-09-04T17:00:00Z',
    })

    const user = userEvent.setup()
    render(<ShiftsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /tutup shift & rekonsiliasi/i })).toBeInTheDocument()
    })

    // Open close shift modal
    await user.click(screen.getByRole('button', { name: /tutup shift & rekonsiliasi/i }))
    expect(screen.getByText('Tutup Shift & Rekonsiliasi Kas Fisik')).toBeInTheDocument()

    // Test denomination inputs: 2 notes of 100.000 + 1 note of 50.000 = 250.000
    const inputs = screen.getAllByPlaceholderText('0')
    // First input is Rp 100.000
    await user.type(inputs[0], '2')
    // Second input is Rp 50.000
    await user.type(inputs[1], '1')

    // Confirm that counted physical cash calculates to Rp 250.000
    await waitFor(() => {
      expect(screen.getByText('KAS COCOK & SEIMBANG')).toBeInTheDocument()
    })

    // Submit close shift
    const closeSubmitBtn = screen.getByRole('button', { name: /tutup shift & cetak z-report/i })
    await user.click(closeSubmitBtn)

    expect(closeShiftSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'shift-001',
        actual_cash_idr: 250000,
      })
    )

    // Z-Report should display
    await waitFor(() => {
      expect(screen.getByText(/LAPORAN Z-REPORT PENUTUPAN SHIFT/i)).toBeInTheDocument()
    })
  })
})
