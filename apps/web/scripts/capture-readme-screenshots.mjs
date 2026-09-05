import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUTPUT_DIR = 'docs/screenshots'

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

async function capture() {
  console.log('Launching Playwright Chrome for README visual capture...')
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // High-DPI retina capture for crisp README images
  })

  const page = await context.newPage()

  const pagesToCapture = [
    { name: '01_landing_hero.png', url: 'http://localhost:5173/landing', clip: { x: 0, y: 0, width: 1440, height: 920 } },
    { name: '03_dashboard.png', url: 'http://localhost:5173/dashboard' },
    { name: '04_cashier_shifts.png', url: 'http://localhost:5173/shifts' },
    { name: '05_inventory_stocks.png', url: 'http://localhost:5173/inventory/stocks' },
    { name: '06_products_catalog.png', url: 'http://localhost:5173/products' },
  ]

  for (const item of pagesToCapture) {
    console.log(`Capturing ${item.name} from ${item.url}...`)
    await page.goto(item.url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    const savePath = path.join(OUTPUT_DIR, item.name)
    if (item.clip) {
      await page.screenshot({ path: savePath, clip: item.clip })
    } else {
      await page.screenshot({ path: savePath, fullPage: false })
    }
    console.log(`Saved: ${savePath}`)
  }

  // Capture POS Terminal with active cart
  console.log('Capturing 02_pos_terminal.png with active cart...')
  await page.goto('http://localhost:5173/pos', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // Try clicking the first product card to add to cart
  const productCards = await page.$$('[role="button"], .MuiCard-root, [class*="product"]')
  for (const card of productCards) {
    const text = await card.innerText().catch(() => '')
    if (text.includes('Royal Canin') || text.includes('Whiskas') || text.includes('Rp')) {
      await card.click().catch(() => {})
      await page.waitForTimeout(500)
      break
    }
  }
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(OUTPUT_DIR, '02_pos_terminal.png'), fullPage: false })
  console.log('Saved: docs/screenshots/02_pos_terminal.png')

  // Also capture a sleek mobile screenshot (iPhone 14)
  console.log('Capturing mobile preview (390x844)...')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173/pos', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(OUTPUT_DIR, '07_pos_mobile.png'), fullPage: false })
  console.log('Saved: docs/screenshots/07_pos_mobile.png')

  // Capture landing page mobile preview as well
  await page.goto('http://localhost:5173/landing', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(OUTPUT_DIR, '08_landing_mobile.png'), clip: { x: 0, y: 0, width: 390, height: 844 } })
  console.log('Saved: docs/screenshots/08_landing_mobile.png')

  console.log('README screenshots capture completed successfully!')
  await browser.close()
}

capture().catch(err => {
  console.error('Error during README screenshot capture:', err)
  process.exit(1)
})
