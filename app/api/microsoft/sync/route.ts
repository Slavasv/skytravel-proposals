import { NextRequest, NextResponse } from 'next/server'
import { pullPlannerAllCompanies } from '@/lib/microsoft-planner'

// Входящая синхронизация Planner → наша система.
// Вызывается кроном Vercel (Authorization: Bearer <CRON_SECRET>)
// или вручную из настроек через server action syncNow().
export async function GET(req: NextRequest) {
    const secret = process.env.CRON_SECRET
    if (secret) {
        const auth = req.headers.get('authorization')
        if (auth !== `Bearer ${secret}`) {
            return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
        }
    }
    const result = await pullPlannerAllCompanies()
    return NextResponse.json({ ok: true, ...result })
}