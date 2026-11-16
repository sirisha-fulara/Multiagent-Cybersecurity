import { NavLink } from 'react-router-dom'
import {
  Activity, BookOpen, Database, FileText, LayoutDashboard, ScanLine, Shield, Siren, X,
} from 'lucide-react'
import StatusIndicator from './StatusIndicator'
import { useAppData } from '../context/AppDataContext'
import { fmtTime } from '../utils/format'

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/analyze', label: 'Analyze Traffic', icon: ScanLine },
  { to: '/app/alerts', label: 'Alerts & Investigations', icon: Siren },
  { to: '/app/reports', label: 'Results & Reports', icon: FileText },
  { to: '/app/threat-intelligence', label: 'Threat Intelligence', icon: Shield },
  { to: '/app/system-status', label: 'System Status', icon: Activity },
  { to: '/app/documentation', label: 'Documentation', icon: BookOpen },
]

const APP_VERSION = '1.0.0'

export default function Sidebar({ open, onClose }) {
  const { health, lastUpdated } = useAppData()
  const c = health?.components
  const state = (key) => (health ? c[key] : 'checking')

  const rows = [
    ['API', 'api'],
    ['Detection Agent', 'detection'],
    ['Classification Agent', 'classification'],
    ['Threat Intel Agent', 'threatIntel'],
    ['RAG Service', 'rag'],
  ]

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-sidebar transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <NavLink to="/" className="flex items-center gap-2.5">
            <span className="rounded-md border border-brand/40 bg-brand/10 p-1.5 shadow-glow">
              <Shield size={18} className="text-brand" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[0.18em]">CYBERSHIELD</span>
              <span className="block text-[10px] text-muted">Network Threat Analysis</span>
            </span>
          </NavLink>
          <button className="text-muted lg:hidden" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-transparent text-muted hover:bg-panel hover:text-ink'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
            <Database size={11} /> Service status
          </p>
          <ul className="space-y-1.5">
            {rows.map(([label, key]) => (
              <li key={key} className="flex items-center justify-between text-xs text-muted">
                {label}
                <StatusIndicator status={state(key)} />
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-0.5 border-t border-line pt-3 text-[11px] text-muted">
            <p>UI v{APP_VERSION}{health?.version ? ` · API v${health.version}` : ''}</p>
            <p>Last updated: {lastUpdated ? fmtTime(lastUpdated) : '—'}</p>
          </div>
        </div>
      </aside>
    </>
  )
}
