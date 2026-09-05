import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

function ProblemChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test crash explosion')
  }
  return <div>Konten Berjalan Normal</div>
}

function TestApp() {
  const [hasError, setHasError] = useState(false)
  return (
    <div>
      <button onClick={() => setHasError(true)}>Trigger Error</button>
      <ErrorBoundary onReset={() => setHasError(false)}>
        <ProblemChild shouldThrow={hasError} />
      </ErrorBoundary>
    </div>
  )
}

describe('ErrorBoundary', () => {
  it('renders children normally when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Normal Child Content</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Normal Child Content')).toBeInTheDocument()
  })

  it('catches render error and displays graceful fallback UI', () => {
    // Suppress expected console.error during error boundary test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Terjadi Kesalahan pada Aplikasi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Coba Lagi/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Muat Ulang Halaman/i })).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('allows toggling technical debug details', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()

    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>,
    )

    const toggleBtn = screen.getByRole('button', { name: /Lihat Rincian Teknis/i })
    await user.click(toggleBtn)

    expect(screen.getByText(/Test crash explosion/i)).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('resets error state when Coba Lagi is clicked', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()

    render(<TestApp />)

    expect(screen.getByText('Konten Berjalan Normal')).toBeInTheDocument()

    // Trigger error
    await user.click(screen.getByRole('button', { name: 'Trigger Error' }))
    expect(screen.getByText('Terjadi Kesalahan pada Aplikasi')).toBeInTheDocument()

    // Click Coba Lagi
    const retryBtn = screen.getByRole('button', { name: /Coba Lagi/i })
    await user.click(retryBtn)

    // Should be recovered
    expect(screen.getByText('Konten Berjalan Normal')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })
})
