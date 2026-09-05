import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog, DialogContent, Typography } from '@mui/material'
import {
  ModalSlideTransition,
  MODAL_EASING,
  MODAL_ENTER_DURATION,
  MODAL_EXIT_DURATION,
} from './ModalSlideTransition'

describe('ModalSlideTransition', () => {
  it('exports professional timing constants', () => {
    expect(MODAL_EASING).toBe('cubic-bezier(0.16, 1, 0.3, 1)')
    expect(MODAL_ENTER_DURATION).toBe(300)
    expect(MODAL_EXIT_DURATION).toBe(220)
  })

  it('renders children within a dialog and supports opening/closing lifecycles', async () => {
    const { rerender } = render(
      <Dialog
        open={true}
        TransitionComponent={ModalSlideTransition}
        aria-label="Test Dialog"
      >
        <DialogContent>
          <Typography>Konten Modal Uji</Typography>
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByText('Konten Modal Uji')).toBeInTheDocument()

    // Trigger closing
    rerender(
      <Dialog
        open={false}
        TransitionComponent={ModalSlideTransition}
        aria-label="Test Dialog"
      >
        <DialogContent>
          <Typography>Konten Modal Uji</Typography>
        </DialogContent>
      </Dialog>,
    )

    // Ensure dialog gracefully unmounts after exit transition completes
    await waitFor(() => {
      expect(screen.queryByText('Konten Modal Uji')).not.toBeInTheDocument()
    })
  })

  it('honors reduced motion preferences', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <Dialog
        open={true}
        TransitionComponent={ModalSlideTransition}
        aria-label="Reduced Motion Dialog"
      >
        <DialogContent>
          <Typography>Reduced Motion Test</Typography>
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByText('Reduced Motion Test')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
