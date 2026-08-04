import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadProposal } from '@/app/_proposal-public/load-proposal'
import ProposalView from '@/app/_proposal-public/proposal-view'

type Params = { slug: string }

export default async function ProposalPageEN({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<{ print?: string }>
}) {
  const { slug } = await params
  const { print } = await searchParams
  const isPrint = print === '1'

  const data = await loadProposal(slug)
  if (!data) notFound()

  if (!isPrint) await supabase.rpc('increment_proposal_views', { p_slug: slug })

  return <ProposalView data={data} lang="en" print={isPrint} />
}