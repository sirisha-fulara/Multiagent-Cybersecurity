import { Activity, BookOpen, ClipboardList, Eye, ListChecks, Network, ScrollText } from 'lucide-react'
import { KeyValues, Panel, RawJson } from './PageHeader'
import { SeverityBadge, Tag, VerdictBadge } from './Badges'
import IntelBlock from './IntelBlock'
import { fmtDate, fmtPercent } from '../utils/format'
import { stepsFor } from '../utils/guidance'

function AgentOutput({ out, empty }) {
  if (!out) return <p className="text-xs text-muted">{empty}</p>
  const extra = out.raw && typeof out.raw === 'object' ? Object.entries(out.raw).filter(([, v]) => typeof v !== 'object') : []
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="font-mono text-base">{out.label != null ? String(out.label) : '—'}</span>
        {out.confidence != null && <Tag tone="green">confidence {fmtPercent(out.confidence)}</Tag>}
      </div>
      {extra.length > 0 && <KeyValues items={extra} />}
    </div>
  )
}

function ItemList({ items, empty }) {
  if (!items.length) return <p className="text-xs text-muted">{empty}</p>
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="rounded border border-line bg-panel/50 px-3 py-2 text-[13px]">
          {it.title}
          {it.detail && <span className="mt-0.5 block text-xs text-muted">{it.detail}</span>}
        </li>
      ))}
    </ul>
  )
}

// One flow, laid out the way an analyst would read it: verdict first, then the evidence behind it.
export default function FlowDetail({ flow, guidance = false }) {
  const traffic = [
    ['Source IP', flow.srcIp],
    ['Destination IP', flow.dstIp],
    ['Source port', flow.srcPort],
    ['Destination port', flow.dstPort],
    ['Protocol', flow.protocol],
    ['Timestamp', flow.timestamp ? fmtDate(flow.timestamp) : null],
  ]

  return (
    <div className="space-y-4">
      <div className="card node-bg flex flex-wrap items-center gap-x-6 gap-y-3 p-5">
        <div>
          <p className="label">Final verdict</p>
          <div className="mt-1 flex items-center gap-2">
            <VerdictBadge verdict={flow.verdict} />
            {flow.attackType && <span className="text-base font-medium">{flow.attackType}</span>}
          </div>
        </div>
        <div>
          <p className="label">Severity</p>
          <div className="mt-1"><SeverityBadge level={flow.severity} /></div>
        </div>
        <div>
          <p className="label">Confidence</p>
          <p className="mt-1 font-mono text-sm">{flow.confidence != null ? fmtPercent(flow.confidence) : 'not reported'}</p>
        </div>
        {flow.method && (
          <div>
            <p className="label">Detection method</p>
            <p className="mt-1 text-sm">{String(flow.method)}</p>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Traffic details" icon={Network}>
          <KeyValues items={traffic} />
        </Panel>
        <Panel title="Anomaly detection" icon={Activity}>
          <AgentOutput out={flow.detection} empty="No separate anomaly-detection output was returned." />
        </Panel>
        <Panel title="Attack classification" icon={Eye}>
          <AgentOutput out={flow.classification} empty="No separate classification output was returned." />
        </Panel>
        <Panel title="Rule-based findings" icon={ScrollText}>
          <ItemList items={flow.ruleFindings} empty="No rule-based findings were returned." />
        </Panel>
      </div>

      <Panel title="Evidence & explanation" icon={ClipboardList}>
        <ItemList items={flow.evidence} empty="The backend didn't attach evidence or an explanation to this flow." />
      </Panel>

      <Panel title="Threat intelligence" icon={BookOpen}>
        <IntelBlock intel={flow.intel} />
      </Panel>

      {guidance && (
        <Panel
          title="Recommended investigation steps"
          icon={ListChecks}
          right={<Tag tone="orange">General guidance · not from backend</Tag>}
        >
          <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed">
            {stepsFor(flow.attackType).map((s) => <li key={s}>{s}</li>)}
          </ol>
          <p className="mt-3 text-xs text-muted">
            CYBERSHIELD detects and explains – it doesn't block traffic. These are manual checks for the analyst.
          </p>
        </Panel>
      )}

      <RawJson data={flow.raw} label="Raw flow data from the API" />
    </div>
  )
}
