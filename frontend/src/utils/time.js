import { toDate } from './format'

export const RANGES = [
  { key: 'hour', label: 'Last Hour', ms: 60 * 60 * 1000 },
  { key: 'day', label: 'Last 24 Hours', ms: 24 * 60 * 60 * 1000 },
  { key: 'week', label: 'Last 7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: 'month', label: 'Last 30 Days', ms: 30 * 24 * 60 * 60 * 1000 },
  { key: 'all', label: 'All time', ms: null },
]

export function inRange(value, rangeKey) {
  const range = RANGES.find((r) => r.key === rangeKey)
  if (!range || range.ms == null) return true
  const d = toDate(value)
  if (!d) return false
  return Date.now() - d.getTime() <= range.ms
}
