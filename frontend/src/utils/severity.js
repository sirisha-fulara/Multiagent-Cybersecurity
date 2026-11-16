export const SEVERITY_ORDER = ['high', 'medium', 'low']

export function toSeverity(v) {
  if (v == null) return null
  const s = String(v).toLowerCase()
  if (/crit|high|severe/.test(s)) return 'high'
  if (/med|moder/.test(s)) return 'medium'
  if (/low|info|minor/.test(s)) return 'low'
  return null
}

export const severityRank = (s) => {
  const i = SEVERITY_ORDER.indexOf(s)
  return i === -1 ? 99 : i
}

export function highestSeverity(list) {
  return list.filter(Boolean).sort((a, b) => severityRank(a) - severityRank(b))[0] ?? null
}
