export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({ title, icon: Icon, children, className = '', right }) {
  return (
    <section className={`card p-4 ${className}`}>
      {title && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h3 className="card-title flex items-center gap-2">
            {Icon && <Icon size={15} className="text-brand" />}
            {title}
          </h3>
          {right}
        </header>
      )}
      {children}
    </section>
  )
}

export function KeyValues({ items }) {
  const shown = items.filter(([, v]) => v !== null && v !== undefined && v !== '')
  if (!shown.length) return <p className="text-xs text-muted">Not provided by the backend.</p>
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3">
      {shown.map(([k, v]) => (
        <div key={k}>
          <dt className="text-muted">{k}</dt>
          <dd className="mt-0.5 break-words font-mono text-ink">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
        </div>
      ))}
    </dl>
  )
}

export function RawJson({ data, label = 'Raw response' }) {
  if (data == null) return null
  return (
    <details className="mt-3 rounded-md border border-line bg-panel/50">
      <summary className="cursor-pointer px-3 py-2 text-xs text-muted hover:text-ink">{label}</summary>
      <pre className="max-h-72 overflow-auto px-3 pb-3 font-mono text-[11px] text-muted">{JSON.stringify(data, null, 2)}</pre>
    </details>
  )
}
