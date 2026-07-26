import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadProposal } from '@/app/_proposal-public/load-proposal'
import ProposalView from '@/app/_proposal-public/proposal-view'

type Params = { slug: string }

export default async function ProposalPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params

  const data = await loadProposal(slug)
  if (!data) notFound()

  // счётчик просмотров (как было)
  await supabase.rpc('increment_proposal_views', { p_slug: slug })

  return <ProposalView data={data} lang="ru" />
}