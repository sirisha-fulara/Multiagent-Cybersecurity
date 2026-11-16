const STYLES = {
  online: { dot: 'bg-brand shadow-[0_0_6px_#32D583]', text: 'text-brand', label: 'Online' },
  offline: { dot: 'bg-danger', text: 'text-danger', label: 'Offline' },
  unknown: { dot: 'bg-muted/50', text: 'text-muted', label: 'Not monitored' },
  checking: { dot: 'bg-warn animate-pulse', text: 'text-warn', label: 'Checking…' },
}

export default function StatusIndicator({ status = 'unknown', label, showText = true }) {
  const s = STYLES[status] || STYLES.unknown
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {showText && <span className={`text-xs ${s.text}`}>{label ?? s.label}</span>}
    </span>
  )
}
