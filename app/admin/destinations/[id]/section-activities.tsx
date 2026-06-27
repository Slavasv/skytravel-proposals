'use client'

import type { DestinationSection } from './destination-actions'

type Lang = 'ru' | 'en'

export default function SectionActivities({
  section,
  lang,
  onLocalChange,
}: {
  section: DestinationSection
  lang: Lang
  onLocalChange: (patch: Partial<DestinationSection>) => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = { section, lang, onLocalChange }
  return (
    <div style={{ paddingTop: '12px', fontSize: '12px', color: 'var(--admin-text-muted)' }}>
      Activities editor — coming next.
    </div>
  )
}