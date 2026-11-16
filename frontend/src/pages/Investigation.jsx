import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import FlowDetail from '../components/FlowDetail'
import EmptyState from '../components/EmptyState'
import { useAppData } from '../context/AppDataContext'
import { describeError, getAnalysis } from '../services/api'
import { normalizeAnalysis } from '../utils/normalize'

export default function Investigation() {
  const { analysisId, index } = useParams()
  const { details, addAnalysis } = useAppData()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const report = details[String(analysisId)]

  // deep link or page refresh: pull the report straight from the API
  useEffect(() => {
    if (report) return
    let cancelled = false
    setLoading(true)
    getAnalysis(analysisId)
      .then((data) => {
        if (cancelled) return
        const parsed = normalizeAnalysis(data)
        addAnalysis({ ...parsed, id: parsed.id ?? analysisId })
      })
      .catch((e) => !cancelled && setError(describeError(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [analysisId, report, addAnalysis])

  const flow = report?.flows.find((f) => f.index === Number(index))

  return (
    <div>
      <Link to="/app/alerts" className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
        <ArrowLeft size={13} /> Back to alerts
      </Link>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> Loading report {analysisId}…</p>
      )}
      {error && <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {report && !flow && (
        <div className="card"><EmptyState title="Flow not found" text={`Report ${analysisId} doesn't contain a flow at position ${Number(index) + 1}.`} /></div>
      )}

      {flow && (
        <>
          <PageHeader
            title={flow.attackType ? `Investigation: ${flow.attackType}` : `Flow #${flow.index + 1}`}
            subtitle={`From report ${analysisId}${report.filename ? ` · ${report.filename}` : ''}`}
            actions={<Link to={`/app/reports/${analysisId}`} className="btn btn-ghost">Open full report</Link>}
          />
          <FlowDetail flow={flow} guidance />
        </>
      )}
    </div>
  )
}
