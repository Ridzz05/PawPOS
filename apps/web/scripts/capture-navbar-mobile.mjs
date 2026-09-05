import { chromium } from 'playwright-core'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const SCREENSHOT_NAVBAR_MOBILE = 'C:\\Users\\muhri\\.gemini\\antigravity-ide\\brain\\250f212e-5249-45fc-a1c7-6ac438a1ab86\\navbar_mobile_fixed.png'

async function captureMobileNavbar() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  // iPhone width 375px
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
  await page.goto('http://localhost:5173/landing', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // Verify header elements and horizontal overflow
  const metrics = await page.evaluate(() => {
    const header = document.querySelector('header')
    const headerRect = header.getBoundingClientRect()
    const docW = document.documentElement.scrollWidth
    const winW = window.innerWidth
    return {
      headerWidth: headerRect.width,
      docW,
      winW,
      hasOverflow: docW > winW,
    }
  })

  console.log('Mobile Navbar Metrics (375px):', metrics)

  const header = page.locator('header')
  await header.screenshot({ path: SCREENSHOT_NAVBAR_MOBILE })
  console.log(`Mobile navbar screenshot saved to ${SCREENSHOT_NAVBAR_MOBILE}`)

  await browser.close()
}

captureMobileNavbar().catch(console.error)
