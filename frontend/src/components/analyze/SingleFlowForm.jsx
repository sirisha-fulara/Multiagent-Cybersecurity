import { useMemo, useRef, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Eraser, FileSpreadsheet, Loader2, Send } from 'lucide-react'
import FlowDetail from '../FlowDetail'
import { Panel } from '../PageHeader'
import { useAppData } from '../../context/AppDataContext'
import { analyzeFlow, describeError } from '../../services/api'
import { normalizeAnalysis } from '../../utils/normalize'
import { parseCsv } from '../../utils/csv'
import { ALL_FEATURES, FEATURE_GROUPS, squash } from '../../utils/features'
import { useNavigate } from 'react-router-dom'
import usePersistentState from '../../hooks/usePersistentState'

// returns an error message, or null if the value is fine
function checkValue(raw) {
  if (raw === undefined || String(raw).trim() === '') return 'Required'
  return Number.isFinite(Number(raw)) ? null : 'Must be a finite number'
}

export default function SingleFlowForm() {
  const { addAnalysis, refreshHistory } = useAppData()
  const [values, setValues] = usePersistentState(
    'cybershield-single-flow-values',
    {},
  )

  const [step, setStep] = usePersistentState(
    'cybershield-single-flow-step',
    0,
  )
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [result, setResult] = useState(null)

  const [csvRows, setCsvRows] = useState([])
  const [csvInfo, setCsvInfo] = useState(null)
  const submitLock = useRef(false)
  const navigate = useNavigate()

  const group = FEATURE_GROUPS[step]
  const filled = ALL_FEATURES.filter((f) => String(values[f] ?? '').trim() !== '').length

  const groupErrorCount = useMemo(
    () => FEATURE_GROUPS.map((g) => g.fields.filter((f) => errors[f]).length),
    [errors],
  )

  const setValue = (name, v) => {
    setValues((prev) => ({ ...prev, [name]: v }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: checkValue(v) }))
  }

  const loadCsv = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const { headers, rows } = parseCsv(await file.text(), 500)
    const matched = ALL_FEATURES.filter((f) => headers.some((h) => squash(h) === squash(f))).length
    setCsvRows(rows)
    setCsvInfo({ name: file.name, headers, matched, total: rows.length })
  }

  const applyRow = (idx) => {
    const row = csvRows[Number(idx)]
    if (!row) return
    const next = {}
    for (const feature of ALL_FEATURES) {
      const header = Object.keys(row).find((h) => squash(h) === squash(feature))
      if (header !== undefined) next[feature] = row[header]
    }
    setValues(next)
    setErrors({})
    setResult(null)
  }

  const fillZeros = () => {
    setValues((prev) => Object.fromEntries(ALL_FEATURES.map((f) => [f, String(prev[f] ?? '').trim() === '' ? '0' : prev[f]])))
  }

  const reset = () => {
    setValues({})
    setErrors({})
    setResult(null)
    setApiError(null)
    setStep(0)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (submitLock.current) return
    const found = {}
    for (const f of ALL_FEATURES) {
      const msg = checkValue(values[f])
      if (msg) found[f] = msg
    }
    setErrors(found)
    if (Object.keys(found).length) {
      // take the analyst to the first section that needs attention
      const firstBad = FEATURE_GROUPS.findIndex((g) => g.fields.some((f) => found[f]))
      setStep(firstBad)
      return
    }

    submitLock.current = true
    setSubmitting(true)
    setApiError(null)
    try {
      const payload = Object.fromEntries(ALL_FEATURES.map((f) => [f, Number(values[f])]))
      const data = await analyzeFlow(payload)

      const report = normalizeAnalysis(data)

      addAnalysis(report)
      await refreshHistory()

      if (report.id) {
        navigate(`/app/reports/${report.id}`)
      } else {
        setApiError('Analysis completed, but the server did not return an analysis ID.')
      }
    } catch (err) {
      setApiError(describeError(err))
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Panel
        title="Load values from a CSV row"
        icon={FileSpreadsheet}
        right={<span className="text-xs text-muted">optional</span>}
      >
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="btn btn-ghost cursor-pointer">
            Choose CSV
            <input type="file" accept=".csv" hidden onChange={loadCsv} />
          </label>
          {csvInfo && (
            <>
              <span className="text-xs text-muted">
                {csvInfo.name} · {csvInfo.total} rows read · {csvInfo.matched}/{ALL_FEATURES.length} feature columns matched
              </span>
              <select className="input !py-1.5 text-xs" defaultValue="" onChange={(e) => e.target.value !== '' && applyRow(e.target.value)}>
                <option value="">Select a row…</option>
                {csvRows.map((r, i) => (
                  <option key={i} value={i}>
                    Row {i + 1}{r.Label ? ` – ${r.Label}` : ''}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </Panel>

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">{group.title}</h2>
            <p className="text-xs text-muted">{group.description}</p>
          </div>
          <span className="text-xs text-muted">{filled} / {ALL_FEATURES.length} features filled</span>
        </div>

        <div className="mb-5 flex flex-wrap gap-1.5">
          {FEATURE_GROUPS.map((g, i) => (
            <button
              type="button"
              key={g.id}
              onClick={() => setStep(i)}
              className={`chip transition-colors ${i === step ? 'border-brand bg-brand/15 text-brand' : groupErrorCount[i] ? 'border-danger/40 text-danger' : 'border-line text-muted hover:text-ink'
                }`}
            >
              {g.title}
              {groupErrorCount[i] > 0 && ` (${groupErrorCount[i]})`}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {group.fields.map((name) => (
            <label key={name} className="block">
              <span className="label">{name}</span>
              <input
                className={`input mt-1 w-full font-mono ${errors[name] ? '!border-danger/70' : ''}`}
                inputMode="decimal"
                value={values[name] ?? ''}
                onChange={(e) => setValue(name, e.target.value)}
                placeholder="0"
              />
              {errors[name] && <span className="mt-1 flex items-center gap-1 text-[11px] text-danger"><AlertCircle size={11} />{errors[name]}</span>}
            </label>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
              <ChevronLeft size={14} /> Back
            </button>
            <button type="button" className="btn btn-ghost" disabled={step === FEATURE_GROUPS.length - 1} onClick={() => setStep(step + 1)}>
              Next <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={fillZeros} title="Sets every empty field to 0">
              Fill empty with 0
            </button>
            <button type="button" className="btn btn-ghost" onClick={reset}><Eraser size={14} /> Clear</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Analyze flow
            </button>
          </div>
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {Object.keys(errors).length} field(s) need attention – sections with problems are marked in red.
        </p>
      )}
      {apiError && <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{apiError}</p>}

      {result && (
        <div>
          <h3 className="mb-3 text-sm font-medium">Analysis result</h3>
          {result.flows[0] ? <FlowDetail flow={result.flows[0]} /> : <p className="text-xs text-muted">The API returned no flow-level result.</p>}
        </div>
      )}
    </form>
  )
}
