import { chromium } from 'playwright-core'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

async function testFixedSidebar() {
  console.log('Launching Chrome to test fixed sidebar...')
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })

  const page = await context.newPage()
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // 1. Check sidebar position at initial scroll (top = 0)
  const initialSidebarBox = await page.locator('aside').boundingBox()
  console.log('Initial Sidebar Box:', initialSidebarBox)

  // 2. Scroll window down 600px
  await page.evaluate(() => window.scrollTo(0, 600))
  await page.waitForTimeout(500)

  // 3. Check sidebar position after scrolling
  const scrolledSidebarBox = await page.locator('aside').boundingBox()
  const fixedInnerBox = await page.locator('aside > div').boundingBox()
  const scrollY = await page.evaluate(() => window.scrollY)

  console.log('Current window.scrollY:', scrollY)
  console.log('Scrolled Sidebar Outer Box:', scrolledSidebarBox)
  console.log('Scrolled Sidebar Inner Fixed Box:', fixedInnerBox)

  const isFixed = fixedInnerBox && fixedInnerBox.y === 0 && fixedInnerBox.height === 900
  console.log('Is Sidebar Strictly Fixed to Viewport Top?', isFixed)

  if (!isFixed || scrollY < 100) {
    console.error('FAILED: Sidebar does not stay fixed or page did not scroll!')
    process.exit(1)
  }

  console.log('SUCCESS: Sidebar remains perfectly fixed at y:0 when page is scrolled down!')
  await browser.close()
}

testFixedSidebar().catch(err => {
  console.error(err)
  process.exit(1)
})
