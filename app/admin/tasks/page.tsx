import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/get-profile'
import { getTasks, getTaskDirectories } from './actions'
import TasksClient from './tasks-client'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
    const profile = await getProfile()
    if (!profile) notFound()

    const [tasks, dirs] = await Promise.all([
        getTasks({ scope: 'all' }),
        getTaskDirectories(),
    ])

    return (
        <TasksClient
            initial={tasks}
            people={dirs.people}
            clients={dirs.clients}
            partners={dirs.partners}
        />
    )
}