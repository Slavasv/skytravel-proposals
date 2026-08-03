import { notFound } from 'next/navigation'
import { loadDestination } from '@/app/_destination-public/load-destination'
import DestinationView from '@/app/_destination-public/destination-view'

export default async function DestinationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ print?: string }>
}) {
  const { slug } = await params
  const { print } = await searchParams
  const data = await loadDestination(slug)
  if (!data) notFound()
  return <DestinationView data={data} lang="ru" print={print === '1'} />
}
