import { chromium } from 'playwright-core'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const SCREENSHOT_PATH = 'C:\\Users\\muhri\\.gemini\\antigravity-ide\\brain\\250f212e-5249-45fc-a1c7-6ac438a1ab86\\preview_ai_dark_mode.png'

async function captureDarkModeAiAssistant() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  // iPhone 14 / mobile viewport 390x844
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })

  const page = await context.newPage()

  // Set dark theme in localStorage and auth credentials if any
  await page.addInitScript(() => {
    localStorage.setItem('pawpos_theme_mode', 'dark')
    localStorage.setItem('pawpos_auth_user', JSON.stringify({
      id: 'owner-1',
      email: 'owner@pawpos.id',
      pin: '9999',
      name: 'Budi Santoso',
      role: 'owner',
      roleTitle: 'Owner / Pemilik Toko',
      avatar: '👑'
    }))
    localStorage.setItem('pawpos_auth_login_at', String(Date.now()))
  })

  await page.goto('http://localhost:5173/customers/hewan', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // Open the AI Assistant
  const aiButton = page.locator('button[aria-label="Buka PawPOS AI Assistant"]')
  if (await aiButton.isVisible()) {
    await aiButton.click()
    await page.waitForTimeout(800)
  }

  // Type a sample question or click quick prompt
  const chip = page.locator('text=Rekomendasi Pakan').first()
  if (await chip.isVisible()) {
    await chip.click()
    await page.waitForTimeout(2000)
  }

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false })
  console.log('Saved screenshot to:', SCREENSHOT_PATH)

  await browser.close()
}

captureDarkModeAiAssistant().catch(console.error)
