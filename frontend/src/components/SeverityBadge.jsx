const STYLES = {
  high: 'border-danger/40 bg-danger/10 text-danger',
  medium: 'border-warn/40 bg-warn/10 text-warn',
  low: 'border-info/40 bg-info/10 text-info',
}

export default function SeverityBadge({ level, inferred = false }) {
  if (!level) return <span className="text-mute">—</span>
  return (
    <span
      title={inferred ? 'Estimated from confidence – the backend did not send a severity' : undefined}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium capitalize ${STYLES[level]}`}
    >
      {level}
      {inferred && <span className="ml-1 opacity-60">~</span>}
    </span>
  )
}
