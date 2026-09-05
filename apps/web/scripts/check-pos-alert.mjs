import { chromium } from 'playwright-core'
import path from 'path'

const ARTIFACTS_DIR = 'C:\\Users\\muhri\\.gemini\\antigravity-ide\\brain\\250f212e-5249-45fc-a1c7-6ac438a1ab86'

async function checkPosAlert() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  })

  // Test on mobile viewport (375x812)
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  // First, let's close the shift if open or visit shifts page
  await page.goto('http://localhost:5173/shifts', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // Now go to /pos
  await page.goto('http://localhost:5173/pos', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  // Take screenshot of the top section of POS
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'fix_pos_buka_shift_button_mobile.png'),
    clip: { x: 0, y: 50, width: 375, height: 350 },
  })

  await browser.close()
  console.log('POS Alert screenshot captured!')
}

checkPosAlert().catch((err) => {
  console.error(err)
  process.exit(1)
})
