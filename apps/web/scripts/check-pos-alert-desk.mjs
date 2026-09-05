import { chromium } from 'playwright-core'
import path from 'path'

const ARTIFACTS_DIR = 'C:\\Users\\muhri\\.gemini\\antigravity-ide\\brain\\250f212e-5249-45fc-a1c7-6ac438a1ab86'

async function checkPosAlertDesk() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  await page.goto('http://localhost:5173/pos', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'fix_pos_buka_shift_button_desktop.png'),
    clip: { x: 260, y: 70, width: 1100, height: 250 },
  })

  await browser.close()
  console.log('Desktop POS alert screenshot captured!')
}

checkPosAlertDesk().catch((err) => {
  console.error(err)
  process.exit(1)
})
