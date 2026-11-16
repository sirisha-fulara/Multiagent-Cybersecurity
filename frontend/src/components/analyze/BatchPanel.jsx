import { useState } from 'react'
import { FileSpreadsheet, Play } from 'lucide-react'
import FileUploader from '../FileUploader'
import UploadStatus from './UploadStatus'
import ResultSummary from '../ResultSummary'
import FlowDetail from '../FlowDetail'
import { useUpload } from '../../hooks/useUpload'
import { useAppData } from '../../context/AppDataContext'
import { analyzeBatch } from '../../services/api'
import { normalizeAnalysis } from '../../utils/normalize'
import { countCsvRows } from '../../utils/csv'
import { useNavigate } from 'react-router-dom'

const MAX_FLOWS = 2000 // backend limit
const MAX_BYTES = 25 * 1024 * 1024 // sanity cap so we don't read a huge file into memory

async function validateCsv(file) {
  if (!/\.csv$/i.test(file.name)) return 'Please choose a .csv file.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_BYTES) return 'That file is larger than 25 MB – far beyond a 2,000 row batch.'
  const rows = countCsvRows(await file.text())
  if (rows === 0) return 'No data rows found (the file needs a header plus at least one row).'
  if (rows > MAX_FLOWS) return `The file has ${rows.toLocaleString()} rows; the backend accepts at most ${MAX_FLOWS.toLocaleString()} flows per batch.`
  return null
}

export default function BatchPanel() {
  const navigate = useNavigate()
  const { addAnalysis, refreshHistory } = useAppData()
  const [selected, setSelected] = useState(null)
  const [analysis, setAnalysis] = useState(null)

  const upload = useUpload({
    send: analyzeBatch,
    validate: validateCsv,
    onSuccess: async (data) => {
      const report = normalizeAnalysis(data)
      addAnalysis(report)
      await refreshHistory()

      if (report.id) {
        navigate(`/app/reports/${report.id}`)
      }
    },
  })

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="mb-1 text-sm font-medium">Batch CSV analysis</h2>
        <p className="mb-4 text-xs text-muted">Upload a CICIDS2017-style CSV with up to {MAX_FLOWS.toLocaleString()} flows.</p>
        <FileUploader
          accept=".csv,text/csv"
          icon={FileSpreadsheet}
          title="Drag & drop a CSV file"
          hint=".csv · max 2,000 flows"
          file={upload.file}
          error={upload.phase === 'failed' ? null : upload.error}
          disabled={upload.running}
          onFile={upload.select}
          onClear={() => {
            upload.clear()
            setAnalysis(null)
          }}
        />
        <div className="mt-4 space-y-3">
          <UploadStatus phase={upload.phase} progress={upload.progress} error={upload.error} doneText="Analysis complete." />
          <button className="btn btn-primary" disabled={!upload.file || upload.running} onClick={upload.run}>
            <Play size={14} /> {upload.running ? 'Analyzing…' : 'Analyze file'}
          </button>
        </div>
      </div>

      {analysis && <ResultSummary analysis={analysis} onSelectFlow={setSelected} />}

      {selected && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">Flow #{selected.index + 1}</h3>
            <button className="text-xs text-muted hover:text-ink" onClick={() => setSelected(null)}>Close</button>
          </div>
          <FlowDetail flow={selected} />
        </div>
      )}
    </div>
  )
}
