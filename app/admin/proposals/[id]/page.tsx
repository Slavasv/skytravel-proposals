import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getClientsForProposal } from '../../actions'
import EditPageClient from './edit-page-client'

export default async function EditProposalPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ variant?: string }>
}) {
  const { id } = await params
  const { variant: variantParam } = await searchParams

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
  const { data: variantsData } = await supabase
    .from('proposal_variants')
    .select('id, sort_order, name_ru, name_en, subtitle_ru, subtitle_en, is_selected, total_price')
    .eq('proposal_id', proposal.id)
    .order('sort_order', { ascending: true })
  const variants = variantsData ?? []

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
          ← Back to proposals
        </Link>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          {proposal.trip_title_ru || 'Untitled proposal'}
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
          For {proposal.client_name_ru || 'unknown client'}
        </p>
      </div>

      <EditPageClient proposal={proposal} days={days ?? []} clients={clients} variants={variants} activeVariantId={activeVariantId} activeVariant={activeVariant} />
    </div>
  )
}