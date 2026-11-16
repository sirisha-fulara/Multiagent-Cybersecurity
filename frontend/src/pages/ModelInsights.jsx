import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Cpu, FlaskConical, Search } from 'lucide-react'
import PageHeader, { Panel } from '../components/PageHeader'
import ChartCard, { axisProps, tooltipStyle } from '../components/ChartCard'
import EmptyState from '../components/EmptyState'
import { Tag } from '../components/Badges'
import { useAppData } from '../context/AppDataContext'
import { isObj, toNum } from '../utils/normalize'
import { fmtPercent } from '../utils/format'
import evaluation from '../data/evaluation.json'

const MODELS = [
  { name: 'Random Forest – anomaly detection', role: 'Flags whether a flow looks abnormal', status: 'Active', tone: 'green' },
  { name: 'Random Forest – attack classification', role: 'Assigns a flagged flow to an attack category', status: 'Active', tone: 'green' },
  { name: 'XGBoost models', role: 'Evaluated during development', status: 'Experimental', tone: 'orange' },
]

const METRICS = [['accuracy', 'Accuracy'], ['precision', 'Precision'], ['recall', 'Recall'], ['f1', 'F1-score']]
const RAG_METRICS = [
  ['faithfulness', 'Faithfulness'],
  ['answerRelevancy', 'Answer Relevancy'],
  ['contextPrecision', 'Context Precision'],
  ['contextRecall', 'Context Recall'],
  ['answerSimilarity', 'Answer Similarity'],
]

function MetricTile({ label, value }) {
  return (
    <div className="rounded-md border border-line bg-panel/60 p-3">
      <p className="label">{label}</p>
      <p className={`mt-1 font-mono text-lg ${value == null ? 'text-muted' : ''}`}>{value == null ? 'Not provided' : fmtPercent(value)}</p>
    </div>
  )
}

function ConfusionMatrix({ data }) {
  const { labels = [], matrix = [] } = data || {}
  if (!matrix.length) return <p className="text-xs text-muted">No confusion matrix provided.</p>
  const max = Math.max(...matrix.flat())
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th className="p-1.5 text-left text-muted">actual ↓ / predicted →</th>
            {labels.map((l) => <th key={l} className="p-1.5 font-medium text-muted">{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <th className="p-1.5 text-left font-medium text-muted">{labels[i] ?? i}</th>
              {row.map((v, j) => (
                <td
                  key={j}
                  className="border border-line p-2 text-center font-mono"
                  style={{ background: `rgba(50,213,131,${max ? (v / max) * 0.45 : 0})` }}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ModelInsights() {
  const { details } = useAppData()

  // explainability only if some loaded report actually carries it
  const explain = useMemo(() => {
    for (const report of Object.values(details)) {
      const e = report.explainability
      if (!e) continue
      const rows = Array.isArray(e)
        ? e.map((x) => (isObj(x) ? [x.feature ?? x.name, toNum(x.importance ?? x.value ?? x.weight)] : [String(x), null]))
        : isObj(e)
          ? Object.entries(e).map(([k, v]) => [k, toNum(v)])
          : []
      const usable = rows.filter(([k, v]) => k && v != null).map(([name, value]) => ({ name, value }))
      if (usable.length) return { reportId: report.id, rows: usable.slice(0, 12) }
    }
    return null
  }, [details])

  const rag = evaluation.rag
  const hasEval = (m) => METRICS.some(([k]) => m[k] != null)

  return (
    <div className="space-y-5">
      <PageHeader title="Model Insights" subtitle="What the models are, how they performed, and what drove a prediction." />

      <Panel title="Model overview" icon={Cpu}>
        <div className="grid gap-3 md:grid-cols-3">
          {MODELS.map((m) => (
            <div key={m.name} className="rounded-md border border-line bg-panel/50 p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{m.name}</p>
                <Tag tone={m.tone}>{m.status}</Tag>
              </div>
              <p className="text-xs text-muted">{m.role}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">XGBoost is not part of the live analysis path, so it isn't shown in analysis results.</p>
      </Panel>

      {['anomaly', 'classification'].map((key) => {
        const m = evaluation.models[key]
        return (
          <Panel key={key} title={`Model evaluation – ${key === 'anomaly' ? 'anomaly detection' : 'attack classification'}`} icon={FlaskConical}>
            {!hasEval(m) && !m.confusionMatrix?.matrix?.length && (
              <p className="mb-3 text-xs text-warn">
                No evaluation results have been supplied yet. Add them to <code className="font-mono">src/data/evaluation.json</code>; the backend has no endpoint for them.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {METRICS.map(([k, label]) => <MetricTile key={k} label={label} value={m[k]} />)}
            </div>
            <div className="mt-4">
              <p className="label mb-2">Confusion matrix</p>
              <ConfusionMatrix data={m.confusionMatrix} />
            </div>
          </Panel>
        )
      })}

      <Panel title="Explainability" icon={Search}>
        {explain ? (
          <ChartCard title={`Feature contributions (report ${explain.reportId})`} subtitle="As returned by the backend" height={280} className="!border-0 !p-0">
            <ResponsiveContainer>
              <BarChart data={explain.rows} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid stroke="#18352A" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" {...axisProps} />
                <YAxis type="category" dataKey="name" width={150} {...axisProps} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" fill="#32D583" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : (
          <EmptyState
            compact
            title="No feature-level explanations available"
            text="None of the loaded reports include feature importance or similar data, so nothing is shown. Evidence and rule findings for each flow are on the investigation page."
          />
        )}
      </Panel>

      <Panel title="RAG evaluation" icon={FlaskConical} right={rag.evaluatedCases != null ? <Tag tone="blue">{rag.evaluatedCases} cases evaluated</Tag> : <Tag>Case count not provided</Tag>}>
        {RAG_METRICS.every(([k]) => rag[k] == null) && (
          <p className="mb-3 text-xs text-warn">Add your RAG evaluation scores to <code className="font-mono">src/data/evaluation.json</code> to show them here.</p>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {RAG_METRICS.map(([k, label]) => <MetricTile key={k} label={label} value={rag[k]} />)}
        </div>
      </Panel>
    </div>
  )
}
