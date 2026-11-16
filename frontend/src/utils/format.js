export const fmtNumber = (n) => (n == null || Number.isNaN(n) ? '—' : Number(n).toLocaleString())

export function fmtPercent(c, digits = 1) {
  if (c == null) return '—'
  return `${(c * 100).toFixed(digits)}%`
}

export function toDate(v) {
  if (v == null || v === '') return null
  if (v instanceof Date) return v
  if (typeof v === 'number') return new Date(v < 1e12 ? v * 1000 : v) // seconds vs ms
  const parsed = new Date(v)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function fmtDate(v) {
  const d = toDate(v)
  if (!d) return v ? String(v) : '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtTime(v) {
  const d = toDate(v)
  return d ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
}

export function fmtBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export function fmtDuration(seconds) {
  const s = Number(seconds)
  if (!Number.isFinite(s)) return String(seconds ?? '—')
  if (s < 1) return `${(s * 1000).toFixed(0)} ms`
  if (s < 60) return `${s.toFixed(2)} s`
  const m = Math.floor(s / 60)
  return `${m}m ${Math.round(s % 60)}s`
}

export const titleCase = (s) =>
  String(s ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

export function downloadBlob(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
