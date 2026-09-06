import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PawLoading } from './PawLoading'

describe('PawLoading component', () => {
  it('renders default card variant with branding images and progress track', () => {
    render(<PawLoading label="Memuat katalog kasir..." />)

    expect(screen.getByTestId('paw-loading')).toBeInTheDocument()
    expect(screen.getByText('Memuat katalog kasir...')).toBeInTheDocument()

    // Verifies official light and dark mode images are rendered for theme awareness
    const images = screen.getAllByRole('img', { hidden: true })
    const lightImg = images.find((img) => img.getAttribute('src') === '/branding/branding.png')
    const darkImg = images.find((img) => img.getAttribute('src') === '/branding/branding-dark.png')

    expect(lightImg).toBeDefined()
    expect(darkImg).toBeDefined()
  })

  it('renders inline variant with compact paw badge and label', () => {
    render(<PawLoading variant="inline" label="Menyimpan..." size="small" />)

    expect(screen.getByTestId('paw-loading')).toBeInTheDocument()
    expect(screen.getByText('Menyimpan...')).toBeInTheDocument()

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/branding/branding.png')
  })

  it('renders fullscreen variant with 100dvh container', () => {
    render(<PawLoading variant="fullscreen" label="Memuat aplikasi kasir..." testId="fs-loader" />)

    const fsContainer = screen.getByTestId('fs-loader')
    expect(fsContainer).toBeInTheDocument()
    expect(fsContainer).toHaveClass('paw-loading-fullscreen')
    expect(screen.getByText('Memuat aplikasi kasir...')).toBeInTheDocument()
  })

  it('renders icon variant without full card border wrapper', () => {
    render(<PawLoading variant="icon" label="Sinkronisasi..." testId="icon-loader" />)

    const iconContainer = screen.getByTestId('icon-loader')
    expect(iconContainer).toBeInTheDocument()
    expect(iconContainer).toHaveClass('paw-loading-icon-variant')
    expect(screen.getByText('Sinkronisasi...')).toBeInTheDocument()
  })
})
