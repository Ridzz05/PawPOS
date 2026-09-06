import { chromium } from 'playwright-core'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ARTIFACTS_DIR = 'C:\\Users\\muhri\\.gemini\\antigravity-ide\\brain\\250f212e-5249-45fc-a1c7-6ac438a1ab86'

async function captureLandingThemePreviews() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  // 1. Mobile Standalone (simulating user with dark mode set in main app)
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    })
    const page = await context.newPage()
    await page.addInitScript(() => {
      localStorage.setItem('pawpos_theme_mode', 'dark')
    })
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    await page.screenshot({
      path: `${ARTIFACTS_DIR}\\landing_standalone_mobile_hero.png`,
      fullPage: false,
    })
    console.log('Captured landing_standalone_mobile_hero.png')

    // Open mobile drawer
    const menuBtn = page.locator('button[aria-label="Menu Navigasi"]')
    if (await menuBtn.isVisible()) {
      await menuBtn.click()
      await page.waitForTimeout(600)
      await page.screenshot({
        path: `${ARTIFACTS_DIR}\\landing_standalone_mobile_drawer.png`,
        fullPage: false,
      })
      console.log('Captured landing_standalone_mobile_drawer.png')
    }
    await context.close()
  }

  // 2. Desktop Standalone (simulating user with dark mode set in main app)
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
    })
    const page = await context.newPage()
    await page.addInitScript(() => {
      localStorage.setItem('pawpos_theme_mode', 'dark')
    })
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    await page.screenshot({
      path: `${ARTIFACTS_DIR}\\landing_standalone_desktop_hero.png`,
      fullPage: false,
    })
    console.log('Captured landing_standalone_desktop_hero.png')

    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(600)
    await page.screenshot({
      path: `${ARTIFACTS_DIR}\\landing_standalone_desktop_footer.png`,
      fullPage: false,
    })
    console.log('Captured landing_standalone_desktop_footer.png')

    await context.close()
  }

  await browser.close()
  console.log('All standalone screenshots captured successfully!')
}

captureLandingThemePreviews().catch(console.error)
