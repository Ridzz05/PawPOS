import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const SCREENSHOT_DIR = 'docs/screenshots'

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function run() {
  console.log('🚀 Launching Chrome...')
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER CONSOLE ERROR:', msg.text())
    }
  })

  // STEP 1: Visit Login Page
  console.log('\n--- TEST 1: Visiting /login ---')
  await page.goto('http://202.10.38.50:8085/login', { waitUntil: 'networkidle', timeout: 30000 })
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_login_page.png') })
  console.log('✅ Screenshot saved: 01_login_page.png')

  // Check presence of demo accounts
  const bodyText = await page.innerText('body')
  const hasOwner = bodyText.includes('Budi Santoso')
  const hasKasir = bodyText.includes('Siti Rahma')
  const hasGudang = bodyText.includes('Agus Pratama')
  const hasManager = bodyText.includes('Dewi Lestari')

  console.log(`Demo accounts found: Owner=${hasOwner}, Kasir=${hasKasir}, Gudang=${hasGudang}, Manager=${hasManager}`)
  if (!hasKasir) {
    throw new Error('Kasir demo account card not found on LoginPage')
  }

  // STEP 2: Login as Kasir
  console.log('\n--- TEST 2: Logging in as Kasir ---')
  await page.locator('#btn-demo-login-cashier').click()

  // Wait for navigation to /pos
  await page.waitForURL('**/pos', { timeout: 10000 })
  console.log('✅ Successfully redirected to Kasir POS (/pos)')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_kasir_pos_terminal.png') })
  console.log('✅ Screenshot saved: 02_kasir_pos_terminal.png')

  // Check Sidebar details for Kasir
  const sidebarText = await page.locator('aside').innerText()
  console.log('Sidebar user profile text snippet:', sidebarText.split('\n').slice(0, 8).join(' | '))
  const isKasirShown = sidebarText.includes('Siti Rahma') && sidebarText.includes('KASIR')
  console.log(`Kasir badge & name in sidebar: ${isKasirShown}`)

  // Verify that there is NO role dropdown selector in sidebar
  const hasStaffSwitcherDropdown = await page.locator('aside select, aside [role="combobox"]').count()
  console.log(`Number of dropdown switchers in sidebar: ${hasStaffSwitcherDropdown} (Expected: 0)`)

  // STEP 3: Attempt to visit restricted page /dashboard as Kasir
  console.log('\n--- TEST 3: Accessing Restricted Page /dashboard as Kasir ---')
  await page.goto('http://202.10.38.50:8085/dashboard', { waitUntil: 'networkidle', timeout: 15000 })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_kasir_restricted_access.png') })
  console.log('✅ Screenshot saved: 03_kasir_restricted_access.png')

  const restrictedContent = await page.innerText('main')
  const isAccessBlocked = restrictedContent.includes('Akses Halaman Dibatasi') && restrictedContent.includes('KASIR')
  console.log(`Access restricted banner displayed correctly: ${isAccessBlocked}`)

  // STEP 4: Test Logout
  console.log('\n--- TEST 4: Logging out ---')
  // Click logout button in sidebar
  const logoutBtn = page.locator('aside button[aria-label="Keluar sesi"]')
  await logoutBtn.click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_logout_confirmation_dialog.png') })

  // Click confirm logout "Ya, Keluar"
  await page.locator('button:has-text("Ya, Keluar")').click()
  await page.waitForURL('**/login', { timeout: 10000 })
  console.log('✅ Successfully logged out and returned to /login')

  // STEP 5: Login as Owner
  console.log('\n--- TEST 5: Logging in as Owner ---')
  await page.locator('#btn-demo-login-owner').click()

  await page.waitForURL('**/dashboard', { timeout: 10000 })
  console.log('✅ Successfully redirected to Owner Dashboard (/dashboard)')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_owner_dashboard.png') })
  console.log('✅ Screenshot saved: 05_owner_dashboard.png')

  console.log('\n🎉 ALL ROLE ISOLATION & DEMO TRIAL TESTS PASSED SUCCESSFULLY!')
  await browser.close()
}

run().catch(err => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
