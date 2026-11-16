import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, RefreshCw, Search } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { SeverityBadge, Tag } from '../components/Badges'
import { useAppData } from '../context/AppDataContext'
import { fmtDate, fmtNumber, titleCase, toDate } from '../utils/format'

export default function Reports() {
  const { history, historyStatus, refreshHistory } = useAppData()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [severity, setSeverity] = useState('all')

  const types = useMemo(() => [...new Set(history.map((h) => h.type).filter(Boolean))], [history])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return history
      .filter((h) => type === 'all' || h.type === type)
      .filter((h) => severity === 'all' || (severity === 'none' ? !h.severity : h.severity === severity))
      .filter((h) => !q || [h.id, h.filename, h.type].some((v) => v != null && String(v).toLowerCase().includes(q)))
      .map((h) => ({ ...h, rowId: h.id }))
  }, [history, search, type, severity])

  return (
    <div>
      <PageHeader
        title="Results & Reports"
        subtitle="Every analysis stored in the history database."
        actions={
          <button className="btn btn-ghost" onClick={refreshHistory} disabled={historyStatus.loading}>
            <RefreshCw size={14} className={historyStatus.loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      <div className="card p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input w-full !py-1.5 pl-8 text-xs" placeholder="Search by ID, filename or type…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input !py-1.5 text-xs" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            {types.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
          </select>
          <select className="input !py-1.5 text-xs" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="all">Any severity</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">Unrated</option>
          </select>
        </div>

        {historyStatus.error ? (
          <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-3 text-sm text-danger">{historyStatus.error}</p>
        ) : (
          <DataTable
            rows={rows}
            pageSize={12}
            initialSort={{ key: 'createdAt', dir: 'desc' }}
            emptyTitle={historyStatus.loading ? 'Loading history…' : 'No reports found'}
            emptyText={history.length ? 'Try clearing a filter.' : 'Analyses you run will be saved here.'}
            onRowClick={(r) => navigate(`/app/reports/${r.id}`)}
            columns={[
              { key: 'id', label: 'Analysis ID', render: (r) => <span className="font-mono">{r.id}</span> },
              { key: 'type', label: 'Type', render: (r) => (r.type ? <Tag>{titleCase(r.type)}</Tag> : '—') },
              { key: 'filename', label: 'Filename', render: (r) => r.filename ?? '—' },
              { key: 'createdAt', label: 'Date & time', render: (r) => fmtDate(r.createdAt), sortValue: (r) => toDate(r.createdAt)?.getTime() },
              { key: 'totalFlows', label: 'Total flows', render: (r) => fmtNumber(r.totalFlows) },
              { key: 'attackFlows', label: 'Attack flows', render: (r) => fmtNumber(r.attackFlows) },
              { key: 'benignFlows', label: 'Benign flows', render: (r) => fmtNumber(r.benignFlows) },
              { key: 'severity', label: 'Severity', render: (r) => <SeverityBadge level={r.severity} /> },
              {
                key: 'open', label: 'Actions', sortable: false,
                render: (r) => (
                  <Link to={`/app/reports/${r.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-brand hover:text-bright">
                    <FileText size={13} /> Open
                  </Link>
                ),
              },
            ]}
          />
        )}
      </div>
    </div>
  )
}
