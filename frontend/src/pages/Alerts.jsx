import { useMemo, useState } from 'react'
import { Search, ShieldCheck } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import AlertCard from '../components/AlertCard'
import EmptyState from '../components/EmptyState'
import { useAppData } from '../context/AppDataContext'

const PAGE = 15

export default function Alerts() {
  const { alerts, details, history, loadOlder, historyStatus } = useAppData()
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [shown, setShown] = useState(PAGE)

  const categories = useMemo(() => [...new Set(alerts.map((a) => a.attackType).filter(Boolean))].sort(), [alerts])

  const count = (sev) => alerts.filter((a) => a.severity === sev).length
  const unrated = alerts.filter((a) => !a.severity).length

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return alerts
      .filter((a) => tab === 'all' || (tab === 'unrated' ? !a.severity : a.severity === tab))
      .filter((a) => category === 'all' || a.attackType === category)
      .filter((a) => !q || [a.attackType, a.srcIp, a.dstIp, a.method, a.analysisId].some((v) => v != null && String(v).toLowerCase().includes(q)))
  }, [alerts, tab, category, search])

  const tabs = [
    ['all', 'All alerts', alerts.length],
    ['high', 'High', count('high')],
    ['medium', 'Medium', count('medium')],
    ['low', 'Low', count('low')],
    ...(unrated ? [['unrated', 'Unrated', unrated]] : []),
  ]

  const loadedCount = Object.keys(details).length

  return (
    <div>
      <PageHeader title="Alerts & Investigations" subtitle="Suspicious flows from the analyses loaded in this session." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-line bg-card p-1">
          {tabs.map(([id, label, n]) => (
            <button
              key={id}
              onClick={() => { setTab(id); setShown(PAGE) }}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${tab === id ? 'bg-brand/15 text-brand' : 'text-muted hover:text-ink'}`}
            >
              {label} <span className="ml-1 font-mono opacity-70">{n}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input w-full !py-1.5 pl-8 text-xs" placeholder="Search alerts…" value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE) }} />
        </div>
        <select className="input !py-1.5 text-xs" value={category} onChange={(e) => { setCategory(e.target.value); setShown(PAGE) }}>
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ShieldCheck}
            title={alerts.length ? 'No alerts match these filters' : historyStatus.loading ? 'Loading reports…' : 'No alerts yet'}
            text={alerts.length ? undefined : 'Suspicious flows from analysed traffic will be listed here.'}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {visible.slice(0, shown).map((a) => <AlertCard key={`${a.analysisId}-${a.index}`} alert={a} />)}
          {visible.length > shown && (
            <button className="btn btn-ghost w-full" onClick={() => setShown(shown + PAGE)}>
              Show more ({visible.length - shown} remaining)
            </button>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted">
        Showing alerts from {loadedCount} of {history.length} stored reports.{' '}
        {loadedCount < history.length && (
          <button className="text-brand underline hover:text-bright" onClick={() => loadOlder(10)}>Load older reports</button>
        )}
      </p>
    </div>
  )
}
