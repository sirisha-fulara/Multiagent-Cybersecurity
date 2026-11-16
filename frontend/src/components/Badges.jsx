const SEVERITY = {
  high: 'bg-danger/10 text-danger border-danger/30',
  medium: 'bg-warn/10 text-warn border-warn/30',
  low: 'bg-info/10 text-info border-info/30',
}

export function SeverityBadge({ level }) {
  const style = SEVERITY[level] || 'bg-panel text-muted border-line'
  return <span className={`chip capitalize ${style}`}>{level || 'unrated'}</span>
}

export function VerdictBadge({ verdict }) {
  if (verdict === 'attack') return <span className="chip bg-danger/10 text-danger border-danger/30">Suspicious</span>
  if (verdict === 'benign') return <span className="chip bg-brand/10 text-brand border-brand/30">Benign</span>
  return <span className="chip bg-panel text-muted border-line">Unknown</span>
}

export function Tag({ children, tone = 'muted' }) {
  const tones = {
    muted: 'bg-panel text-muted border-line',
    green: 'bg-brand/10 text-brand border-brand/30',
    blue: 'bg-info/10 text-info border-info/30',
    orange: 'bg-warn/10 text-warn border-warn/30',
  }
  return <span className={`chip ${tones[tone]}`}>{children}</span>
}
