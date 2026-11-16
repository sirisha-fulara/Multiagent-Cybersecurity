import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3 } from 'lucide-react'
import EmptyState from './EmptyState'

function compare(a, b) {
  if (a == null && b == null) return 0
  if (a == null) return 1 // nulls always sink to the bottom
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

/*
  columns: [{ key, label, render?(row), sortValue?(row), defaultHidden?, align? }]
  Sorting and paging happen client-side; filtering is left to the parent.
*/
export default function DataTable({
  columns,
  rows,
  pageSize = 10,
  columnPicker = false,
  initialSort = null,
  emptyTitle = 'No records',
  emptyText,
  onRowClick,
}) {
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState(initialSort)
  const [hidden, setHidden] = useState(() => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)))
  const [pickerOpen, setPickerOpen] = useState(false)

  const visible = columns.filter((c) => !hidden.has(c.key))

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    const get = col.sortValue || ((r) => r[col.key])
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => compare(get(a), get(b)) * dir)
  }, [rows, sort, columns])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))

  // new rows (filter changed, data loaded) -> back to page one
  useEffect(() => setPage(0), [rows])

  const current = Math.min(page, pageCount - 1)
  const slice = sorted.slice(current * pageSize, current * pageSize + pageSize)

  const toggleSort = (col) => {
    if (col.sortable === false) return
    setSort((s) => (s?.key === col.key ? (s.dir === 'asc' ? { key: col.key, dir: 'desc' } : null) : { key: col.key, dir: 'asc' }))
  }

  const toggleColumn = (key) =>
    setHidden((h) => {
      const next = new Set(h)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  return (
    <div>
      {columnPicker && (
        <div className="relative mb-2 flex justify-end">
          <button className="btn btn-ghost !py-1 text-xs" onClick={() => setPickerOpen((o) => !o)}>
            <Columns3 size={14} /> Columns
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
              <div className="absolute right-0 top-9 z-20 w-48 rounded-md border border-line bg-card p-2 shadow-xl">
                {columns.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-panel">
                    <input type="checkbox" className="accent-[#32D583]" checked={!hidden.has(c.key)} onChange={() => toggleColumn(c.key)} />
                    {c.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-max text-left text-xs">
          <thead className="bg-panel text-muted">
            <tr>
              {visible.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c)}
                  className={`whitespace-nowrap px-3 py-2 font-medium ${c.sortable === false ? '' : 'cursor-pointer select-none hover:text-ink'}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr
                key={row.rowId ?? i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-t border-line/70 transition-colors hover:bg-panel/60 ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {visible.map((c) => (
                  <td key={c.key} className="whitespace-nowrap px-3 py-2">
                    {c.render ? c.render(row, current * pageSize + i) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <EmptyState compact title={emptyTitle} text={emptyText} />}
      </div>

      {rows.length > pageSize && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>
            {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} of {sorted.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button className="btn btn-ghost !p-1" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
              <ChevronLeft size={14} />
            </button>
            <span className="px-2">
              {current + 1} / {pageCount}
            </span>
            <button className="btn btn-ghost !p-1" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)} aria-label="Next page">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
