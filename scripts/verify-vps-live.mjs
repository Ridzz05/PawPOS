import { chromium } from 'playwright-core'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

async function run() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()))
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message))
  page.on('response', async res => {
    if (res.url().includes('/api/')) {
      console.log('API RES:', res.status(), res.url())
      try {
        const text = await res.text()
        console.log('BODY SNIPPET:', text.slice(0, 100))
      } catch (e) {
        console.log('READ BODY ERR:', e.message)
      }
    }
  })

  console.log('Navigating to /pos...')
  await page.goto('http://202.10.38.50:8085/pos', { waitUntil: 'networkidle', timeout: 20000 })
  await page.screenshot({ path: 'docs/screenshots/vps_live_pos_debug.png' })
  await browser.close()
}

run().catch(console.error)
