import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, Eye, Layers, RefreshCw, ShieldAlert, ShieldCheck, Waypoints, WifiOff } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import ChartCard, { axisProps, tooltipStyle } from '../components/ChartCard'
import DataTable from '../components/DataTable'
import AgentPipeline from '../components/AgentPipeline'
import EmptyState from '../components/EmptyState'
import { SeverityBadge, VerdictBadge } from '../components/Badges'
import { useAppData } from '../context/AppDataContext'
import { confidenceHistogram, countBy, protocolBucket, toChartRows } from '../utils/stats'
import { fmtDate, fmtNumber, fmtPercent, toDate } from '../utils/format'
import { RANGES } from '../utils/time'

const PALETTE = ['#32D583', '#38BDF8', '#F59E0B', '#FF4D4D', '#A3E635', '#2DD4BF', '#FB923C', '#94A3B8']

const sum = (list, key) => list.reduce((t, r) => t + (r[key] ?? 0), 0)
const hasAny = (list, key) => list.some((r) => r[key] != null)

// group reports into time buckets so the trend line has something sensible to plot
function buildTrend(records, range) {
  const withDate = records.filter((r) => toDate(r.createdAt))
  if (!withDate.length) return []
  const step = range === 'hour' ? 10 * 60e3 : range === 'day' ? 3600e3 : 24 * 3600e3
  const buckets = new Map()
  for (const r of withDate) {
    const t = Math.floor(toDate(r.createdAt).getTime() / step) * step
    const b = buckets.get(t) || { t, benign: 0, malicious: 0 }
    b.benign += r.benignFlows ?? 0
    b.malicious += r.attackFlows ?? 0
    buckets.set(t, b)
  }
  return [...buckets.values()]
    .sort((a, b) => a.t - b.t)
    .map((b) => ({
      ...b,
      label: new Date(b.t).toLocaleString(undefined, step < 24 * 3600e3 ? { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' }),
    }))
}

export default function Dashboard() {
  const { health, healthError, rangedHistory, historyStatus, refreshHistory, details, flows, alerts, loadOlder, history, range, setRange } = useAppData()
  const navigate = useNavigate()

  // ---- KPIs, all derived from real records ----
  const totalFlows = hasAny(rangedHistory, 'totalFlows') ? sum(rangedHistory, 'totalFlows') : flows.length || null
  const benign = hasAny(rangedHistory, 'benignFlows') ? sum(rangedHistory, 'benignFlows') : flows.filter((f) => f.verdict === 'benign').length || null
  const malicious = hasAny(rangedHistory, 'attackFlows') ? sum(rangedHistory, 'attackFlows') : alerts.length || null

  const attackCounts = useMemo(() => countBy(alerts.filter((a) => a.attackType), (a) => a.attackType), [alerts])
  const categoryRows = useMemo(() => toChartRows(attackCounts), [attackCounts])
  const highAlerts = alerts.filter((a) => a.severity === 'high').length

  const trend = useMemo(() => buildTrend(rangedHistory, range), [rangedHistory, range])

  const protocolRows = useMemo(() => {
    const counts = countBy(flows, (f) => protocolBucket(f.protocol))
    return ['TCP', 'UDP', 'ICMP', 'Other'].filter((p) => counts[p]).map((p) => ({ name: p, value: counts[p] }))
  }, [flows])

  const histogram = useMemo(() => confidenceHistogram(flows), [flows])
  const hasConfidence = flows.some((f) => f.confidence != null)

  const latestReport = useMemo(() => Object.values(details).sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0))[0], [details])

  const loadedCount = Object.keys(details).length
  const noData = !historyStatus.loading && history.length === 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Security Overview"
        subtitle="Live view of everything stored in the analysis history."
        actions={
          <button className="btn btn-ghost" onClick={refreshHistory} disabled={historyStatus.loading}>
            <RefreshCw size={14} className={historyStatus.loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {health && !health.reachable && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm">
          <WifiOff size={18} className="mt-0.5 text-danger" />
          <div>
            <p className="font-medium text-danger">Backend unreachable</p>
            <p className="text-xs text-muted">{healthError}</p>
          </div>
        </div>
      )}
      {historyStatus.error && health?.reachable && (
        <div className="rounded-lg border border-warn/30 bg-warn/10 p-3 text-xs text-warn">Couldn't load history: {historyStatus.error}</div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={Waypoints} label="Total Flows Analyzed" value={fmtNumber(totalFlows)} hint={`${rangedHistory.length} analyses`} />
        <StatCard icon={ShieldCheck} label="Benign Flows" value={fmtNumber(benign)} hint="classified as normal" />
        <StatCard icon={ShieldAlert} tone="red" label="Malicious / Suspicious" value={fmtNumber(malicious)} hint="flagged by the pipeline" />
        <StatCard icon={Layers} tone="blue" label="Attack Categories" value={categoryRows.length || '—'} hint="distinct types seen" />
        <StatCard icon={AlertTriangle} tone="orange" label="High Severity Alerts" value={fmtNumber(highAlerts)} hint="where severity is reported" />
      </div>

      {noData && (
        <div className="card">
          <EmptyState
            icon={ShieldCheck}
            title="No analyses yet"
            text="Run a single flow, CSV batch or PCAP analysis and the results will build up here."
          >
            <Link to="/app/analyze" className="btn btn-primary">Analyze traffic</Link>
          </EmptyState>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <ChartCard
            title="Traffic Analysis Trend"
            subtitle="Benign vs malicious flows per analysis time window"
            empty={!trend.length}
            emptyText="No analyses with timestamps fall in this time range."
            height={260}
            actions={
              <div className="flex rounded-md border border-line text-xs">
                {RANGES.map((r) => (
                  <button key={r.key} onClick={() => setRange(r.key)} className={`px-2 py-1 transition-colors ${range === r.key ? 'bg-brand/15 text-brand' : 'text-muted hover:text-ink'}`}>
                    {r.label.replace('Last ', '')}
                  </button>
                ))}
              </div>
            }
          >
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ left: -10, right: 10, top: 5 }}>
                <CartesianGrid stroke="#18352A" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="benign" name="Benign" stroke="#32D583" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="malicious" name="Malicious" stroke="#FF4D4D" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Attack Category Distribution" empty={!categoryRows.length} emptyText="No classified attack flows loaded yet.">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={categoryRows} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="#0B1713">
                    {categoryRows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top Attack Categories" empty={!categoryRows.length} emptyText="No classified attack flows loaded yet.">
              <ResponsiveContainer>
                <BarChart data={categoryRows.slice(0, 6)} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid stroke="#18352A" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" {...axisProps} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={100} {...axisProps} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="value" name="Flows" fill="#32D583" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Protocol Distribution" empty={!protocolRows.length} emptyText="Loaded flows don't include protocol information.">
              <ResponsiveContainer>
                <BarChart data={protocolRows} margin={{ left: -10 }}>
                  <CartesianGrid stroke="#18352A" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="value" name="Flows" fill="#38BDF8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Detection Confidence" subtitle="Only flows where the backend returned a confidence" empty={!hasConfidence} emptyText="No confidence scores in the loaded flows.">
              <ResponsiveContainer>
                <BarChart data={histogram} margin={{ left: -10 }}>
                  <CartesianGrid stroke="#18352A" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="range" {...axisProps} interval={1} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="benign" name="Benign" fill="#32D583" />
                  <Bar dataKey="suspicious" name="Suspicious" fill="#FF4D4D" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>

        <div className="space-y-4">
          <AgentPipeline health={health} report={latestReport} />

          <section className="card p-4">
            <h3 className="card-title mb-3">Recent Alerts</h3>
            {alerts.length === 0 ? (
              <EmptyState compact title="No alerts" text="No suspicious flows in the loaded reports." />
            ) : (
              <ul className="divide-y divide-line">
                {alerts.slice(0, 6).map((a) => (
                  <li key={`${a.analysisId}-${a.index}`} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{a.attackType || 'Suspicious flow'}</p>
                      <p className="truncate font-mono text-[11px] text-muted">{a.srcIp ?? '?'} → {a.dstIp ?? '?'}</p>
                      <p className="text-[11px] text-muted">{fmtDate(a.when)}</p>
                    </div>
                    <SeverityBadge level={a.severity} />
                    <Link to={`/app/investigate/${a.analysisId}/${a.index}`} className="text-brand hover:text-bright" aria-label="View details">
                      <Eye size={15} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="card p-4">
        <h3 className="card-title mb-3">Recent Analyses</h3>
        <DataTable
          pageSize={5}
          rows={rangedHistory.map((r) => ({ ...r, rowId: r.id }))}
          emptyTitle="No analyses in this range"
          columns={[
            { key: 'filename', label: 'File / Analysis', render: (r) => r.filename || `Analysis ${r.id}` },
            { key: 'totalFlows', label: 'Flows', render: (r) => fmtNumber(r.totalFlows) },
            { key: 'createdAt', label: 'Timestamp', render: (r) => fmtDate(r.createdAt), sortValue: (r) => toDate(r.createdAt)?.getTime() },
            { key: 'status', label: 'Status', sortable: false, render: () => <span className="chip border-brand/30 bg-brand/10 text-brand">Stored</span> },
            { key: 'open', label: '', sortable: false, render: (r) => <Link className="text-brand hover:text-bright" to={`/app/reports/${r.id}`}>Open report</Link> },
          ]}
        />
      </section>

      <RecentFlows flows={flows} onOpen={(f) => navigate(`/app/investigate/${f.analysisId}/${f.index}`)} />

      <p className="text-center text-xs text-muted">
        Flow-level widgets use {loadedCount} of {history.length} reports loaded so far.{' '}
        {loadedCount < history.length && (
          <button className="text-brand underline hover:text-bright" onClick={() => loadOlder(10)}>Load 10 more</button>
        )}
      </p>
    </div>
  )
}

function RecentFlows({ flows, onOpen }) {
  const [search, setSearch] = useState('')
  const [verdict, setVerdict] = useState('all')
  const [category, setCategory] = useState('all')
  const [protocol, setProtocol] = useState('all')

  const categories = useMemo(() => [...new Set(flows.map((f) => f.attackType).filter(Boolean))].sort(), [flows])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return flows
      .filter((f) => verdict === 'all' || f.verdict === verdict)
      .filter((f) => category === 'all' || f.attackType === category)
      .filter((f) => protocol === 'all' || protocolBucket(f.protocol) === protocol)
      .filter((f) => !q || [f.srcIp, f.dstIp, f.attackType, f.srcPort, f.dstPort].some((v) => v != null && String(v).toLowerCase().includes(q)))
      .map((f) => ({ ...f, rowId: `${f.analysisId}-${f.index}` }))
  }, [flows, search, verdict, category, protocol])

  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="card-title">Recent Network Flows</h3>
        <div className="flex flex-wrap gap-2">
          <input className="input !py-1.5 text-xs" placeholder="Search IP, port, attack…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input !py-1.5 text-xs" value={verdict} onChange={(e) => setVerdict(e.target.value)}>
            <option value="all">All traffic</option>
            <option value="attack">Suspicious</option>
            <option value="benign">Benign</option>
          </select>
          <select className="input !py-1.5 text-xs" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="input !py-1.5 text-xs" value={protocol} onChange={(e) => setProtocol(e.target.value)}>
            <option value="all">All protocols</option>
            {['TCP', 'UDP', 'ICMP', 'Other'].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <DataTable
        pageSize={10}
        columnPicker
        rows={rows}
        emptyTitle="No flows to show"
        emptyText="Flows appear once a report with flow-level results has been loaded."
        columns={[
          { key: 'n', label: '#', sortable: false, render: (_, i) => i + 1 },
          { key: 'when', label: 'Timestamp', render: (f) => fmtDate(f.when), sortValue: (f) => toDate(f.when)?.getTime() },
          { key: 'srcIp', label: 'Source IP', render: (f) => <span className="font-mono">{f.srcIp ?? '—'}</span> },
          { key: 'dstIp', label: 'Destination IP', render: (f) => <span className="font-mono">{f.dstIp ?? '—'}</span> },
          { key: 'srcPort', label: 'Src Port' },
          { key: 'dstPort', label: 'Dst Port' },
          { key: 'protocol', label: 'Protocol', render: (f) => protocolBucket(f.protocol) ?? '—', sortValue: (f) => protocolBucket(f.protocol) },
          { key: 'verdict', label: 'Prediction', render: (f) => <VerdictBadge verdict={f.verdict} /> },
          { key: 'attackType', label: 'Attack Category', render: (f) => f.attackType ?? '—' },
          { key: 'confidence', label: 'Confidence', render: (f) => fmtPercent(f.confidence) },
          { key: 'actions', label: 'Actions', sortable: false, render: (f) => (
            <button className="text-brand hover:text-bright" onClick={() => onOpen(f)}>View flow</button>
          ) },
        ]}
      />
    </section>
  )
}
