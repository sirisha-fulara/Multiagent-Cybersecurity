// Tiny CSV reader – enough for CICIDS-style files (quoted fields, BOM, CRLF).
// Only reads as many rows as asked for so a big file doesn't freeze the tab.

function splitLine(line) {
  const cells = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (ch === ',' && !quoted) {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells
}

export function parseCsv(text, maxRows = 500) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  const headers = splitLine(lines[0] || '').map((h) => h.trim())
  const rows = []
  for (let i = 1; i < lines.length && rows.length < maxRows; i++) {
    if (!lines[i].trim()) continue
    const cells = splitLine(lines[i])
    const row = {}
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return { headers, rows }
}

// quick row count without building objects (header excluded)
export function countCsvRows(text) {
  let n = 0
  const lines = text.split(/\r?\n/)
  for (let i = 1; i < lines.length; i++) if (lines[i].trim()) n++
  return n
}

const escapeCell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers, rows) {
  return [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n')
}
