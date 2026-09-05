import { chromium } from 'playwright-core'
import path from 'path'

const ARTIFACTS_DIR = 'C:\\Users\\muhri\\.gemini\\antigravity-ide\\brain\\250f212e-5249-45fc-a1c7-6ac438a1ab86'

async function runVerification() {
  console.log('Verifying UI fixes with Playwright...')
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  })

  // 1. Mobile View (375x812) - Check Navbar (no SaaS label), AI Voice section, Bottom CTA, Products Table SKU
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
  })
  const mobilePage = await mobileContext.newPage()

  // Go to Landing Page
  await mobilePage.goto('http://localhost:5173/landing', { waitUntil: 'networkidle' })
  await mobilePage.waitForTimeout(600)

  // Verify Navbar
  await mobilePage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'fix_landing_navbar_mobile.png'),
    clip: { x: 0, y: 0, width: 375, height: 100 },
  })

  // Scroll to AI Voice Simulator container
  const voiceHeading = mobilePage.locator('text=Uji Coba Suara AI Asisten PawPOS Sekarang').first()
  await voiceHeading.scrollIntoViewIfNeeded()
  await mobilePage.waitForTimeout(400)
  const voiceSection = mobilePage.locator('text=Uji Coba Suara AI Asisten PawPOS Sekarang').locator('..').locator('..')
  await voiceSection.screenshot({
    path: path.join(ARTIFACTS_DIR, 'fix_landing_voice_simulator_mobile.png'),
  })

  // Scroll to Bottom CTA
  const bottomCta = mobilePage.locator('#bottom-cta-pos')
  await bottomCta.scrollIntoViewIfNeeded()
  await mobilePage.waitForTimeout(400)
  const bottomSection = mobilePage.locator('text=Siap Modernisasi Toko Hewan Anda Hari Ini?').locator('..')
  await bottomSection.screenshot({
    path: path.join(ARTIFACTS_DIR, 'fix_landing_bottom_cta_mobile.png'),
  })

  // Go to Products Page on mobile
  await mobilePage.goto('http://localhost:5173/products', { waitUntil: 'networkidle' })
  await mobilePage.waitForTimeout(1000)

  // Scroll to Table Card
  const tableCard = mobilePage.locator('.terminal-card').last()
  await tableCard.scrollIntoViewIfNeeded()
  await mobilePage.waitForTimeout(400)
  await tableCard.screenshot({
    path: path.join(ARTIFACTS_DIR, 'fix_products_table_mobile.png'),
  })

  // 2. Desktop View (1440x900) - Check Navbar & Bottom CTA
  const deskContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  const deskPage = await deskContext.newPage()
  await deskPage.goto('http://localhost:5173/landing', { waitUntil: 'networkidle' })
  await deskPage.waitForTimeout(600)

  await deskPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'fix_landing_navbar_desktop.png'),
    clip: { x: 0, y: 0, width: 1440, height: 100 },
  })

  await browser.close()
  console.log('UI Fixes verification complete! Screenshots saved.')
}

runVerification().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
