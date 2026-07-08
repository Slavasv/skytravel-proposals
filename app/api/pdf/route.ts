import { NextRequest } from 'next/server'
import chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'

export const runtime = 'nodejs'
export const maxDuration = 60

// URL бинарника Chromium (версия должна совпадать с @sparticuz/chromium-min).
// chromium-min@149 → pack v149 (версии должны совпадать).
const CHROMIUM_PACK =
  'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return new Response('Missing slug', { status: 400 })

  const origin = req.nextUrl.origin
  const pageUrl = `${origin}/v/${slug}?print=1`

  let browser
  try {
    const isLocal = process.env.NODE_ENV === 'development'

    browser = await puppeteer.launch(
      isLocal
        ? {
            channel: 'chrome',
            headless: true,
            args: ['--no-sandbox'],
          }
        : {
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: await chromium.executablePath(CHROMIUM_PACK),
            headless: true,
          }
    )

    const page = await browser.newPage()
    await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 45000 })
    await page.evaluateHandle('document.fonts.ready')

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    })

    await browser.close()

    return new Response(pdf as BufferSource, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${slug}.pdf"`,
      },
    })
  } catch (e) {
    if (browser) await browser.close()
    console.error('PDF generation failed:', e)
    return new Response('PDF generation failed: ' + (e instanceof Error ? e.message : String(e)), { status: 500 })
  }
}