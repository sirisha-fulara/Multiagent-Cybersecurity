import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowLeft, BookOpen, Download, FileText, Layers, Loader2, ScrollText, Server, Target } from 'lucide-react'
import PageHeader, { KeyValues, Panel, RawJson } from '../components/PageHeader'
import ChartCard, { axisProps, tooltipStyle } from '../components/ChartCard'
import DataTable from '../components/DataTable'
import IntelBlock from '../components/IntelBlock'
import PcapPanel from '../components/PcapPanel'
import EmptyState from '../components/EmptyState'
import { SeverityBadge, Tag, VerdictBadge } from '../components/Badges'
import { useAppData } from '../context/AppDataContext'
import { describeError, getAnalysis } from '../services/api'
import { normalizeAnalysis } from '../utils/normalize'
import { countBy, toChartRows } from '../utils/stats'
import { downloadBlob, fmtDate, fmtNumber, fmtPercent, titleCase } from '../utils/format'

const topN = (counts, n = 5) => toChartRows(counts).slice(0, n)

export default function AnalysisDetails() {
  const { id } = useParams()
  const { details, addAnalysis } = useAppData()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const report = details[String(id)]

  useEffect(() => {
    if (report) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getAnalysis(id)
      .then((data) => {
        if (cancelled) return
        const parsed = normalizeAnalysis(data)
        addAnalysis({ ...parsed, id: parsed.id ?? id })
      })
      .catch((e) => !cancelled && setError(describeError(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id, report, addAnalysis])

  const stats = useMemo(() => {
    if (!report) return null
    const attacks = report.flows.filter((f) => f.verdict === 'attack')
    const confs = report.flows.map((f) => f.confidence).filter((c) => c != null)
    const rules = countBy(report.flows.flatMap((f) => f.ruleFindings), (r) => r.title)
    const intelByCategory = new Map()
    for (const f of report.flows) {
      const key = f.intel?.category || f.attackType
      if (f.intel && key && !intelByCategory.has(key)) intelByCategory.set(key, f.intel)
    }
    return {
      attacks,
      srcs: topN(countBy(attacks, (f) => f.srcIp)),
      dsts: topN(countBy(attacks, (f) => f.dstIp)),
      ports: topN(countBy(attacks, (f) => f.dstPort)),
      rules: topN(rules, 8),
      avgConfidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null,
      withoutConfidence: report.flows.length - confs.length,
      intelByCategory: [...intelByCategory.entries()],
      categories: toChartRows(report.attackCounts || {}),

    }
  }, [report])

  if (loading || (!report && !error)) {
    return <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> Loading report {id}…</p>
  }
  if (error) {
    return (
      <div className="space-y-3">
        <BackLink />
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-3 text-sm text-danger">{error}</p>
      </div>
    )
  }

  // a sentence built from the real numbers – used when the API doesn't send its own summary
  const autoSummary =
    report.totalFlows != null
      ? `${fmtNumber(report.totalFlows)} flows were analysed. ${fmtNumber(report.attackFlows ?? 0)} were flagged as suspicious` +
      `${stats.categories.length ? ` across ${stats.categories.length} attack categor${stats.categories.length === 1 ? 'y' : 'ies'}` : ''}` +
      ` and ${fmtNumber(report.benignFlows ?? 0)} were classified as benign.`
      : null

  return (
    <div className="space-y-4">
      <BackLink />
      <PageHeader
        title={report.filename || `Analysis ${report.id}`}
        subtitle={`Report ${report.id}${report.createdAt ? ` · ${fmtDate(report.createdAt)}` : ''}`}
        actions={
          <button className="btn btn-ghost" onClick={() => downloadBlob(`cybershield-report-${report.id}.json`, JSON.stringify(report.raw, null, 2))}>
            <Download size={14} /> Download JSON
          </button>
        }
      />

      <Panel title="Executive summary" icon={FileText}>
        <p className="text-sm leading-relaxed">{report.executiveSummary || autoSummary || 'The backend returned no summary figures for this report.'}</p>
      </Panel>

      <Panel title="Analysis overview" icon={Layers}>
        <KeyValues
          items={[
            ['Analysis ID', report.id],
            ['Type', report.type ? titleCase(report.type) : null],
            ['Filename', report.filename],
            ['Date & time', report.createdAt ? fmtDate(report.createdAt) : null],
            ['Total flows', report.totalFlows != null ? fmtNumber(report.totalFlows) : null],
            ['Attack flows', report.attackFlows != null ? fmtNumber(report.attackFlows) : null],
            ['Benign flows', report.benignFlows != null ? fmtNumber(report.benignFlows) : null],
            [
              'Insufficient-evidence flows',
              fmtNumber(report.insufficientEvidenceFlows ?? 0),
            ],
          ]}
        />
        {report.severity && <div className="mt-3 flex items-center gap-2 text-xs text-muted">Overall severity <SeverityBadge level={report.severity} /></div>}
      </Panel>

      {report.type === 'pcap' && <PcapPanel analysis={report} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Attack distribution" empty={!stats.categories.length} emptyText="No attack categories in this report." height={220}>
          <ResponsiveContainer>
            <BarChart data={stats.categories.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke="#18352A" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" {...axisProps} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={110} {...axisProps} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="value" fill="#32D583" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Panel title="Source & destination (suspicious flows)" icon={Server}>
          {stats.attacks.length ? (
            <div className="grid grid-cols-3 gap-4 text-xs">
              <Ranking title="Top sources" rows={stats.srcs} mono />
              <Ranking title="Top destinations" rows={stats.dsts} mono />
              <Ranking title="Top dest. ports" rows={stats.ports} mono />
            </div>
          ) : (
            <p className="text-xs text-muted">No suspicious flows with address information.</p>
          )}
        </Panel>
      </div>

      <Panel title="Detection findings" icon={AlertTriangle}>
        <DataTable
          rows={report.flows.filter((f) => f.verdict === 'attack').map((f) => ({ ...f, rowId: f.index }))}
          pageSize={8}
          emptyTitle="No suspicious flows"
          emptyText="Nothing in this report was flagged as an attack."
          columns={[
            { key: 'n', label: '#', render: (f) => f.index + 1, sortValue: (f) => f.index },
            { key: 'attackType', label: 'Attack', render: (f) => f.attackType ?? '—' },
            { key: 'srcIp', label: 'Source', render: (f) => <span className="font-mono">{f.srcIp ?? '—'}</span> },
            { key: 'dstIp', label: 'Destination', render: (f) => <span className="font-mono">{f.dstIp ?? '—'}</span> },
            { key: 'confidence', label: 'Confidence', render: (f) => fmtPercent(f.confidence) },
            { key: 'severity', label: 'Severity', render: (f) => <SeverityBadge level={f.severity} /> },
            { key: 'go', label: '', sortable: false, render: (f) => <Link className="text-brand hover:text-bright" to={`/app/investigate/${report.id}/${f.index}`}>Investigate</Link> },
          ]}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Model results" icon={Target}>
          <KeyValues
            items={[
              ['Flows with a verdict', report.flows.filter((f) => f.verdict !== 'unknown').length || null],
              ['Mean confidence', stats.avgConfidence != null ? fmtPercent(stats.avgConfidence) : null],
              ['Flows without confidence', report.flows.length ? stats.withoutConfidence : null],
              [
                'Insufficient-evidence flows',
                fmtNumber(report.insufficientEvidenceFlows ?? 0),
              ],
            ]}
          />
        </Panel>
        <Panel title="Rule-based evidence" icon={ScrollText}>
          {stats.rules.length ? (
            <ul className="space-y-1.5 text-[13px]">
              {stats.rules.map((r) => (
                <li key={r.name} className="flex justify-between gap-3"><span>{r.name}</span><span className="font-mono text-muted">×{r.value}</span></li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">No rule findings were returned.</p>
          )}
        </Panel>
      </div>

      <Panel title="Threat intelligence context" icon={BookOpen}>
        {report.intel || stats.intelByCategory.length ? (
          <div className="space-y-6">
            {report.intel && <IntelBlock intel={report.intel} />}
            {stats.intelByCategory.map(([category, intel]) => (
              <div key={category} className="border-t border-line pt-4">
                <p className="mb-2 text-sm font-medium">{category}</p>
                <IntelBlock intel={intel} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState compact title="No threat intelligence" text="This report doesn't include retrieved knowledge." />
        )}
      </Panel>

      <Panel title="Limitations & observations" icon={AlertTriangle}>
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-muted">
          {report.limitations.map((l, i) => <li key={i}>{l.title}</li>)}
          <li>Results are model predictions and rule matches, not confirmed incidents – verify against host and network logs.</li>
          {stats.withoutConfidence > 0 && report.flows.length > 0 && <li>{stats.withoutConfidence} flow(s) came back without a confidence score.</li>}
          {report.flows.length === 0 && <li>The report contains summary figures only – no per-flow results were stored.</li>}
        </ul>
      </Panel>

      <RawJson data={report.raw} label="Full API response" />
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/app/reports" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
      <ArrowLeft size={13} /> Back to reports
    </Link>
  )
}

function Ranking({ title, rows, mono }) {
  return (
    <div>
      <p className="label mb-1.5">{title}</p>
      {rows.length ? (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.name} className="flex justify-between gap-2">
              <span className={`truncate ${mono ? 'font-mono' : ''}`}>{r.name}</span>
              <span className="text-muted">{r.value}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">—</p>}
    </div>
  )
}
