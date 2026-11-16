import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, FileJson, FileSpreadsheet, Layers, ShieldAlert, ShieldCheck, Waypoints } from 'lucide-react'
import StatCard from './StatCard'
import ChartCard, { axisProps, tooltipStyle } from './ChartCard'
import DataTable from './DataTable'
import { SeverityBadge, VerdictBadge } from './Badges'
import { downloadBlob, fmtNumber, fmtPercent } from '../utils/format'
import { toCsv } from '../utils/csv'
import { toChartRows } from '../utils/stats'

// Shared summary for batch and PCAP results: counts, severity, attack mix and the flow table.
export default function ResultSummary({ analysis, onSelectFlow }) {
  const categories = useMemo(() => toChartRows(analysis.attackCounts || {}), [analysis])
  const rows = useMemo(() => analysis.flows.map((f) => ({ ...f, rowId: f.index })), [analysis])

  const exportJson = () =>
    downloadBlob(`cybershield-${analysis.id ?? 'analysis'}.json`, JSON.stringify(analysis.raw, null, 2))

  const exportCsv = () => {
    const headers = ['#', 'Source IP', 'Destination IP', 'Source Port', 'Destination Port', 'Protocol', 'Prediction', 'Attack Category', 'Confidence', 'Severity']
    const body = analysis.flows.map((f) => [f.index + 1, f.srcIp, f.dstIp, f.srcPort, f.dstPort, f.protocol, f.verdict, f.attackType, f.confidence, f.severity])
    downloadBlob(`cybershield-${analysis.id ?? 'analysis'}.csv`, toCsv(headers, body), 'text/csv')
  }

  const sev = analysis.severityCounts
    ? Object.entries(analysis.severityCounts)
    : ['high', 'medium', 'low']
        .map((s) => [s, analysis.flows.filter((f) => f.severity === s).length])
        .filter(([, n]) => n > 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Results{analysis.filename ? ` · ${analysis.filename}` : ''}</h3>
        <div className="flex flex-wrap gap-2">
          {analysis.id != null && (
            <Link to={`/app/reports/${analysis.id}`} className="btn btn-primary !py-1.5 text-xs">Open full report</Link>
          )}
          <button className="btn btn-ghost !py-1.5 text-xs" onClick={exportJson}><FileJson size={14} /> JSON</button>
          {analysis.flows.length > 0 && (
            <button className="btn btn-ghost !py-1.5 text-xs" onClick={exportCsv}><FileSpreadsheet size={14} /> CSV</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Waypoints} label="Flows processed" value={fmtNumber(analysis.totalFlows)} />
        <StatCard icon={ShieldCheck} label="Benign" value={fmtNumber(analysis.benignFlows)} />
        <StatCard icon={ShieldAlert} tone="red" label="Suspicious" value={fmtNumber(analysis.attackFlows)} />
        <StatCard icon={Layers} tone="blue" label="Attack categories" value={categories.length || '—'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="card-title mb-3">Severity summary</h3>
          {sev.length ? (
            <div className="flex flex-wrap gap-3">
              {sev.map(([level, n]) => (
                <div key={level} className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2">
                  <SeverityBadge level={level} />
                  <span className="font-mono text-sm">{fmtNumber(n)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">The backend didn't report severity for this analysis.</p>
          )}
        </div>

        <ChartCard title="Attack categories" empty={!categories.length} emptyText="No attack categories in this result." height={160}>
          <ResponsiveContainer>
            <BarChart data={categories.slice(0, 6)} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke="#18352A" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" {...axisProps} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={100} {...axisProps} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="value" fill="#32D583" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="card p-4">
        <h3 className="card-title mb-3">Flow results</h3>
        <DataTable
          rows={rows}
          pageSize={10}
          columnPicker
          emptyTitle="No per-flow results returned"
          emptyText="The response only contained summary figures."
          onRowClick={onSelectFlow}
          columns={[
            { key: 'n', label: '#', render: (f) => f.index + 1, sortValue: (f) => f.index },
            { key: 'srcIp', label: 'Source IP', render: (f) => <span className="font-mono">{f.srcIp ?? '—'}</span> },
            { key: 'dstIp', label: 'Destination IP', render: (f) => <span className="font-mono">{f.dstIp ?? '—'}</span> },
            { key: 'dstPort', label: 'Dst Port' },
            { key: 'verdict', label: 'Prediction', render: (f) => <VerdictBadge verdict={f.verdict} /> },
            { key: 'attackType', label: 'Attack Category', render: (f) => f.attackType ?? '—' },
            { key: 'confidence', label: 'Confidence', render: (f) => fmtPercent(f.confidence) },
            { key: 'severity', label: 'Severity', render: (f) => <SeverityBadge level={f.severity} /> },
          ]}
        />
        {onSelectFlow && rows.length > 0 && <p className="mt-2 text-xs text-muted">Click a row to see the full breakdown.</p>}
      </div>
    </div>
  )
}
