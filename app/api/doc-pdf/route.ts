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
  const kind = req.nextUrl.searchParams.get('kind') === 'd' ? 'd' : 'p'
  const lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'ru'
  if (!slug) return new Response('Missing slug', { status: 400 })

  const fileName = await buildFileName(slug, kind, lang)

  const origin = req.nextUrl.origin
  const prefix = lang === 'en' ? '/en' : ''
  const pageUrl = `${origin}${prefix}/${kind}/${encodeURIComponent(slug)}?print=1`

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
    await page.setViewport({ width: 794, height: 1123 })
    await page.emulateMediaType('print')
    await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 45000 })
    await page.evaluateHandle('document.fonts.ready')

    const renderPdf = () =>
      page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', bottom: '0', left: '0', right: '0' },
      })
    const countPages = async (buf: Uint8Array): Promise<number> => {
      try {
        const doc = await PDFDocument.load(buf)
        return doc.getPageCount()
      } catch {
        return 0
      }
    }

    // вставляем пустую распорку прямо перед бренд-футером
    const hasFooter = await page.evaluate(() => {
      const f = document.querySelector('.tp-footer')
      if (!f || !f.parentNode) return false
      const d = document.createElement('div')
      d.id = '__footpad'
      d.style.height = '0px'
      d.setAttribute('aria-hidden', 'true')
      f.parentNode.insertBefore(d, f)
      return true
    })

    let pdfBytes = await renderPdf()

    // Прижимаем футер к низу ПОСЛЕДНЕЙ страницы: бинарным поиском находим
    // максимальную высоту распорки, которая ещё НЕ создаёт новую страницу.
    // Так учитываются реальные разрывы блоков (непрерывная высота их не видит).
    if (hasFooter) {
      const setPad = (h: number) =>
        page.evaluate((hh) => {
          const el = document.getElementById('__footpad')
          if (el) el.style.height = `${hh}px`
        }, h)

      const PAGE_H = 1122.52 // высота A4 при 96dpi, поля 0
      const baseline = await countPages(pdfBytes)
      if (baseline > 0) {
        let lo = 0
        let hi = PAGE_H
        for (let i = 0; i < 7; i++) {
          const mid = (lo + hi) / 2
          await setPad(mid)
          const p = await countPages(await renderPdf())
          if (p === baseline) lo = mid
          else hi = mid
        }
        await setPad(lo)
        pdfBytes = await renderPdf()
      }
    }

    await browser.close()
    browser = undefined

    const encoded = encodeURIComponent(fileName)
    return new Response(pdfBytes as BufferSource, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encoded}.pdf"; filename*=UTF-8''${encoded}.pdf`,
      },
    })
  } catch (e) {
    if (browser) await browser.close()
    console.error('PDF generation failed:', e)
    return new Response(
      'PDF generation failed: ' + (e instanceof Error ? e.message : String(e)),
      { status: 500 }
    )
  }
}

function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
}

// Имя файла: заголовок поездки (на языке PDF), иначе — слаг.
async function buildFileName(slug: string, kind: 'p' | 'd', lang: 'ru' | 'en'): Promise<string> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase
      .from('proposals')
      .select('trip_title_ru, trip_title_en, client_name_ru, client_name_en')
      .eq('slug', slug)
      .single()
    if (!data) return slug

    const title = (lang === 'ru' ? data.trip_title_ru : data.trip_title_en)
      || data.trip_title_en || data.trip_title_ru || ''
    const client = kind === 'p'
      ? ((lang === 'ru' ? data.client_name_ru : data.client_name_en) || '')
      : ''
    const name = [client, title].filter(Boolean).join(' _ ')
    return name ? safeFileName(name) : slug
  } catch {
    return slug
  }
}