import { Gauge, Radio, ScrollText, Target } from 'lucide-react'
import { KeyValues, Panel, RawJson } from './PageHeader'
import { Tag } from './Badges'
import { lookup } from '../utils/normalize'
import { fmtDuration, fmtNumber } from '../utils/format'

// Each row: label + the key names we accept. Rows with no value in the response are dropped.
const SUMMARY_FIELDS = [
  ['Total packets', ['total_packets', 'packet_count', 'packets'], fmtNumber],
  ['Extracted flows', ['total_flows', 'flow_count', 'flows_extracted', 'num_flows'], fmtNumber],
  ['TCP packets', ['tcp_packets', 'tcp_count', 'tcp'], fmtNumber],
  ['UDP packets', ['udp_packets', 'udp_count', 'udp'], fmtNumber],
  ['Capture duration', ['capture_duration', 'duration', 'duration_seconds'], fmtDuration],
]

const AGGREGATE_FIELDS = [
  [
    'Potential attack pattern',
    ['assessment', 'attack_pattern', 'potential_attack', 'pattern', 'attack_type'],
  ],
  [
    'Packet rate',
    ['syn_ack_packets_per_second', 'packet_rate', 'packets_per_second', 'pps'],
  ],
  [
    'SYN-ACK statistics',
    ['syn_ack_packets', 'syn_ack_stats', 'syn_ack_count', 'synack_packets'],
  ],
  [
    'Unique source IPs',
    ['unique_source_ips', 'unique_src_ips', 'unique_sources', 'source_ip_count'],
  ],
  [
    'Target IP',
    ['top_destination_ip', 'target_ip', 'victim_ip', 'destination_ip', 'top_destination'],
  ],
]

const show = (v) => (typeof v === 'object' ? JSON.stringify(v) : v)

export default function PcapPanel({ analysis }) {
  const sources = [analysis.pcapSummary, analysis.aggregate, analysis.raw]

  const summary = SUMMARY_FIELDS.map(([label, keys, fmt]) => {
    const v = lookup(sources, keys)
    return [label, v == null ? null : fmt(v)]
  })

  const aggregate = AGGREGATE_FIELDS.map(([label, keys]) => [label, show(lookup([analysis.aggregate, analysis.raw], keys))])
  const indicators = lookup([analysis.aggregate, analysis.raw], ['triggered_indicators', 'indicators', 'triggers', 'rules_triggered'])
  const indicatorList = Array.isArray(indicators) ? indicators : indicators ? [indicators] : []

  // rule findings across flows, de-duplicated – kept apart from the ML output below
  const ruleHits = [...new Set(analysis.flows.flatMap((f) => f.ruleFindings.map((r) => r.title)))]
  const mlCounts = analysis.attackCounts || {}

  return (
    <div className="space-y-4">
      <Panel title="PCAP summary" icon={Radio}>
        <KeyValues items={summary} />
      </Panel>

      <Panel
        title="Aggregate detection"
        icon={Gauge}
        right={<Tag tone="blue">Packet-level · separate from ML</Tag>}
      >
        <KeyValues items={aggregate} />
        {indicatorList.length > 0 && (
          <div className="mt-4">
            <p className="label mb-1.5">Triggered indicators</p>
            <div className="flex flex-wrap gap-2">
              {indicatorList.map((i, n) => (
                <Tag key={n} tone="orange">{typeof i === 'object' ? JSON.stringify(i) : String(i)}</Tag>
              ))}
            </div>
          </div>
        )}
        <RawJson data={analysis.aggregate} label="Full aggregate object" />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Rule-based findings" icon={ScrollText} right={<Tag tone="orange">Rules</Tag>}>
          {ruleHits.length ? (
            <ul className="list-disc space-y-1 pl-5 text-[13px]">{ruleHits.map((r) => <li key={r}>{r}</li>)}</ul>
          ) : (
            <p className="text-xs text-muted">No flow-level rule findings were returned.</p>
          )}
        </Panel>
        <Panel title="ML classifications" icon={Target} right={<Tag tone="green">Model</Tag>}>
          {Object.keys(mlCounts).length ? (
            <ul className="space-y-1 text-[13px]">
              {Object.entries(mlCounts).map(([k, v]) => (
                <li key={k} className="flex justify-between"><span>{k}</span><span className="font-mono">{fmtNumber(v)}</span></li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">No ML attack classifications were returned.</p>
          )}
        </Panel>
      </div>
    </div>
  )
}
