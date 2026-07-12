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

  // Красивое имя файла: "Pertsev Yurii _ 27 - 30 June _ Paris, France.pdf"
  const fileName = await buildFileName(slug)

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
      format: 'A4',
      printBackground: true,
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

    const encoded = encodeURIComponent(fileName)

    return new Response(finalBytes as BufferSource, {
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

// ============ Имя PDF-файла ============

type GuestLite = { title?: string; name?: string }
type HotelLite = {
  city?: string | null
  country?: string | null
  check_in?: string | null
  check_out?: string | null
  sort_order?: number
}

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// парсит ДД/ММ/ГГГГ
function parseDMY(s?: string | null): Date | null {
  if (!s) return null
  const m = s.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (!m) return null
  const d = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  const y = parseInt(m[3], 10)
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

// "27 - 30 June" или "28 June - 3 July" (если месяцы разные)
function prettyDates(from: Date | null, to: Date | null): string {
  if (!from || !to) return ''
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()
  if (sameMonth) {
    return `${from.getDate()} - ${to.getDate()} ${MONTHS_EN[to.getMonth()]}`
  }
  return `${from.getDate()} ${MONTHS_EN[from.getMonth()]} - ${to.getDate()} ${MONTHS_EN[to.getMonth()]}`
}

// убирает символы, недопустимые в имени файла
function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
}

async function buildFileName(slug: string): Promise<string> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: voucher } = await supabase
      .from('vouchers')
      .select('id, guests')
      .eq('slug', slug)
      .single()

    if (!voucher) return slug

    const { data: hotels } = await supabase
      .from('voucher_hotels')
      .select('city, country, check_in, check_out, sort_order')
      .eq('voucher_id', voucher.id)
      .order('sort_order', { ascending: true })

    const parts: string[] = []

    // 1. Имя первого гостя (БЕЗ обращения)
    const guests: GuestLite[] = Array.isArray(voucher.guests) ? voucher.guests : []
    const firstName = guests.find((g) => g && g.name)?.name?.trim()
    if (firstName) parts.push(firstName)

    const hs: HotelLite[] = hotels ?? []

    // 2. Даты: первый check-in → последний check-out
    let from: Date | null = null
    let to: Date | null = null
    for (const h of hs) {
      const ci = parseDMY(h.check_in)
      const co = parseDMY(h.check_out)
      if (ci && (!from || ci < from)) from = ci
      if (co && (!to || co > to)) to = co
    }
    const dates = prettyDates(from, to)
    if (dates) parts.push(dates)

    // 3. Города (уникальные, по порядку) + страны
    const cities: string[] = []
    const countries: string[] = []
    for (const h of hs) {
      const c = (h.city || '').trim()
      const co = (h.country || '').trim()
      if (c && !cities.includes(c)) cities.push(c)
      if (co && !countries.includes(co)) countries.push(co)
    }
    const place = [cities.join(' & '), countries.join(' & ')]
      .filter(Boolean)
      .join(', ')
    if (place) parts.push(place)

    const name = parts.join(' _ ')
    return name ? safeFileName(name) : slug
  } catch {
    // любая ошибка — откатываемся на слаг
    return slug
  }
}