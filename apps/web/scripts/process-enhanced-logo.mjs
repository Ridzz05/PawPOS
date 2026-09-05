import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const INPUT_IMAGE = 'C:\\Users\\muhri\\.gemini\\antigravity-ide\\brain\\250f212e-5249-45fc-a1c7-6ac438a1ab86\\pawpos_logo_enhanced_1788565537383.jpg'
const OUTPUT_PNG = 'C:\\Users\\muhri\\Documents\\ai-operational-pos\\apps\\web\\public\\branding\\pawpos_logo_enhanced.png'
const OUTPUT_BRANDING = 'C:\\Users\\muhri\\Documents\\ai-operational-pos\\apps\\web\\public\\branding\\branding.png'

async function processLogo() {
  console.log('Processing enhanced logo...')
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()
  
  // Read input image as base64
  const imgBuffer = fs.readFileSync(INPUT_IMAGE)
  const base64Data = imgBuffer.toString('base64')
  const dataUrl = `data:image/jpeg;base64,${base64Data}`

  const processedBase64 = await page.evaluate(async (src) => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        // Step 1: Draw on initial canvas to inspect pixels
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imgData.data

        // Step 2: Find tight bounding box of non-white pixels (threshold > 245)
        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4
            const r = data[idx]
            const g = data[idx + 1]
            const b = data[idx + 2]
            // If pixel is not white / background
            if (r < 240 || g < 240 || b < 240) {
              if (x < minX) minX = x
              if (x > maxX) maxX = x
              if (y < minY) minY = y
              if (y > maxY) maxY = y
            }
          }
        }

        // Add small padding around the logo
        const pad = 24
        minX = Math.max(0, minX - pad)
        minY = Math.max(0, minY - pad)
        maxX = Math.min(canvas.width, maxX + pad)
        maxY = Math.min(canvas.height, maxY + pad)

        const cropW = maxX - minX
        const cropH = maxY - minY

        // Step 3: Create cropped canvas with transparent background
        const cropCanvas = document.createElement('canvas')
        cropCanvas.width = cropW
        cropCanvas.height = cropH
        const cropCtx = cropCanvas.getContext('2d')

        // Draw cropped area
        cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH)

        // Make pure white pixels transparent with smooth anti-aliased feathering
        const cropData = cropCtx.getImageData(0, 0, cropW, cropH)
        const cData = cropData.data

        for (let i = 0; i < cData.length; i += 4) {
          const r = cData[i]
          const g = cData[i + 1]
          const b = cData[i + 2]

          // Compute distance from pure white (255, 255, 255)
          const brightness = (r + g + b) / 3
          if (r > 248 && g > 248 && b > 248) {
            cData[i + 3] = 0 // Fully transparent
          } else if (r > 230 && g > 230 && b > 230) {
            // Anti-aliasing transition
            const alphaFactor = (255 - brightness) / 25
            cData[i + 3] = Math.round(Math.min(255, Math.max(0, alphaFactor * 255)))
          }
        }

        cropCtx.putImageData(cropData, 0, 0)
        resolve(cropCanvas.toDataURL('image/png'))
      }
      img.src = src
    })
  }, dataUrl)

  await browser.close()

  // Save to disk
  const base64Image = processedBase64.replace(/^data:image\/png;base64,/, '')
  const buffer = Buffer.from(base64Image, 'base64')

  fs.writeFileSync(OUTPUT_PNG, buffer)
  fs.writeFileSync(OUTPUT_BRANDING, buffer)
  console.log(`Successfully saved enhanced transparent logo to ${OUTPUT_PNG} and ${OUTPUT_BRANDING}`)
}

processLogo().catch(err => {
  console.error(err)
  process.exit(1)
})
