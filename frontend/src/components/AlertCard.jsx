import { Link } from 'react-router-dom'
import { ArrowRight, Crosshair } from 'lucide-react'
import { SeverityBadge } from './Badges'
import { fmtDate, fmtPercent } from '../utils/format'

export default function AlertCard({ alert }) {
  const evidence = alert.evidence[0] || alert.ruleFindings[0]
  return (
    <article className="card p-4 transition-colors hover:border-brand/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Crosshair size={16} className="text-danger" />
          <h3 className="text-sm font-medium">{alert.attackType || 'Suspicious flow'}</h3>
          <SeverityBadge level={alert.severity} />
        </div>
        <span className="text-xs text-muted">{fmtDate(alert.when)}</span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <Field label="Source" value={alert.srcIp} mono />
        <Field label="Destination" value={alert.dstIp} mono />
        <Field label="Detection method" value={alert.method} />
        <Field label="Confidence" value={alert.confidence != null ? fmtPercent(alert.confidence) : null} />
      </dl>

      {evidence && (
        <p className="mt-3 line-clamp-2 rounded border border-line bg-panel/60 px-3 py-2 text-xs text-muted">
          {evidence.title}
          {evidence.detail ? ` – ${evidence.detail}` : ''}
        </p>
      )}

      <div className="mt-3 flex justify-end">
        <Link to={`/app/investigate/${alert.analysisId}/${alert.index}`} className="inline-flex items-center gap-1 text-xs text-brand hover:text-bright">
          Open investigation <ArrowRight size={13} />
        </Link>
      </div>
    </article>
  )
}

function Field({ label, value, mono }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className={`mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</dd>
    </div>
  )
}
