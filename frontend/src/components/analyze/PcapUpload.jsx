import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileArchive, Play } from 'lucide-react'
import FileUploader from '../FileUploader'
import UploadStatus from './UploadStatus'
import PcapPanel from '../PcapPanel'
import ResultSummary from '../ResultSummary'
import FlowDetail from '../FlowDetail'
import { useUpload } from '../../hooks/useUpload'
import { useAppData } from '../../context/AppDataContext'
import { analyzePcap } from '../../services/api'
import { normalizeAnalysis } from '../../utils/normalize'
import { useNavigate } from 'react-router-dom'

const validatePcap = async (file) => {
  if (!/\.(pcap|pcapng)$/i.test(file.name)) return 'Only .pcap and .pcapng captures are supported.'
  if (file.size === 0) return 'That file is empty.'
  return null
}

export default function PcapUpload() {
  const { addAnalysis, refreshHistory } = useAppData()
  const [analysis, setAnalysis] = useState(null)
  const [selected, setSelected] = useState(null)
  const navigate = useNavigate()

  const upload = useUpload({
    send: analyzePcap,
    validate: validatePcap,
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
        <h2 className="mb-1 text-sm font-medium">PCAP / PCAPNG analysis</h2>
        <p className="mb-4 text-xs text-muted">
          The capture is sent to the backend, converted to flows and analysed. Larger files can take a while.
        </p>
        <FileUploader
          accept=".pcap,.pcapng"
          icon={FileArchive}
          title="Drag & drop a packet capture"
          hint=".pcap · .pcapng"
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
          <UploadStatus phase={upload.phase} progress={upload.progress} error={upload.error} doneText="Capture analysed." />
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" disabled={!upload.file || upload.running} onClick={upload.run}>
              <Play size={14} /> {upload.running ? 'Processing…' : 'Analyze capture'}
            </button>
            {analysis?.id != null && (
              <Link to={`/app/reports/${analysis.id}`} className="btn btn-ghost">Open complete report</Link>
            )}
          </div>
        </div>
      </div>

      {analysis && (
        <>
          <PcapPanel analysis={analysis} />
          <ResultSummary analysis={analysis} onSelectFlow={setSelected} />
          {selected && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">Flow #{selected.index + 1}</h3>
                <button className="text-xs text-muted hover:text-ink" onClick={() => setSelected(null)}>Close</button>
              </div>
              <FlowDetail flow={selected} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
