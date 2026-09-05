import { chromium } from 'playwright-core'
import path from 'path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const SCREENSHOT_DESKTOP = 'C:\\Users\\muhri\\Documents\\ai-operational-pos\\apps\\web\\public\\branding\\landing_desktop_analysis.png'
const SCREENSHOT_MOBILE = 'C:\\Users\\muhri\\Documents\\ai-operational-pos\\apps\\web\\public\\branding\\landing_mobile_analysis.png'

async function analyze() {
  console.log('Launching Chrome via playwright-core...')
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })

  const page = await context.newPage()

  // Track console errors and network failures
  const consoleErrors = []
  const failedRequests = []

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  page.on('requestfailed', request => {
    failedRequests.push({ url: request.url(), failure: request.failure()?.errorText })
  })

  console.log('Navigating to http://localhost:5173/landing...')
  await page.goto('http://localhost:5173/landing', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // Extract page metadata, broken images, headings, and interactive elements
  const analysis = await page.evaluate(() => {
    const title = document.title
    const h1 = document.querySelector('h1')?.textContent?.trim()
    const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.textContent?.trim())
    const buttons = Array.from(document.querySelectorAll('button, a.MuiButton-root')).map(b => b.textContent?.trim()).filter(Boolean)

    // Check all images
    const images = Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src,
      alt: img.alt,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      isBroken: img.naturalWidth === 0,
      visible: img.offsetParent !== null,
    }))

    // Check horizontal overflow
    const docWidth = document.documentElement.scrollWidth
    const winWidth = window.innerWidth
    const hasHorizontalOverflow = docWidth > winWidth

    return {
      title,
      h1,
      h2s,
      buttonCount: buttons.length,
      imageCount: images.length,
      images,
      hasHorizontalOverflow,
      scrollWidth: docWidth,
      innerWidth: winWidth,
    }
  })

  console.log('--- LANDING PAGE AUDIT RESULT ---')
  console.log('Title:', analysis.title)
  console.log('H1:', analysis.h1)
  console.log('H2s:', analysis.h2s)
  console.log('Image Count:', analysis.imageCount)
  console.log('Broken Images:', analysis.images.filter(img => img.isBroken))
  console.log('Horizontal Overflow:', analysis.hasHorizontalOverflow, `(doc: ${analysis.scrollWidth}px vs win: ${analysis.innerWidth}px)`)
  console.log('Console Errors:', consoleErrors)
  console.log('Failed Requests:', failedRequests)

  // Take Desktop Screenshot
  await page.screenshot({ path: SCREENSHOT_DESKTOP, fullPage: true })
  console.log(`Desktop full-page screenshot saved to ${SCREENSHOT_DESKTOP}`)

  // Mobile Viewport Check (390x844 - iPhone 14)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(500)

  const mobileOverflow = await page.evaluate(() => {
    return {
      docWidth: document.documentElement.scrollWidth,
      winWidth: window.innerWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
  console.log('Mobile Viewport Overflow:', mobileOverflow)

  await page.screenshot({ path: SCREENSHOT_MOBILE, fullPage: true })
  console.log(`Mobile full-page screenshot saved to ${SCREENSHOT_MOBILE}`)

  await browser.close()
}

analyze().catch(err => {
  console.error('Playwright Error:', err)
  process.exit(1)
})
