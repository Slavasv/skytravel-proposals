import { NextRequest } from 'next/server'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // адрес самой страницы ваучера (тот же хост, что и запрос)
  const origin = req.nextUrl.origin
  const pageUrl = `${origin}/v/${slug}?print=1`

  let browser
  try {
    const isLocal = process.env.NODE_ENV === 'development'

    browser = await puppeteer.launch(
      isLocal
        ? {
            // локально — используем установленный Chrome
            channel: 'chrome',
            headless: true,
            args: ['--no-sandbox'],
          }
        : {
            // на Vercel — chromium из @sparticuz/chromium
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: true,
          }
    )

    const page = await browser.newPage()
    await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 45000 })

    // ждём, пока шрифты/картинки дорисуются
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
        'Content-Disposition': `attachment; filename="${slug || 'voucher'}.pdf"`,
      },
    })
  } catch (e) {
    if (browser) await browser.close()
    console.error('PDF generation failed:', e)
    return new Response('PDF generation failed', { status: 500 })
  }
}