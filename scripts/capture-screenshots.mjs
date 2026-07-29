/**
 * Capture README screenshots (requires Vite on http://127.0.0.1:5173).
 *
 *   npm run dev
 *   npx playwright@1.51.0 install chromium
 *   node scripts/capture-screenshots.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'docs', 'screenshots')
const base = 'http://127.0.0.1:5173'
const pin = '1234'

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log('wrote', file)
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  })

  // Login screen
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await shot(page, '01-login')

  // Register
  await page.goto(`${base}/register`, { waitUntil: 'networkidle' })
  await page.locator('#name').fill('Alex Trainer')
  await page.locator('#pin').fill(pin)
  await page.getByRole('button', { name: /get started/i }).click()
  await page.waitForURL(/onboarding/, { timeout: 15000 })
  await page.waitForTimeout(500)
  await shot(page, '02-onboarding')
  await page.getByRole('button', { name: /start training/i }).click()
  await page.waitForURL(/\/$/, { timeout: 15000 })
  await page.waitForTimeout(600)

  // Dashboard
  await shot(page, '03-dashboard')

  // Plans
  await page.goto(`${base}/plans`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await shot(page, '04-plans')
  // activate a plan if possible
  const activate = page.getByRole('button', { name: /use this|activate|choose|select/i })
  if (await activate.count()) {
    await activate.first().click()
    await page.waitForTimeout(400)
  }

  // Log workout (with plan prefill if available)
  await page.goto(`${base}/log?fromPlan=1`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  // apply a preset if empty
  const preset = page.getByRole('button', { name: /chest day|today/i })
  if (await preset.count()) {
    await preset.first().click()
    await page.waitForTimeout(400)
  }
  await shot(page, '05-log')

  // Start workout for timer screenshot
  const start = page.getByRole('button', { name: /start workout/i })
  if (await start.count()) {
    await start.click()
    await page.waitForTimeout(800)
    await shot(page, '06-session')
  }

  // History
  await page.goto(`${base}/history`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await shot(page, '07-history')

  // Water
  await page.goto(`${base}/water`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await shot(page, '08-water')

  // Settings
  await page.goto(`${base}/settings`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await shot(page, '09-settings')

  // Mobile dashboard
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await shot(page, '10-dashboard-mobile')

  await browser.close()
  console.log('done')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
