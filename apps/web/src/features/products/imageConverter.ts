export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export interface ConversionResult {
  file: File
  originalSize: number
  convertedSize: number
  didConvert: boolean
  previewUrl: string
}

/**
 * Converts any image (especially large formats like PNG or JPEG) into a lightweight WebP image.
 * Uses the browser's native HTMLCanvasElement for hardware-accelerated, zero-dependency conversion.
 */
export async function convertImageToWebp(
  file: File,
  quality = 0.85,
): Promise<ConversionResult> {
  const originalSize = file.size
  const isAlreadyWebp = file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp')

  const safeCreateObjectURL = (target: Blob | MediaSource) =>
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(target)
      : ''

  if (isAlreadyWebp) {
    return {
      file,
      originalSize,
      convertedSize: originalSize,
      didConvert: false,
      previewUrl: safeCreateObjectURL(file),
    }
  }

  return new Promise((resolve) => {
    // If not in a browser environment or canvas is unavailable (e.g. SSR/headless)
    if (
      typeof document === 'undefined' ||
      typeof HTMLCanvasElement === 'undefined' ||
      typeof Image === 'undefined' ||
      typeof URL === 'undefined' ||
      typeof URL.createObjectURL !== 'function'
    ) {
      return resolve({
        file,
        originalSize,
        convertedSize: originalSize,
        didConvert: false,
        previewUrl: '',
      })
    }

    const objectUrl = safeCreateObjectURL(file)
    const img = new Image()

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || 800
        canvas.height = img.naturalHeight || 800

        const ctx = canvas.getContext('2d')
        if (!ctx || typeof canvas.toBlob !== 'function') {
          return resolve({
            file,
            originalSize,
            convertedSize: originalSize,
            didConvert: false,
            previewUrl: objectUrl,
          })
        }

        ctx.drawImage(img, 0, 0)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve({
                file,
                originalSize,
                convertedSize: originalSize,
                didConvert: false,
                previewUrl: objectUrl,
              })
            }

            const baseName = file.name.replace(/\.[^/.]+$/, '')
            const convertedFile = new File([blob], `${baseName}.webp`, {
              type: 'image/webp',
              lastModified: Date.now(),
            })

            resolve({
              file: convertedFile,
              originalSize,
              convertedSize: blob.size,
              didConvert: true,
              previewUrl: safeCreateObjectURL(blob),
            })
          },
          'image/webp',
          quality,
        )
      } catch {
        resolve({
          file,
          originalSize,
          convertedSize: originalSize,
          didConvert: false,
          previewUrl: objectUrl,
        })
      }
    }

    img.onerror = () => {
      resolve({
        file,
        originalSize,
        convertedSize: originalSize,
        didConvert: false,
        previewUrl: objectUrl,
      })
    }

    img.src = objectUrl
  })
}
