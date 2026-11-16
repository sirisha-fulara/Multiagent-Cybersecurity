import { TrendingDown, TrendingUp } from 'lucide-react'

const TONES = {
  green: 'text-brand bg-brand/10 border-brand/20',
  red: 'text-danger bg-danger/10 border-danger/20',
  orange: 'text-warn bg-warn/10 border-warn/20',
  blue: 'text-info bg-info/10 border-info/20',
}

// `trend` is only rendered when the caller has a real comparison to show
export default function StatCard({ icon: Icon, label, value, hint, tone = 'green', trend }) {
  return (
    <div className="card p-4 transition-colors hover:border-brand/40">
      <div className="flex items-start justify-between">
        <p className="text-xs text-muted">{label}</p>
        {Icon && (
          <span className={`rounded-md border p-1.5 ${TONES[tone]}`}>
            <Icon size={15} />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
        {trend != null && (
          <span className={`inline-flex items-center gap-0.5 ${trend >= 0 ? 'text-brand' : 'text-danger'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}%
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  )
}
