import { BookOpen, Radar } from 'lucide-react'
import { Tag } from './Badges'

// Threat intelligence as returned by the RAG agent. Everything here is
// "retrieved knowledge", which is kept visually separate from what was observed in traffic.
export default function IntelBlock({ intel }) {
  if (!intel) {
    return <p className="text-xs text-muted">No threat intelligence was returned for this finding.</p>
  }

  const sections = [
    ['Possible impact', intel.impact ? [{ title: intel.impact }] : []],
    ['Relevant indicators', intel.indicators],
    ['Mitigation recommendations', intel.mitigation],
    ['Retrieved passages', intel.passages],
    ['Supporting sources', intel.sources],
  ]

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="blue"><BookOpen size={11} /> Retrieved knowledge</Tag>
        {intel.category && <Tag tone="muted">{intel.category}</Tag>}
      </div>

      {intel.description && (
        <div className="whitespace-pre-wrap leading-relaxed text-ink/90">
          {intel.description}
        </div>
      )}
      
      {sections.map(([title, items]) =>
        items?.length ? (
          <div key={title}>
            <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">{title}</h4>
            <ul className="space-y-1.5">
              {items.map((it, i) => (
                <li key={i} className="flex gap-2 text-[13px]">
                  <Radar size={13} className="mt-1 shrink-0 text-brand/70" />
                  <span>
                    {it.title}
                    {it.detail && <span className="block text-xs text-muted">{it.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </div>
  )
}
