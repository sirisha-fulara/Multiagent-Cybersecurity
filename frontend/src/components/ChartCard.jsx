import EmptyState from './EmptyState'
import { BarChart3 } from 'lucide-react'

export default function ChartCard({ title, subtitle, actions, empty, emptyText, height = 240, className = '', children }) {
  return (
    <section className={`card p-4 ${className}`}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {empty ? (
        <div style={{ minHeight: height }} className="flex items-center justify-center">
          <EmptyState icon={BarChart3} compact title="Nothing to chart yet" text={emptyText} />
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </section>
  )
}

// shared look for every recharts tooltip
export const tooltipStyle = {
  contentStyle: {
    background: '#0B1713',
    border: '1px solid #18352A',
    borderRadius: 6,
    fontSize: 12,
    color: '#F4F7F5',
  },
  itemStyle: { color: '#F4F7F5' },
  labelStyle: { color: '#9CAFA5' },
  cursor: { fill: 'rgba(50,213,131,0.06)' },
}

export const axisProps = {
  tick: { fill: '#9CAFA5', fontSize: 11 },
  axisLine: { stroke: '#18352A' },
  tickLine: false,
}
