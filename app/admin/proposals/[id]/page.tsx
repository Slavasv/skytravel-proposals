import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getClientsForProposal } from '../../actions'
import EditPageClient from './edit-page-client'
import { tr } from '@/lib/i18n'
import { getUiLang } from '@/lib/get-profile'

export default async function EditProposalPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ variant?: string }>
}) {
  const { id } = await params
  const { variant: variantParam } = await searchParams
  const lang = await getUiLang()

  const supabase = await createSupabaseServer()

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !proposal) {
    notFound()
  }

  // варианты предложения
  const VARIANT_COLS = 'id, sort_order, name_ru, name_en, subtitle_ru, subtitle_en, is_selected, total_price'
  const { data: variantsData } = await supabase
    .from('proposal_variants')
    .select(VARIANT_COLS)
    .eq('proposal_id', proposal.id)
    .order('sort_order', { ascending: true })
  let variants = variantsData ?? []

  // У каждого предложения всегда есть хотя бы один маршрут — чтобы блоки
  // (Впечатления, Стоимость, Условия) были доступны сразу, без ручного
  // «Добавить вариант». Дополнительные маршруты агент добавляет сам при желании.
  if (variants.length === 0) {
    const { data: created } = await supabase
      .from('proposal_variants')
      .insert({ proposal_id: proposal.id, sort_order: 0, name_ru: 'Маршрут 1', name_en: 'Route 1' })
      .select(VARIANT_COLS)
      .single()
    if (created) variants = [created]
  }

  // активный вариант: из URL, иначе первый
  const activeVariantId = (variantParam && variants.some((v) => v.id === variantParam))
    ? variantParam
    : (variants[0]?.id ?? null)

  // полные данные активного варианта (условия, галерея, название)
  let activeVariant = null
  if (activeVariantId) {
    const { data } = await supabase
      .from('proposal_variants')
      .select('*')
      .eq('id', activeVariantId)
      .single()
    activeVariant = data
  }

  // Число гостей живёт в запросе: агент меняет состав — предложение подхватывает.
  if (proposal.request_id) {
    const { data: req } = await supabase
      .from('requests')
      .select('traveller_ids')
      .eq('id', proposal.request_id)
      .single()
    const count = Array.isArray(req?.traveller_ids) ? req.traveller_ids.length : 0
    if (count > 0 && count !== proposal.guest_count) {
      proposal.guest_count = count
      await supabase
        .from('proposals')
        .update({ guest_count: count })
        .eq('id', proposal.id)
    }
  }

  const daysQuery = supabase
    .from('days')
    .select(`
      *,
      day_blocks (
        id,
        sort_order,
        time,
        custom_note_ru,
        custom_note_en,
        room_type_ru,
        room_type_en,
        from_ru,
        from_en,
        to_ru,
        to_en,
        room_ids,
        activities_ru,
        activities_en,
        selected_rooms,
        price,
        guests,
        content_blocks (
          id,
          type,
          title_ru,
          title_en,
          description_ru,
          description_en,
          image_url,
          location,
          tags,
          rooms
        )
      )
    `)
    .order('day_number', { ascending: true })

  const { data: days } = activeVariantId
    ? await daysQuery.eq('variant_id', activeVariantId)
    : await daysQuery.eq('proposal_id', proposal.id)

  const clients = await getClientsForProposal()

  const sortedDays = (days ?? []).map((day) => ({
    ...day,
    day_blocks: (day.day_blocks ?? []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    ),
  }))

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginBottom: '16px' }}>
        <Link href="/admin" style={{ color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
          {tr(lang, '← Back to proposals', '← Назад к предложениям')}
        </Link>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          {proposal.trip_title_ru || tr(lang, 'Untitled proposal', 'Предложение без названия')}
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
          {tr(lang, 'For', 'Для')} {proposal.client_name_ru || tr(lang, 'unknown client', 'клиент не указан')}
        </p>
      </div>

      <EditPageClient proposal={proposal} days={days ?? []} clients={clients} variants={variants} activeVariantId={activeVariantId} activeVariant={activeVariant} />
    </div>
  )
}