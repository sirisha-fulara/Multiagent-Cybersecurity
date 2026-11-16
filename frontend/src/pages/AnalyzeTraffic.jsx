import { useState } from 'react'
import { FileArchive, FileSpreadsheet, Rows3 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import SingleFlowForm from '../components/analyze/SingleFlowForm'
import BatchPanel from '../components/analyze/BatchPanel'
import PcapUpload from '../components/analyze/PcapUpload'
import usePersistentState from '../hooks/usePersistentState'

const TABS = [
  { id: 'single', label: 'Single Flow', icon: Rows3, view: SingleFlowForm },
  { id: 'batch', label: 'Batch CSV', icon: FileSpreadsheet, view: BatchPanel },
  { id: 'pcap', label: 'PCAP / PCAPNG', icon: FileArchive, view: PcapUpload },
]

export default function AnalyzeTraffic() {
  const [tab, setTab] = usePersistentState(
    'cybershield-active-analysis-tab',
    'single',
  )

  return (
    <div>
      <PageHeader title="Analyze Traffic" subtitle="Submit a single flow, a CSV of flows or a packet capture to the detection pipeline." />

      <div className="mb-5 inline-flex rounded-lg border border-line bg-card p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors ${tab === id ? 'bg-brand/15 text-brand' : 'text-muted hover:text-ink'
              }`}
          >
            <Icon size={15} /> <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* every panel stays mounted so switching tabs doesn't throw away results or form input */}
      {TABS.map(({ id, view: View }) => (
        <div key={id} hidden={tab !== id}>
          <View />
        </div>
      ))}
    </div>
  )
}
