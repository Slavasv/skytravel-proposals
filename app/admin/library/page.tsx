import { createSupabaseServer } from '@/lib/supabase-server'
import { createBlock } from './actions'
import BlockRow from './block-row'
import LibrarySearch from './library-search'

type SearchParams = {
  q?: string
  type?: string
  archived?: string
}

const TYPE_FILTERS = [
  { value: null, label: 'All' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'activity', label: 'Activity' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'city', label: 'City' },
]

export default async function LibraryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, type, archived } = await searchParams
  const query = q?.trim() ?? ''
  const activeType = type ?? null
  const showArchived = archived === '1'

  const supabase = await createSupabaseServer()

  let blocksQuery = supabase
    .from('content_blocks')
    .select('*, day_blocks(count)')
    .order('updated_at', { ascending: false })

  if (showArchived) {
    blocksQuery = blocksQuery.not('archived_at', 'is', null)
  } else {
    blocksQuery = blocksQuery.is('archived_at', null)
  }

  if (activeType) {
    blocksQuery = blocksQuery.eq('type', activeType)
  }

  if (query) {
    const safe = query.replace(/[%_,]/g, '\\$&')
    blocksQuery = blocksQuery.or(
      [
        `title_ru.ilike.%${safe}%`,
        `title_en.ilike.%${safe}%`,
        `description_ru.ilike.%${safe}%`,
        `description_en.ilike.%${safe}%`,
        `location.ilike.%${safe}%`,
        `tags.cs.{${safe.toLowerCase()}}`,
      ].join(',')
    )
  }

  const { data: blocks, error } = await blocksQuery

  if (error) {
    return <div style={{ padding: '40px', color: 'red' }}>Ошибка: {error.message}</div>
  }

  const { data: scopeBlocks } = await supabase
    .from('content_blocks')
    .select('type, archived_at')

  const allActive = (scopeBlocks ?? []).filter((b) => b.archived_at === null)
  const allArchived = (scopeBlocks ?? []).filter((b) => b.archived_at !== null)
  const scope = showArchived ? allArchived : allActive

  const typeCounts: Record<string, number> = {}
  for (const b of scope) {
    typeCounts[b.type] = (typeCounts[b.type] ?? 0) + 1
  }
  const totalInScope = scope.length

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            Library{showArchived && <span style={{ color: '#888780', fontWeight: 400 }}> · Archive</span>}
          </h1>
          <p style={{ color: '#888780', margin: 0, fontSize: '14px' }}>
            {blocks?.length ?? 0} of {totalInScope} {totalInScope === 1 ? 'block' : 'blocks'}
            {query && ` matching "${query}"`}
            {activeType && ` · type: ${activeType}`}
          </p>
        </div>
        <form action={createBlock}>
          <button
            type="submit"
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 500,
              letterSpacing: '0.03em',
              background: '#FAF8F4',
              color: '#2C2C2A',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + New block
          </button>
        </form>
      </div>

      <LibrarySearch
        defaultQuery={query}
        activeType={activeType}
        showArchived={showArchived}
        typeFilters={TYPE_FILTERS}
        typeCounts={typeCounts}
        totalCount={totalInScope}
        archivedTotal={allArchived.length}
      />

      {(!blocks || blocks.length === 0) ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#888780', border: '1px dashed #555', borderRadius: '8px', fontSize: '14px' }}>
          {query || activeType
            ? 'No blocks match your search.'
            : showArchived
              ? 'No archived blocks. Archived blocks appear here when you archive them.'
              : 'No blocks yet. Click + New block to create one.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {blocks.map((b) => (
            <BlockRow
              key={b.id}
              block={b}
              usageCount={b.day_blocks?.[0]?.count ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}