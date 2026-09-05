import { chromium, devices } from 'playwright-core'
import path from 'path'

const ARTIFACTS_DIR = 'C:\\Users\\muhri\\.gemini\\antigravity-ide\\brain\\250f212e-5249-45fc-a1c7-6ac438a1ab86'

async function runMobileTest() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  })

  // Emulate iPhone 14 with safe area insets
  const iphone = devices['iPhone 14']
  const context = await browser.newContext({
    ...iphone,
  })
  const page = await context.newPage()

  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  // Take screenshot of mobile dashboard
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'fix_iphone_dashboard_safearea.png'),
    fullPage: false,
  })

  // Take screenshot of bottom navigation bar area specifically
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'fix_iphone_bottom_nav.png'),
    clip: { x: 0, y: 730, width: 390, height: 114 },
  })

  await browser.close()
  console.log('iPhone safe area screenshots captured successfully!')
}

runMobileTest().catch((err) => {
  console.error(err)
  process.exit(1)
})
