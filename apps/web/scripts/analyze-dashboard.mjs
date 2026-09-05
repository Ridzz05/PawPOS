import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const SCREENSHOT_PATH = 'C:\\Users\\muhri\\Documents\\ai-operational-pos\\apps\\web\\public\\branding\\dashboard_redesigned.png'

async function analyze() {
  console.log('Launching Chrome via playwright-core...')
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })

  const page = await context.newPage()
  console.log('Navigating to http://localhost:5173/dashboard...')
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' })

  // Wait for content to settle
  await page.waitForTimeout(1000)

  // Extract page metadata and elements
  const analysis = await page.evaluate(() => {
    const title = document.title
    const heading1 = document.querySelector('h4, h1')?.textContent?.trim()
    const allChips = Array.from(document.querySelectorAll('.MuiChip-root')).map(c => c.textContent?.trim())
    const allCards = Array.from(document.querySelectorAll('.MuiCard-root, .terminal-card')).map(c => {
      const heading = c.querySelector('h5, h6, h4')?.textContent?.trim()
      const text = c.textContent?.trim().slice(0, 100)
      return { heading, text }
    })
    const emptyState = document.querySelector('.terminal-card')?.parentElement?.textContent?.includes('Belum ada ringkasan operasional')

    return {
      title,
      heading1,
      chips: allChips,
      cardCount: allCards.length,
      cards: allCards,
      hasEmptyPlaceholder: emptyState,
    }
  })

  console.log('Analysis Results:', JSON.stringify(analysis, null, 2))

  // Take full-page screenshot
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true })
  console.log(`Full-page screenshot saved to ${SCREENSHOT_PATH}`)

  await browser.close()
}

analyze().catch(err => {
  console.error('Playwright Error:', err)
  process.exit(1)
})
