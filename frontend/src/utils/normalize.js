// ---------------------------------------------------------------------------
// Response adapters
//
// Every backend response goes through this file before it reaches a component.
// The key lookups below are deliberately forgiving (snake_case, "Source IP",
// nested agent outputs...).
// ---------------------------------------------------------------------------

import { highestSeverity, toSeverity } from './severity'
import { countBy } from './stats'

export const isObj = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const squash = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
const isEmpty = (v) => v === undefined || v === null || v === ''

// Look up the first matching key.
export function pick(obj, keys, fallback = null) {
  if (!isObj(obj)) return fallback

  for (const k of keys) {
    if (!isEmpty(obj[k])) return obj[k]
  }

  const wanted = keys.map(squash)

  for (const [k, v] of Object.entries(obj)) {
    if (!isEmpty(v) && wanted.includes(squash(k))) return v
  }

  return fallback
}

export const toNum = (v) => {
  if (isEmpty(v) || typeof v === 'boolean') return null

  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function firstArray(obj, preferred = []) {
  if (Array.isArray(obj)) return obj
  if (!isObj(obj)) return null

  for (const k of preferred) {
    if (Array.isArray(obj[k])) return obj[k]
  }

  return Object.values(obj).find(Array.isArray) ?? null
}

function toConfidence(v) {
  const n = toNum(v)

  if (n == null) return null
  if (n > 1 && n <= 100) return n / 100

  return n >= 0 && n <= 1 ? n : null
}

// ---------------------------------------------------------------------------
// Verdict normalization
// "attack" | "benign" | "insufficient" | "unknown"
// ---------------------------------------------------------------------------

export function toVerdict(v) {
  if (typeof v === 'boolean') {
    return v ? 'attack' : 'benign'
  }

  if (typeof v === 'number') {
    return v ? 'attack' : 'benign'
  }

  if (isObj(v)) {
    return toVerdict(
      pick(v, [
        'label',
        'verdict',
        'prediction',
        'result',
        'is_attack',
        'is_anomaly',
        'anomaly',
      ])
    )
  }

  if (typeof v === 'string' && v.trim()) {
    const s = v.toLowerCase().trim()

    if (
      s.includes('insufficient') ||
      s.includes('unknown') ||
      s === 'n/a' ||
      s === 'none' ||
      s === 'pending'
    ) {
      return 'insufficient'
    }

    if (/benign|normal|clean|safe/.test(s)) {
      return 'benign'
    }

    if (
      /attack|malicious|suspicious|anomal|dos|ddos|scan|botnet/.test(s)
    ) {
      return 'attack'
    }

    return 'unknown'
  }

  return 'unknown'
}

// ---------------------------------------------------------------------------
// Convert findings into a consistent array.
// ---------------------------------------------------------------------------

function toItems(v) {
  if (isEmpty(v)) return []

  if (typeof v === 'string') {
    return [{ title: v }]
  }

  if (typeof v === 'number' || typeof v === 'boolean') {
    return [{ title: String(v) }]
  }

  if (Array.isArray(v)) {
    return v.flatMap(toItems)
  }

  if (isObj(v)) {
    const nested = pick(v, [
      'findings',
      'triggered',
      'matches',
      'rules',
      'indicators',
      'items',
    ])

    if (Array.isArray(nested)) return toItems(nested)

    const title = pick(v, [
      'rule',
      'name',
      'title',
      'id',
      'indicator',
      'source',
      'document',
      'file',
    ])

    const detail = pick(v, [
      'description',
      'detail',
      'reason',
      'message',
      'text',
      'content',
      'passage',
    ])

    if (title || detail) {
      return [
        {
          title: title ? String(title) : String(detail),
          detail: title ? detail : null,
        },
      ]
    }

    return Object.entries(v)
      .filter(([, val]) => typeof val !== 'object')
      .map(([k, val]) => ({
        title: `${k}: ${val}`,
      }))
  }

  return []
}

// ---------------------------------------------------------------------------
// Agent output normalization.
// ---------------------------------------------------------------------------

function summariseAgent(v) {
  if (isEmpty(v)) return null

  if (!isObj(v)) {
    return {
      label: String(v),
      confidence: null,
      raw: v,
    }
  }

  return {
    label: pick(v, [
      'label',
      'prediction',
      'result',
      'attack_type',
      'predicted_class',
      'class',
      'verdict',
      'is_anomaly',
      'anomaly',
    ]),

    confidence: toConfidence(
      pick(v, [
        'confidence',
        'probability',
        'score',
        'anomaly_score',
      ])
    ),

    raw: v,
  }
}

// ---------------------------------------------------------------------------
// Threat intelligence normalization.
// ---------------------------------------------------------------------------

export function normalizeIntel(v) {
  if (isEmpty(v)) return null

  if (typeof v === 'string') {
    return {
      category: null,
      description: v,
      impact: null,
      indicators: [],
      mitigation: [],
      sources: [],
      passages: [],
      raw: v,
    }
  }

  if (Array.isArray(v)) {
    const reports = v.filter(isObj).map(normalizeIntel).filter(Boolean)

    if (!reports.length) return null

    return {
      category: reports.map((r) => r.category).filter(Boolean).join(', '),
      description: reports.map((r) => r.description).filter(Boolean).join('\n\n'),
      impact: null,
      indicators: reports.flatMap((r) => r.indicators),
      mitigation: reports.flatMap((r) => r.mitigation),
      sources: reports.flatMap((r) => r.sources),
      passages: reports.flatMap((r) => r.passages),
      raw: v,
    }
  }

  if (!isObj(v)) return null

  // A single report returned directly by the Threat Intelligence Agent.
  const isSingleReport = [
    'analysis',
    'retrieved_context',
    'attack_type',
    'evidence_available',
  ].some((key) => Object.prototype.hasOwnProperty.call(v, key))

  if (isSingleReport) {
    return {
      category: pick(v, [
        'attack_category',
        'category',
        'attack_type',
        'attack',
      ]),
      description: pick(v, [
        'analysis',
        'description',
        'attack_description',
        'summary',
        'overview',
        'answer',
        'explanation',
      ]),
      impact: pick(v, [
        'impact',
        'possible_impact',
        'potential_impact',
      ]),
      indicators: toItems(pick(v, [
        'indicators',
        'iocs',
        'relevant_indicators',
      ])),
      mitigation: toItems(pick(v, [
        'mitigation',
        'mitigations',
        'recommendations',
        'mitigation_recommendations',
      ])),
      sources: toItems(pick(v, [
        'sources',
        'source_documents',
        'documents',
        'references',
        'citations',
      ])),
      passages: toItems(pick(v, [
        'retrieved_context',
        'context',
        'passages',
        'chunks',
        'retrieved_chunks',
      ])),
      raw: v,
    }
  }

  // PCAP reports return intelligence as:
  // { "Port Scan": {...}, "DDoS": {...} }
  const entries = Object.entries(v).filter(([, value]) => isObj(value))

  if (entries.length) {
    const reports = entries
      .map(([category, report]) => ({
        ...normalizeIntel(report),
        category:
          normalizeIntel(report)?.category || category,
      }))
      .filter((report) => report && (report.description || report.passages.length))

    if (reports.length) {
      return {
        category: reports.map((r) => r.category).join(', '),
        description: reports
          .map((r) => `${r.category}\n${r.description || 'No generated analysis returned.'}`)
          .join('\n\n'),
        impact: null,
        indicators: reports.flatMap((r) => r.indicators),
        mitigation: reports.flatMap((r) => r.mitigation),
        sources: reports.flatMap((r) => r.sources),
        passages: reports.flatMap((r) => r.passages),
        raw: v,
      }
    }
  }

  return {
    category: pick(v, ['attack_category', 'category', 'attack_type', 'attack']),
    description: pick(v, [
      'analysis',
      'description',
      'attack_description',
      'summary',
      'overview',
      'answer',
      'explanation',
    ]),
    impact: pick(v, ['impact', 'possible_impact', 'potential_impact']),
    indicators: toItems(pick(v, ['indicators', 'iocs', 'relevant_indicators'])),
    mitigation: toItems(pick(v, [
      'mitigation',
      'mitigations',
      'recommendations',
      'mitigation_recommendations',
    ])),
    sources: toItems(pick(v, [
      'sources',
      'source_documents',
      'documents',
      'references',
      'citations',
    ])),
    passages: toItems(pick(v, [
      'retrieved_context',
      'context',
      'passages',
      'chunks',
      'retrieved_chunks',
    ])),
    raw: v,
  }
}

function toTimestamp(v) {
  return isEmpty(v) ? null : v
}

// ---------------------------------------------------------------------------
// Individual flow normalization.
// ---------------------------------------------------------------------------

export function normalizeFlow(raw, index = 0) {
  const detection = pick(raw, [
    'detection',
    'anomaly_detection',
    'detection_agent',
    'anomaly',
  ])

  const classification = pick(raw, [
    'classification',
    'attack_classification',
    'classification_agent',
    'classifier',
  ])

  const rules = pick(raw, [
    'rule_based',
    'rule_findings',
    'rule_based_findings',
    'rule_analysis',
    'rules',
  ])

  const intel = pick(raw, [
    'threat_intelligence',
    'threat_intel',
    'threat_intelligence_agent',
    'rag',
    'intel',
  ])

  const detectionOut = summariseAgent(detection)
  const classificationOut = summariseAgent(classification)

  // Attack type.
  let attackType = pick(raw, [
    'attack_type',
    'attack_category',
    'attack_name',
    'predicted_attack',
    'attack',
    'predicted_class',
  ])

  if (isObj(attackType)) {
    attackType = summariseAgent(attackType).label
  }

  if (isEmpty(attackType) && classificationOut?.label) {
    attackType = classificationOut.label
  }

  if (isEmpty(attackType)) {
    attackType = pick(raw, ['label', 'class'])
  }

  if (!isEmpty(attackType) && toVerdict(attackType) !== 'attack') {
    attackType = null
  }

  // Final verdict.
  let verdict = toVerdict(
    pick(raw, [
      'final_verdict',
      'verdict',
      'prediction',
      'is_attack',
      'is_malicious',
      'is_suspicious',
    ])
  )

  if (verdict === 'unknown' && detectionOut) {
    verdict = toVerdict(detectionOut.label)
  }

  if (verdict === 'unknown' && attackType) {
    verdict = 'attack'
  }

  if (verdict === 'attack' && isEmpty(attackType)) {
    const v = pick(raw, [
      'final_verdict',
      'verdict',
      'prediction',
    ])

    if (
      typeof v === 'string' &&
      toVerdict(v) === 'attack' &&
      !/attack|malicious|suspicious|anomal/i.test(v)
    ) {
      attackType = v
    }
  }

  const confidence =
    toConfidence(
      pick(raw, [
        'confidence',
        'final_confidence',
        'probability',
      ])
    ) ??
    classificationOut?.confidence ??
    detectionOut?.confidence ??
    null

  return {
    index,

    timestamp: toTimestamp(
      pick(raw, [
        'timestamp',
        'time',
        'detected_at',
        'start_time',
        'flow_start',
      ])
    ),

    srcIp: pick(raw, [
      'src_ip',
      'source_ip',
      'src',
      'source',
      'Source IP',
      'Src IP',
    ]),

    dstIp: pick(raw, [
      'dst_ip',
      'destination_ip',
      'dest_ip',
      'dst',
      'destination',
      'Destination IP',
      'Dst IP',
    ]),

    srcPort: pick(raw, [
      'src_port',
      'source_port',
      'Source Port',
    ]),

    dstPort: pick(raw, [
      'dst_port',
      'destination_port',
      'dest_port',
      'Destination Port',
    ]),

    protocol: pick(raw, [
      'protocol',
      'proto',
      'Protocol',
    ]),

    verdict,

    attackType: isEmpty(attackType)
      ? null
      : String(attackType),

    confidence,

    severity: toSeverity(
      pick(raw, [
        'severity',
        'risk_level',
        'risk',
        'threat_level',
      ])
    ),

    method: pick(raw, [
      'detection_method',
      'method',
      'detected_by',
    ]),

    evidence: toItems(
      pick(raw, [
        'evidence',
        'explanation',
        'reasoning',
        'reasons',
      ])
    ),

    ruleFindings: toItems(rules),

    detection: detectionOut,
    classification: classificationOut,
    intel: normalizeIntel(intel),

    raw,
  }
}

// ---------------------------------------------------------------------------
// Analysis/report normalization.
// ---------------------------------------------------------------------------

export function normalizeAnalysis(
  resp,
  { summaryOnly = false } = {}
) {
  const base = isObj(resp) ? resp : {}
  let body = { ...base }

  // Unwrap nested Flask response structures.
  for (let i = 0; i < 6; i++) {
    const nestedKey = [
      'report',
      'data',
      'result',
      'analysis',
      'flow_analysis',
    ].find((key) => isObj(body[key]))

    if (!nestedKey) break

    const nested = body[nestedKey]

    body = {
      ...body,
      ...nested,
    }

    delete body[nestedKey]
  }

  const summary = pick(body, [
    'summary',
    'stats',
    'statistics',
  ])

  const safeSummary = isObj(summary) ? summary : {}

  const verdictCounts = pick(
    safeSummary,
    ['verdicts'],
    {}
  ) || {}

  const look = (keys) =>
    pick(body, keys) ?? pick(safeSummary, keys)

  const pcapSummary = pick(body, [
    'pcap_summary',
    'pcap_info',
    'capture_summary',
  ])

  // Find flow-level results.
  let rawFlows = firstArray(body, [
    'flows',
    'flow_reports',
    'results',
    'predictions',
    'flow_results',
    'detections',
    'rows',
    'details',
  ])

  if (
    !rawFlows &&
    !summaryOnly &&
    pick(body, [
      'final_verdict',
      'verdict',
      'prediction',
      'is_attack',
    ])
  ) {
    rawFlows = [body]
  }

  // IMPORTANT: Initialize flows before calculating any flow counts.
  const flows = (rawFlows || [])
    .filter(isObj)
    .map((flow, index) => {
      const metadata = isObj(flow.flow_metadata)
        ? flow.flow_metadata
        : {}

      return normalizeFlow(
        {
          ...flow,
          ...metadata,
        },
        index
      )
    })

  // Calculate counts from actual flow-level verdicts.
  const attackFromFlows = flows.filter(
    (flow) => flow.verdict === 'attack'
  ).length

  const benignFromFlows = flows.filter(
    (flow) => flow.verdict === 'benign'
  ).length

  const insufficientFromFlows = flows.filter(
    (flow) => flow.verdict === 'insufficient'
  ).length

  // Backend verdict counts.
  const attackRuleCount =
    toNum(pick(verdictCounts, ['ATTACK (rule)'])) ?? 0

  const attackMlCount =
    toNum(pick(verdictCounts, ['ATTACK (ml)'])) ?? 0

  const attackVerdictCount =
    attackRuleCount + attackMlCount

  const benignVerdictCount = toNum(
    pick(verdictCounts, ['BENIGN'])
  )

  const insufficientVerdictCount = toNum(
    pick(verdictCounts, ['INSUFFICIENT_EVIDENCE'])
  )

  // Total flow count.
  const totalFlows =
    toNum(
      look([
        'total_flows',
        'flow_count',
        'total',
        'num_flows',
        'flows_analyzed',
      ])
    ) ??
    toNum(pick(pcapSummary, ['total_flows'])) ??
    (flows.length || null)

  // Attack count.
  const attackFlows =
    toNum(
      look([
        'attack_flows',
        'malicious_flows',
        'suspicious_flows',
        'attack_count',
        'attacks',
        'anomalies',
      ])
    ) ??
    (attackVerdictCount > 0
      ? attackVerdictCount
      : flows.length
        ? attackFromFlows
        : null)

  // Benign count.
  const benignFlows =
    toNum(
      look([
        'benign_flows',
        'benign_count',
        'normal_flows',
        'benign',
      ])
    ) ??
    benignVerdictCount ??
    (flows.length ? benignFromFlows : null)

  // Insufficient-evidence count.
  const insufficientEvidenceFlows =
    insufficientVerdictCount ??
    (flows.length ? insufficientFromFlows : null)

  // Attack category distribution.
  const countsRaw = look([
    'attack_distribution',
    'attack_categories',
    'attack_counts',
    'category_counts',
    'attack_type_counts',
  ])

  const attackCounts = isObj(countsRaw)
    ? Object.fromEntries(
      Object.entries(countsRaw)
        .filter(([, value]) => toNum(value) != null)
        .map(([key, value]) => [
          key,
          toNum(value),
        ])
    )
    : countBy(
      flows.filter((flow) => flow.attackType),
      (flow) => flow.attackType
    )

  // Severity distribution.
  const severityRaw = look([
    'severity_summary',
    'severity_counts',
    'severity_distribution',
  ])

  const severityCounts = isObj(severityRaw)
    ? Object.fromEntries(
      Object.entries(severityRaw).map(([key, value]) => [
        toSeverity(key) ?? key,
        toNum(value) ?? 0,
      ])
    )
    : null

  const executiveSummary = pick(body, [
    'executive_summary',
    'summary_text',
    'message',
  ])

  return {
    id: pick(body, [
      'analysis_id',
      'id',
      'report_id',
    ]),

    type:
      String(
        pick(body, [
          'analysis_type',
          'type',
          'mode',
        ]) ?? ''
      ).toLowerCase() || null,

    filename: pick(body, [
      'filename',
      'file_name',
      'file',
      'source_file',
    ]),

    createdAt: pick(body, [
      'created_at',
      'timestamp',
      'analyzed_at',
      'date',
      'createdAt',
    ]),

    totalFlows,
    attackFlows,
    benignFlows,
    insufficientEvidenceFlows,
    verdictCounts,

    severity:
      toSeverity(
        pick(body, [
          'severity',
          'overall_severity',
          'max_severity',
        ])
      ) ?? highestSeverity(
        flows.map((flow) => flow.severity)
      ),

    severityCounts,
    attackCounts,
    flows,

    executiveSummary:
      typeof executiveSummary === 'string'
        ? executiveSummary
        : null,

    pcapSummary,

    aggregate: pick(body, [
      'aggregate_detection',
      'aggregate',
      'packet_level_detection',
      'aggregate_analysis',
    ]),

    intel: normalizeIntel(
      pick(body, [
        'threat_intelligence',
        'threat_intel',
        'rag',
      ])
    ),

    timings: pick(body, [
      'agent_timings',
      'timings',
      'execution_times',
      'execution_time',
    ]),

    explainability: pick(body, [
      'explainability',
      'feature_importance',
      'top_features',
      'explanation_features',
    ]),

    limitations: toItems(
      pick(body, [
        'limitations',
        'notes',
        'observations',
      ])
    ),

    raw: resp,
  }
}

// ---------------------------------------------------------------------------
// History normalization.
// ---------------------------------------------------------------------------

export function normalizeHistory(resp) {
  const list = firstArray(resp, [
    'history',
    'analyses',
    'results',
    'items',
    'data',
  ]) || []

  return list
    .filter(isObj)
    .map((item) =>
      normalizeAnalysis(item, {
        summaryOnly: true,
      })
    )
}

// ---------------------------------------------------------------------------
// Health normalization.
// ---------------------------------------------------------------------------

function flatten(obj, prefix = '', out = []) {
  if (isObj(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      flatten(
        v,
        prefix ? `${prefix}.${k}` : k,
        out
      )
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) =>
      flatten(v, `${prefix}.${i}`, out)
    )
  } else {
    out.push([
      prefix.toLowerCase(),
      obj,
    ])
  }

  return out
}

function statusOf(v) {
  if (typeof v === 'boolean') {
    return v ? 'online' : 'offline'
  }

  if (typeof v !== 'string') {
    return 'unknown'
  }

  const s = v.toLowerCase().trim()

  if (
    [
      'ok',
      'healthy',
      'online',
      'up',
      'ready',
      'connected',
      'loaded',
      'running',
      'available',
      'active',
      'success',
      'true',
    ].includes(s)
  ) {
    return 'online'
  }

  if (
    [
      'error',
      'down',
      'offline',
      'failed',
      'unavailable',
      'disconnected',
      'unhealthy',
      'not_loaded',
      'not loaded',
      'missing',
      'false',
    ].includes(s)
  ) {
    return 'offline'
  }

  return 'unknown'
}

// Only reports a component as online/offline if the
// health payload actually says so.
export function normalizeHealth(resp) {
  const body = isObj(resp) ? resp : {}
  const flat = flatten(body)

  const find = (...needles) => {
    const found = flat
      .filter(([path]) =>
        needles.some((n) => path.includes(n))
      )
      .map(([, v]) => statusOf(v))
      .filter((s) => s !== 'unknown')

    if (found.includes('offline')) {
      return 'offline'
    }

    return found.includes('online')
      ? 'online'
      : 'unknown'
  }

  return {
    reachable: true,

    version: pick(body, [
      'version',
      'app_version',
      'api_version',
    ]),

    message: pick(body, [
      'message',
      'error',
    ]),

    components: {
      api: 'online',
      database: find('database', 'postgres', 'neon', 'db'),
      detection: find('checks.detection'),
      classification: find('checks.classification'),
      threatIntel: find('checks.threat_intelligence'),
      rag: find('checks.rag'),
      models: find('checks.models'),
    },

    raw: resp,
  }
}

export const OFFLINE_HEALTH = {
  reachable: false,
  version: null,
  message: null,

  components: {
    api: 'offline',
    database: 'unknown',
    detection: 'unknown',
    classification: 'unknown',
    threatIntel: 'unknown',
    rag: 'unknown',
    models: 'unknown',
  },

  raw: null,
}

// ---------------------------------------------------------------------------
// Lookup a value across several sources (used by PCAP panel).
// ---------------------------------------------------------------------------

export function lookup(sources, keys) {
  for (const s of sources) {
    const v = pick(s, keys)

    if (!isEmpty(v)) {
      return v
    }
  }

  return null
}