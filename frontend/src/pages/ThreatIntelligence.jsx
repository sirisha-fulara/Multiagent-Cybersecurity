import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Library, ShieldQuestion } from 'lucide-react'
import PageHeader, { KeyValues, Panel } from '../components/PageHeader'
import IntelBlock from '../components/IntelBlock'
import EmptyState from '../components/EmptyState'
import { Tag } from '../components/Badges'
import { useAppData } from '../context/AppDataContext'
import { toChartRows, countBy } from '../utils/stats'

// Group flows by attack category so each category gets one intel card plus the traffic that triggered it.
function buildFindings(flows) {
  const map = new Map()
  for (const f of flows) {
    if (f.verdict !== 'attack') continue
    const key = f.intel?.category || f.attackType || 'Uncategorised'
    if (!map.has(key)) map.set(key, { category: key, intel: null, flows: [] })
    const entry = map.get(key)
    entry.flows.push(f)
    if (!entry.intel && f.intel) entry.intel = f.intel
  }
  return [...map.values()].sort((a, b) => b.flows.length - a.flows.length)
}

export default function ThreatIntelligence() {
  const { flows, details } = useAppData()
  const findings = useMemo(() => buildFindings(flows), [flows])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!selected && findings.length) setSelected(findings[0].category)
  }, [findings, selected])

  const current = findings.find((f) => f.category === selected)
  const withIntel = findings.filter((f) => f.intel).length

  // report-level intel (e.g. PCAP aggregate) shown separately
  const reportIntel = Object.values(details).filter((d) => d.intel)

  return (
    <div>
      <PageHeader title="Threat Intelligence" subtitle="Context retrieved by the RAG-based agent for detected attack categories." />

      <div className="mb-4 rounded-md border border-line bg-panel/40 px-4 py-3 text-xs text-muted">
        Everything marked <Tag tone="blue">Retrieved knowledge</Tag> comes from the project's knowledge base via the RAG agent.
        Everything under <Tag tone="green">Observed in traffic</Tag> is read directly from the analysed flows. There is no external live feed.
      </div>

      {findings.length === 0 ? (
        <div className="card">
          <EmptyState icon={ShieldQuestion} title="No attack findings loaded" text="Once an analysis contains flagged flows, their categories and any retrieved intelligence will be listed here.">
            <Link to="/app/analyze" className="btn btn-primary">Analyze traffic</Link>
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <aside className="card h-fit p-2">
            <p className="px-2 py-1.5 text-xs text-muted">{findings.length} categories · {withIntel} with intelligence</p>
            {findings.map((f) => (
              <button
                key={f.category}
                onClick={() => setSelected(f.category)}
                className={`flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm transition-colors ${
                  selected === f.category ? 'bg-brand/10 text-brand' : 'hover:bg-panel'
                }`}
              >
                <span className="truncate">{f.category}</span>
                <span className="font-mono text-xs opacity-70">{f.flows.length}</span>
              </button>
            ))}
          </aside>

          {current && (
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Observed in traffic" icon={Eye} right={<Tag tone="green">Direct evidence</Tag>}>
                <KeyValues
                  items={[
                    ['Category', current.category],
                    ['Flows flagged', current.flows.length],
                    ['Top source IPs', toChartRows(countBy(current.flows, (f) => f.srcIp)).slice(0, 3).map((r) => r.name).join(', ')],
                    ['Top destination IPs', toChartRows(countBy(current.flows, (f) => f.dstIp)).slice(0, 3).map((r) => r.name).join(', ')],
                    ['Destination ports', toChartRows(countBy(current.flows, (f) => f.dstPort)).slice(0, 4).map((r) => r.name).join(', ')],
                  ]}
                />
                {current.flows.some((f) => f.ruleFindings.length) && (
                  <div className="mt-4">
                    <p className="label mb-1.5">Rule findings</p>
                    <ul className="list-disc space-y-1 pl-5 text-[13px]">
                      {[...new Set(current.flows.flatMap((f) => f.ruleFindings.map((r) => r.title)))].slice(0, 6).map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  </div>
                )}
                <Link
                  to={`/app/investigate/${current.flows[0].analysisId}/${current.flows[0].index}`}
                  className="mt-4 inline-block text-xs text-brand hover:text-bright"
                >
                  Open an example flow →
                </Link>
              </Panel>

              <Panel title="Retrieved context" icon={Library}>
                <IntelBlock intel={current.intel} />
              </Panel>
            </div>
          )}
        </div>
      )}

      {reportIntel.length > 0 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-sm font-medium">Report-level intelligence</h2>
          {reportIntel.slice(0, 3).map((r) => (
            <Panel key={r.id} title={r.filename || `Report ${r.id}`}>
              <IntelBlock intel={r.intel} />
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}
