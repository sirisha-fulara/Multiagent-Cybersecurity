// Small helpers for turning flow arrays into chart data

export function countBy(items, getKey) {
  const out = {}
  for (const item of items) {
    const key = getKey(item)
    if (key == null) continue
    out[key] = (out[key] || 0) + 1
  }
  return out
}

export const toChartRows = (counts) =>
  Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

export function protocolBucket(p) {
  if (p == null || p === '') return null
  const s = String(p).toUpperCase()
  if (s === '6' || s.includes('TCP')) return 'TCP'
  if (s === '17' || s.includes('UDP')) return 'UDP'
  if (s === '1' || s.includes('ICMP')) return 'ICMP'
  return 'Other'
}

// 10 buckets of 10% each, split by verdict
export function confidenceHistogram(flows) {
  const bins = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}–${(i + 1) * 10}%`,
    benign: 0,
    suspicious: 0,
  }))
  for (const f of flows) {
    if (f.confidence == null || f.verdict === 'unknown') continue
    const idx = Math.min(9, Math.floor(f.confidence * 10))
    bins[idx][f.verdict === 'attack' ? 'suspicious' : 'benign'] += 1
  }
  return bins
}
