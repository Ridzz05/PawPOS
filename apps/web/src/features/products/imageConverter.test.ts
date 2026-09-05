import { describe, expect, it, vi } from 'vitest'
import { convertImageToWebp, formatFileSize } from './imageConverter'

describe('imageConverter', () => {
  it('formats file sizes accurately', () => {
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(1048576)).toBe('1.00 MB')
    expect(formatFileSize(2621440)).toBe('2.50 MB')
  })

  it('keeps webp file as is without re-converting', async () => {
    const webpFile = new File(['fake-webp-content'], 'product.webp', { type: 'image/webp' })
    const result = await convertImageToWebp(webpFile)

    expect(result.file.name).toBe('product.webp')
    expect(result.didConvert).toBe(false)
  })

  it('handles fallback gracefully when canvas is unavailable or errors', async () => {
    const pngFile = new File(['fake-png-content'], 'heavy-photo.png', { type: 'image/png' })
    const result = await convertImageToWebp(pngFile)

    expect(result.file).toBeDefined()
  })
})
