import { chromium } from 'playwright-core'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const SCREENSHOT_NAVBAR = 'C:\\Users\\muhri\\.gemini\\antigravity-ide\\brain\\250f212e-5249-45fc-a1c7-6ac438a1ab86\\navbar_enhanced_logo.png'

async function captureNavbar() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://localhost:5173/landing', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  const header = page.locator('header')
  await header.screenshot({ path: SCREENSHOT_NAVBAR })
  console.log(`Navbar screenshot saved to ${SCREENSHOT_NAVBAR}`)

  await browser.close()
}

captureNavbar().catch(console.error)
