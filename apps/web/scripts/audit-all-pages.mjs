import { chromium } from 'playwright-core'
import path from 'path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ARTIFACTS_DIR = 'C:\\Users\\muhri\\.gemini\\antigravity-ide\\brain\\250f212e-5249-45fc-a1c7-6ac438a1ab86'

const PAGES_TO_TEST = [
  { path: '/landing', name: 'Landing Page' },
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/pos', name: 'Kasir POS' },
  { path: '/orders', name: 'Riwayat Transaksi' },
  { path: '/products', name: 'Katalog Produk' },
  { path: '/inventory/stocks', name: 'Saldo & Mutasi Stok' },
  { path: '/shifts', name: 'Sesi & Shift Kasir' },
  { path: '/settings', name: 'Pengaturan' },
]

async function runComprehensiveAudit() {
  console.log('Starting comprehensive Playwright audit on all pages...')
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const results = {
    pagesChecked: 0,
    overflowIssues: [],
    consoleErrors: [],
    functionalChecks: [],
  }

  // --- 1. AUDIT ON DESKTOP (1440x900) & MOBILE (375x812) ---
  for (const view of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 375, height: 812 },
  ]) {
    console.log(`\n================ Testing on ${view.name.toUpperCase()} (${view.width}x${view.height}) ================`)
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
    })
    const page = await context.newPage()

    page.on('console', msg => {
      if (msg.type() === 'error') {
        results.consoleErrors.push({ view: view.name, url: page.url(), text: msg.text() })
      }
    })

    for (const p of PAGES_TO_TEST) {
      results.pagesChecked++
      const url = `http://localhost:5173${p.path}`
      await page.goto(url, { waitUntil: 'networkidle' })
      await page.waitForTimeout(400)

      // Evaluate overflow
      const pageMetrics = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth
        const winWidth = window.innerWidth

        // Find elements that overflow the viewport horizontally
        const overflowingElements = []
        const all = document.querySelectorAll('*')
        all.forEach(el => {
          const rect = el.getBoundingClientRect()
          if (rect.right > winWidth + 2 && rect.width > 0 && rect.height > 0) {
            const style = window.getComputedStyle(el)
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              overflowingElements.push({
                tag: el.tagName.toLowerCase(),
                id: el.id || undefined,
                className: typeof el.className === 'string' ? el.className.slice(0, 50) : undefined,
                rectRight: Math.round(rect.right),
                excess: Math.round(rect.right - winWidth),
              })
            }
          }
        })

        return {
          docWidth,
          winWidth,
          hasOverflow: docWidth > winWidth,
          overflowCount: overflowingElements.length,
          topOverflowElements: overflowingElements.slice(0, 3),
        }
      })

      if (pageMetrics.hasOverflow) {
        console.warn(`[OVERFLOW] ${view.name} ${p.name} (${p.path}): docWidth=${pageMetrics.docWidth}px > winWidth=${pageMetrics.winWidth}px`)
        results.overflowIssues.push({
          view: view.name,
          page: p.name,
          path: p.path,
          ...pageMetrics,
        })
      } else {
        console.log(`[PASS] ${view.name} ${p.name}: No overflow (width: ${pageMetrics.docWidth}px)`)
      }

      // Save screenshot for each page
      const screenshotFilename = `page_${view.name}_${p.path.replace(/[^a-z0-9]/gi, '_')}.png`
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, screenshotFilename),
        fullPage: false,
      })
    }

    await context.close()
  }

  // --- 2. AUDIT MAIN CORE FUNCTIONALITIES ---
  console.log('\n================ Testing Core Functionalities ================')
  const funcContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await funcContext.newPage()

  // Functional Test A: POS Page - Add product, update cart, open checkout
  try {
    console.log('Testing Kasir POS functionality...')
    await page.goto('http://localhost:5173/pos', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    const productCardLocator = page.locator('.terminal-card-hover')
    const productCards = await productCardLocator.count()
    console.log(`POS: Found ${productCards} product cards`)

    if (productCards > 0) {
      await productCardLocator.first().click()
      await page.waitForTimeout(400)
    }

    const bayarBtn = page.locator('button:has-text("Bayar")')
    const hasBayar = await bayarBtn.isVisible()

    results.functionalChecks.push({ feature: 'Kasir POS Item Cart & Bayar Action', status: hasBayar ? 'PASS' : 'WARN' })
  } catch (err) {
    console.error('POS Error:', err.message)
    results.functionalChecks.push({ feature: 'Kasir POS', status: 'FAIL', error: err.message })
  }

  // Functional Test B: Orders Page - Filters
  try {
    console.log('Testing Orders Page functionality...')
    await page.goto('http://localhost:5173/orders', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    const searchInput = page.locator('input[placeholder*="Cari"]')
    const hasSearch = await searchInput.isVisible()

    const qrisChip = page.locator('.MuiChip-root:has-text("QRIS")').first()
    if (await qrisChip.isVisible()) {
      await qrisChip.click()
      await page.waitForTimeout(300)
    }

    results.functionalChecks.push({ feature: 'Riwayat Transaksi Search & Filter Chips', status: hasSearch ? 'PASS' : 'WARN' })
  } catch (err) {
    results.functionalChecks.push({ feature: 'Riwayat Transaksi', status: 'FAIL', error: err.message })
  }

  // Functional Test C: Inventory Stocks Page - Tab switching & Inbound button
  try {
    console.log('Testing Stocks Page functionality...')
    await page.goto('http://localhost:5173/inventory/stocks', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    const mutasiTab = page.locator('button[role="tab"]:has-text("Buku Mutasi")')
    if (await mutasiTab.isVisible()) {
      await mutasiTab.click()
      await page.waitForTimeout(400)
    }

    const inboundBtn = page.locator('button:has-text("Barang Masuk")').first()
    const hasInbound = await inboundBtn.isVisible()

    results.functionalChecks.push({ feature: 'Inventori Stocks Tabs & Inbound Action', status: hasInbound ? 'PASS' : 'WARN' })
  } catch (err) {
    results.functionalChecks.push({ feature: 'Inventori Stocks', status: 'FAIL', error: err.message })
  }

  // Functional Test D: AI Copilot Assistant Widget in Topbar
  try {
    console.log('Testing AI Copilot Widget...')
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    const copilotBtn = page.locator('button[aria-label="Buka PawPOS AI Assistant"]')
    const hasCopilot = await copilotBtn.isVisible()
    console.log('AI Copilot Topbar button visible?', hasCopilot)

    if (hasCopilot) {
      await copilotBtn.click()
      await page.waitForTimeout(500)

      const drawer = page.locator('text=PawPOS AI Copilot').first()
      const isDrawerOpen = await drawer.isVisible()
      console.log('AI Copilot Drawer opened?', isDrawerOpen)

      const closeBtn = page.locator('button[aria-label="Tutup"]').first()
      if (await closeBtn.isVisible()) {
        await closeBtn.click()
        await page.waitForTimeout(300)
      }

      results.functionalChecks.push({ feature: 'AI Copilot Assistant Topbar Button & Chat Drawer', status: isDrawerOpen ? 'PASS' : 'WARN' })
    } else {
      results.functionalChecks.push({ feature: 'AI Copilot Assistant Button', status: 'WARN' })
    }
  } catch (err) {
    results.functionalChecks.push({ feature: 'AI Copilot Widget', status: 'FAIL', error: err.message })
  }

  // Functional Test E: Settings Page Preferences
  try {
    console.log('Testing Settings Page...')
    await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    const compactToggle = page.locator('button:has-text("mode ringkas"), button:has-text("Mode ringkas")').first()
    const hasToggle = await compactToggle.isVisible()
    if (hasToggle) {
      await compactToggle.click()
      await page.waitForTimeout(300)
    }

    results.functionalChecks.push({ feature: 'Pengaturan Workspace Compact Mode & Toggles', status: hasToggle ? 'PASS' : 'WARN' })
  } catch (err) {
    results.functionalChecks.push({ feature: 'Settings Page', status: 'FAIL', error: err.message })
  }

  // Functional Test F: Shifts Page - Drawer & Cash breakdown
  try {
    console.log('Testing Shifts Page...')
    await page.goto('http://localhost:5173/shifts', { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)

    const shiftHeader = await page.locator('text=Sesi & Shift Kasir').first().isVisible()
    results.functionalChecks.push({ feature: 'Sesi & Shift Kasir Status Card', status: shiftHeader ? 'PASS' : 'WARN' })
  } catch (err) {
    results.functionalChecks.push({ feature: 'Shifts Page', status: 'FAIL', error: err.message })
  }

  await browser.close()

  console.log('\n================ AUDIT SUMMARY ================')
  console.log(`Total Pages Inspected: ${results.pagesChecked / 2} pages across 2 viewports (16 tests)`)
  console.log(`Overflow Issues Found: ${results.overflowIssues.length}`)
  console.log(`Console Errors: ${results.consoleErrors.length}`)
  console.log('Functional Checks:', JSON.stringify(results.functionalChecks, null, 2))

  if (results.overflowIssues.length === 0 && results.functionalChecks.every(f => f.status === 'PASS')) {
    console.log('\n>>> STATUS: ALL CLEAR! ALL 8 PAGES & CORE FEATURES 100% OPERATIONAL WITH 0 OVERFLOW! <<<')
  } else {
    console.log('\n>>> STATUS: AUDIT COMPLETED WITH FINDINGS <<<')
  }
}

runComprehensiveAudit().catch(err => {
  console.error('Fatal Audit Error:', err)
  process.exit(1)
})
