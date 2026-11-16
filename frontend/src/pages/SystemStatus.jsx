import { RefreshCw } from 'lucide-react'
import PageHeader, { Panel, RawJson } from '../components/PageHeader'
import StatusIndicator from '../components/StatusIndicator'
import { useAppData } from '../context/AppDataContext'
import { API_BASE_URL } from '../services/api'
import { fmtDate } from '../utils/format'

const ROWS = [
  ['Flask API', 'api', 'Reachability of GET /api/health'],
  ['Database (Neon PostgreSQL)', 'database', 'Analysis history storage'],
  ['Detection Agent', 'detection', 'Anomaly detection model'],
  ['Classification Agent', 'classification', 'Attack classification model'],
  ['Threat Intelligence Agent', 'threatIntel', 'RAG-based context retrieval'],
  ['RAG service', 'rag', 'Vector store / retrieval'],
  ['Model availability', 'models', 'Loaded model files'],
]

const ENDPOINTS = ['GET /api/health', 'POST /api/analyze', 'POST /api/analyze-batch', 'POST /api/analyze-pcap', 'GET /api/analysis/{id}', 'GET /api/history']

export default function SystemStatus() {
  const { health, healthError, lastChecked, refreshHealth } = useAppData()

  return (
    <div className="space-y-5">
      <PageHeader
        title="System Status"
        subtitle="Health information as reported by the backend. Checked automatically every 30 seconds."
        actions={<button className="btn btn-ghost" onClick={refreshHealth}><RefreshCw size={14} /> Check now</button>}
      />

      <div className="card flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
        <div>
          <p className="label">API</p>
          <div className="mt-1 text-base">{health ? <StatusIndicator status={health.components.api} /> : <StatusIndicator status="checking" />}</div>
        </div>
        <div>
          <p className="label">Last health check</p>
          <p className="mt-1 text-sm">{lastChecked ? fmtDate(lastChecked) : '—'}</p>
        </div>
        <div>
          <p className="label">Base URL</p>
          <p className="mt-1 font-mono text-sm">{API_BASE_URL}</p>
        </div>
        {health?.version && (
          <div>
            <p className="label">API version</p>
            <p className="mt-1 font-mono text-sm">{health.version}</p>
          </div>
        )}
      </div>

      {healthError && <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-3 text-sm text-danger">{healthError}</p>}
      {health?.message && <p className="rounded-md border border-line bg-panel px-3 py-2 text-xs text-muted">Backend message: {String(health.message)}</p>}

      <Panel title="Components">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr><th className="py-2 font-medium">Component</th><th className="font-medium">Status</th><th className="font-medium">Notes</th></tr>
            </thead>
            <tbody>
              {ROWS.map(([label, key, note]) => (
                <tr key={key} className="border-t border-line">
                  <td className="py-3">{label}</td>
                  <td><StatusIndicator status={health ? health.components[key] : 'checking'} /></td>
                  <td className="text-xs text-muted">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          A component only shows Online or Offline when the health response says so. Otherwise it's listed as "Not monitored" – we don't assume it's healthy just because the API answered.
        </p>
      </Panel>

      <Panel title="Endpoints used by this interface">
        <ul className="grid gap-2 font-mono text-xs sm:grid-cols-2">
          {ENDPOINTS.map((e) => <li key={e} className="rounded border border-line bg-panel/50 px-3 py-2">{e}</li>)}
        </ul>
      </Panel>

      <RawJson data={health?.raw} label="Raw /api/health response" />
    </div>
  )
}
