import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadProposal } from '@/app/_proposal-public/load-proposal'
import ProposalView from '@/app/_proposal-public/proposal-view'

type Params = { slug: string }

export default async function ProposalPage({
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

  // счётчик просмотров (не считаем рендер под PDF)
  if (!isPrint) await supabase.rpc('increment_proposal_views', { p_slug: slug })

  return <ProposalView data={data} lang="ru" print={isPrint} />
}