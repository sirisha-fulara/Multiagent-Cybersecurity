import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, Menu, Search, User } from 'lucide-react'
import { useAppData } from '../context/AppDataContext'
import { RANGES } from '../utils/time'
import { SeverityBadge } from './Badges'

// closes a dropdown when you click anywhere else
function Backdrop({ onClick }) {
  return <div className="fixed inset-0 z-10" onClick={onClick} />
}

export default function Topbar({ onMenu }) {
  const { history, flows, alerts, range, setRange } = useAppData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState(null) // 'bell' | 'profile' | null

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const has = (v) => v != null && String(v).toLowerCase().includes(q)

    const reports = history
      .filter((h) => has(h.id) || has(h.filename) || has(h.type))
      .slice(0, 4)
      .map((h) => ({ key: `r-${h.id}`, title: h.filename || `Analysis ${h.id}`, sub: `Report · ${h.id}`, to: `/app/reports/${h.id}` }))

    const hits = flows
      .filter((f) => has(f.srcIp) || has(f.dstIp) || has(f.attackType))
      .slice(0, 5)
      .map((f) => ({
        key: `f-${f.analysisId}-${f.index}`,
        title: `${f.attackType || (f.verdict === 'benign' ? 'Benign' : 'Flow')} · ${f.srcIp ?? '?'} → ${f.dstIp ?? '?'}`,
        sub: `Flow #${f.index + 1} · report ${f.analysisId}`,
        to: `/app/investigate/${f.analysisId}/${f.index}`,
      }))
    return [...reports, ...hits]
  }, [query, history, flows])

  const go = (to) => {
    setQuery('')
    navigate(to)
  }

  const recent = alerts.slice(0, 5)

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
      <button className="text-muted lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu size={20} />
      </button>

      <div className="relative max-w-md flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="input w-full pl-9"
          placeholder="Search analyses, IPs, attack types, IDs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.trim() && (
          <>
            <Backdrop onClick={() => setQuery('')} />
            <div className="absolute left-0 right-0 top-11 z-20 max-h-80 overflow-y-auto rounded-md border border-line bg-card p-1 shadow-xl">
              {results.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted">Nothing matches in the loaded data.</p>
              ) : (
                results.map((r) => (
                  <button key={r.key} onClick={() => go(r.to)} className="block w-full rounded px-3 py-2 text-left hover:bg-panel">
                    <span className="block truncate text-sm">{r.title}</span>
                    <span className="block text-[11px] text-muted">{r.sub}</span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <select className="input hidden !py-1.5 text-xs sm:block" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Time range">
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>

        <div className="relative">
          <button className="btn btn-ghost relative !p-2" onClick={() => setMenu(menu === 'bell' ? null : 'bell')} aria-label="Notifications">
            <Bell size={16} />
            {alerts.length > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger" />}
          </button>
          {menu === 'bell' && (
            <>
              <Backdrop onClick={() => setMenu(null)} />
              <div className="absolute right-0 top-11 z-20 w-80 rounded-md border border-line bg-card p-2 shadow-xl">
                <p className="px-2 py-1 text-xs text-muted">Latest suspicious flows</p>
                {recent.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted">No alerts in the loaded reports.</p>
                ) : (
                  recent.map((a) => (
                    <Link
                      key={`${a.analysisId}-${a.index}`}
                      to={`/app/investigate/${a.analysisId}/${a.index}`}
                      onClick={() => setMenu(null)}
                      className="flex items-center justify-between gap-2 rounded px-2 py-2 hover:bg-panel"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{a.attackType || 'Suspicious flow'}</span>
                        <span className="block truncate font-mono text-[11px] text-muted">{a.srcIp ?? '?'} → {a.dstIp ?? '?'}</span>
                      </span>
                      <SeverityBadge level={a.severity} />
                    </Link>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button className="btn btn-ghost !px-2 !py-1.5" onClick={() => setMenu(menu === 'profile' ? null : 'profile')}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/15 text-brand">
              <User size={14} />
            </span>
            <span className="hidden text-xs sm:inline">Analyst</span>
            <ChevronDown size={13} className="text-muted" />
          </button>
          {menu === 'profile' && (
            <>
              <Backdrop onClick={() => setMenu(null)} />
              <div className="absolute right-0 top-11 z-20 w-56 rounded-md border border-line bg-card p-2 shadow-xl">
                <p className="px-2 py-1 text-xs text-muted">Local session – no sign-in is configured for this app.</p>
                <Link to="/" onClick={() => setMenu(null)} className="block rounded px-2 py-2 text-sm hover:bg-panel">
                  Back to home page
                </Link>
                <Link to="/app/documentation" onClick={() => setMenu(null)} className="block rounded px-2 py-2 text-sm hover:bg-panel">
                  Documentation
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
