import { NextRequest } from 'next/server'
import chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'
import { PDFDocument } from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 60

const CHROMIUM_PACK =
  'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return new Response('Missing slug', { status: 400 })

  // водяной знак (карта) — передаётся кнопкой в query, БЕЗ обращения к БД из роута
  const watermarkUrl = req.nextUrl.searchParams.get('bg') || ''

  const origin = req.nextUrl.origin
  const pageUrl = `${origin}/v/${slug}?print=1`

  let browser
  try {
    const isLocal = process.env.NODE_ENV === 'development'
    browser = await puppeteer.launch(
      isLocal
        ? { channel: 'chrome', headless: true, args: ['--no-sandbox'] }
        : {
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: await chromium.executablePath(CHROMIUM_PACK),
            headless: true,
          }
    )
    const page = await browser.newPage()
    await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 45000 })
    await page.evaluateHandle('document.fonts.ready')
    const pdfBytes = await page.pdf({
      format: 'A4', printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    })
    await browser.close()
    browser = undefined

    // наложить карту на каждую страницу, если передана
    let finalBytes: Uint8Array = pdfBytes
    if (watermarkUrl) {
      try {
        finalBytes = await addWatermark(pdfBytes, watermarkUrl)
      } catch (e) {
        console.error('Watermark step failed, returning PDF without it:', e)
        finalBytes = pdfBytes
      }
    }

    return new Response(finalBytes as BufferSource, {
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

async function addWatermark(pdfBytes: Uint8Array, imgSrc: string): Promise<Uint8Array> {
  let imgBytes: Uint8Array
  let isPng: boolean
  if (imgSrc.startsWith('data:')) {
    const comma = imgSrc.indexOf(',')
    isPng = imgSrc.slice(5, comma).includes('png')
    imgBytes = Uint8Array.from(Buffer.from(imgSrc.slice(comma + 1), 'base64'))
  } else {
    const res = await fetch(imgSrc)
    const ct = res.headers.get('content-type') || ''
    imgBytes = new Uint8Array(await res.arrayBuffer())
    isPng = ct.includes('png') || (imgBytes[0] === 0x89 && imgBytes[1] === 0x50)
  }

  const pdfDoc = await PDFDocument.load(pdfBytes)
  const img = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes)

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize()
    const targetW = width * 0.62
    const scale = targetW / img.width
    const targetH = img.height * scale
    const x = (width - targetW) / 2
    const y = height * 0.80 - targetH
    page.drawImage(img, { x, y, width: targetW, height: targetH, opacity: 0.12 })
  }

  return await pdfDoc.save()
}