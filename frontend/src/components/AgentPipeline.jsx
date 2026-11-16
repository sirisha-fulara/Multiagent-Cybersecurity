import { Brain, Network, ScanSearch, Workflow } from 'lucide-react'
import StatusIndicator from './StatusIndicator'
import { pick } from '../utils/normalize'

const AGENTS = [
  { id: 'detection', name: 'Detection Agent', icon: ScanSearch, healthKey: 'detection', timeKeys: ['detection', 'detection_agent', 'anomaly'] },
  { id: 'classification', name: 'Classification Agent', icon: Network, healthKey: 'classification', timeKeys: ['classification', 'classification_agent', 'classifier'] },
  { id: 'intel', name: 'Threat Intelligence Agent', icon: Brain, healthKey: 'threatIntel', timeKeys: ['threat_intelligence', 'threat_intel', 'rag', 'intel'] },
  { id: 'coordinator', name: 'Coordinator Agent', icon: Workflow, healthKey: null, timeKeys: ['coordinator', 'coordinator_agent', 'total'] },
]

// Output lines come from the most recent loaded report – nothing is shown unless the data backs it.
function outputFor(id, report) {
  if (!report) return null
  const flows = report.flows
  if (id === 'detection' && flows.length) {
    const flagged = flows.filter((f) => f.detection && f.verdict === 'attack').length
    return flows.some((f) => f.detection) ? `${flagged.toLocaleString()} of ${flows.length.toLocaleString()} flows flagged` : null
  }
  if (id === 'classification') {
    const n = Object.keys(report.attackCounts || {}).length
    return n ? `${n} attack categor${n === 1 ? 'y' : 'ies'} reported` : null
  }
  if (id === 'intel') {
    const n = flows.filter((f) => f.intel).length + (report.intel ? 1 : 0)
    return n ? `${n} intelligence finding${n === 1 ? '' : 's'}` : null
  }
  if (id === 'coordinator') return report.id != null ? `Report ${report.id}` : null
  return null
}

export default function AgentPipeline({ health, report }) {
  return (
    <section className="card p-4">
      <h3 className="card-title">Agent Pipeline Status</h3>
      <p className="mb-3 text-xs text-muted">
        {report ? `Output from latest loaded report${report.id != null ? ` (${report.id})` : ''}` : 'No analysis loaded yet'}
      </p>
      <ol className="relative space-y-3">
        {AGENTS.map((agent, i) => {
          const status = agent.healthKey ? (health?.components?.[agent.healthKey] ?? 'unknown') : 'unknown'
          const timing = report?.timings ? pick(report.timings, agent.timeKeys) : null
          const output = outputFor(agent.id, report)
          const Icon = agent.icon
          return (
            <li key={agent.id} className="relative flex gap-3">
              {i < AGENTS.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-8px)] w-px bg-line" />}
              <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-panel text-brand">
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm">{agent.name}</p>
                  <StatusIndicator status={status} />
                </div>
                <p className="text-xs text-muted">
                  Execution time: {typeof timing === 'number' || typeof timing === 'string' ? timing : 'not reported'}
                </p>
                {output && <p className="text-xs text-brand/90">{output}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
