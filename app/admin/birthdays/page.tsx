import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProfile } from '@/lib/get-profile'
import BirthdaysList, { type BirthdayTraveller } from './birthdays-list'

function one<T>(v: T | T[] | null | undefined): T | null {
    if (v == null) return null
    return Array.isArray(v) ? (v[0] ?? null) : v
}

export default async function BirthdaysPage() {
    const profile = await getProfile()
    if (!profile) redirect('/login')

    const supabase = await createSupabaseServer()
    const { data } = await supabase
        .from('travellers')
        .select('id, name, title, date_of_birth, client_id, clients ( name )')
        .not('date_of_birth', 'is', null)
        .order('name', { ascending: true })

    const travellers: BirthdayTraveller[] = (data ?? []).map((r) => {
        const client = one((r as { clients?: unknown }).clients)
        return {
            id: r.id as string,
            name: (r.name as string | null) ?? null,
            title: (r.title as string | null) ?? null,
            date_of_birth: (r.date_of_birth as string | null) ?? null,
            client_id: (r.client_id as string | null) ?? null,
            client_name: (client as { name?: string | null } | null)?.name ?? null,
        }
    })

    return <BirthdaysList travellers={travellers} />
}