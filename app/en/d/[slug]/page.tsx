import { notFound } from 'next/navigation'
import { loadDestination } from '@/app/_destination-public/load-destination'
import DestinationView from '@/app/_destination-public/destination-view'

export default async function DestinationPageEn({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await loadDestination(slug)
  if (!data) notFound()
  return <DestinationView data={data} lang="en" />
}
