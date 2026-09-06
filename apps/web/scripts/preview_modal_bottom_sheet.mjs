import { chromium } from 'playwright-core'
import path from 'path'

const ARTIFACTS_DIR = 'C:\\Users\\muhri\\.gemini\\antigravity-ide\\brain\\250f212e-5249-45fc-a1c7-6ac438a1ab86'

async function captureModalBottomSheet() {
  console.log('Launching browser to capture modal bottom sheet visual verification...')
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  })

  // 1. Mobile Viewport (390 x 844) - iPhone 14 style
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })
  const mobilePage = await mobileContext.newPage()

  // Setup mock local storage auth
  await mobilePage.addInitScript(() => {
    localStorage.setItem('pawpos_auth_user', JSON.stringify({
      id: 'user-owner',
      email: 'owner@pawpos.id',
      pin: '9999',
      name: 'Budi Santoso',
      role: 'owner',
      roleTitle: 'Owner / Pemilik Toko',
      avatar: '👑'
    }))
    localStorage.setItem('pawpos_auth_login_at', String(Date.now()))
  })

  // Go to Shifts page
  await mobilePage.goto('http://localhost:5173/shifts', { waitUntil: 'networkidle' })
  await mobilePage.waitForTimeout(600)

  // Click "Buka Shift" button to open modal
  const openShiftBtn = mobilePage.locator('button:has-text("Buka Shift")').first()
  if (await openShiftBtn.count() > 0) {
    await openShiftBtn.click()
    await mobilePage.waitForTimeout(600) // Wait for bottom sheet transition to complete
    await mobilePage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'modal_bottom_sheet_mobile_shifts.png'),
    })
    console.log('Captured modal_bottom_sheet_mobile_shifts.png')
  }

  // 2. Desktop Viewport (1280 x 800)
  const deskContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  })
  const deskPage = await deskContext.newPage()

  await deskPage.addInitScript(() => {
    localStorage.setItem('pawpos_auth_user', JSON.stringify({
      id: 'user-owner',
      email: 'owner@pawpos.id',
      pin: '9999',
      name: 'Budi Santoso',
      role: 'owner',
      roleTitle: 'Owner / Pemilik Toko',
      avatar: '👑'
    }))
    localStorage.setItem('pawpos_auth_login_at', String(Date.now()))
  })

  await deskPage.goto('http://localhost:5173/shifts', { waitUntil: 'networkidle' })
  await deskPage.waitForTimeout(600)

  const deskOpenShiftBtn = deskPage.locator('button:has-text("Buka Shift")').first()
  if (await deskOpenShiftBtn.count() > 0) {
    await deskOpenShiftBtn.click()
    await deskPage.waitForTimeout(600)
    await deskPage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'modal_bottom_sheet_desktop_shifts.png'),
    })
    console.log('Captured modal_bottom_sheet_desktop_shifts.png')
  }

  // 3. Products Page Create Product Modal on Mobile
  await mobilePage.goto('http://localhost:5173/products', { waitUntil: 'networkidle' })
  await mobilePage.waitForTimeout(600)
  const addProductBtn = mobilePage.locator('button:has-text("Tambah Produk")').first()
  if (await addProductBtn.count() > 0) {
    await addProductBtn.click()
    await mobilePage.waitForTimeout(600)
    await mobilePage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'modal_bottom_sheet_mobile_products.png'),
    })
    console.log('Captured modal_bottom_sheet_mobile_products.png')
  }

  await browser.close()
  console.log('Verification capture complete!')
}

captureModalBottomSheet().catch(console.error)
