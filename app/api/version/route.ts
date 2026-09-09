import { NextResponse } from 'next/server'

// Возвращает идентификатор текущей запущенной сборки (вшит на этапе build).
// Клиент опрашивает этот эндпоинт и сравнивает со своим вшитым значением —
// если разошлись, значит вышел новый деплой и вкладку надо перезагрузить.
export const dynamic = 'force-dynamic'

export async function GET() {
    return new NextResponse(process.env.NEXT_PUBLIC_BUILD_ID || 'dev', {
        headers: {
            'content-type': 'text/plain',
            'cache-control': 'no-store, max-age=0',
        },
    })
}
