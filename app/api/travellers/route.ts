import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

// Быстрое создание traveller у клиента через стабильный URL (не серверный экшен).
type Body = {
    clientId?: string
    name?: string
    title?: string
    dateOfBirth?: string | null
}

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

    let body: Body
    try {
        body = (await req.json()) as Body
    } catch {
        return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 })
    }

    const clientId = body.clientId
    const name = (body.name || '').trim()
    if (!clientId || !name) return NextResponse.json({ ok: false, error: 'clientId and name required' }, { status: 400 })

    const { data: client } = await supabase
        .from('clients')
        .select('company_id')
        .eq('id', clientId)
        .single()
    if (!client) return NextResponse.json({ ok: false, error: 'Client not found' }, { status: 404 })

    const { data: existing } = await supabase
        .from('travellers')
        .select('sort_order')
        .eq('client_id', clientId)
        .order('sort_order', { ascending: false })
        .limit(1)
    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

    const { data: code } = await supabase.rpc('next_traveller_code', {
        p_company_id: client.company_id,
    })

    const { data, error } = await supabase
        .from('travellers')
        .insert({
            client_id: clientId,
            company_id: client.company_id,
            name,
            title: body.title || 'Mr',
            date_of_birth: body.dateOfBirth || null,
            traveller_code: code ?? null,
            sort_order: nextOrder,
        })
        .select('id, name, title, relation, date_of_birth')
        .single()

    if (error || !data) return NextResponse.json({ ok: false, error: error?.message || 'Failed to create' }, { status: 400 })
    return NextResponse.json({ ok: true, traveller: data })
}