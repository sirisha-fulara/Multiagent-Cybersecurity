import { ArrowRight, ArrowDown } from 'lucide-react'

export const PIPELINE_STEPS = [
  'Network Traffic / PCAP',
  'Flow Extraction',
  'Anomaly Detection',
  'Attack Classification',
  'Rule-Based Analysis',
  'Threat Intelligence (RAG)',
  'Unified Security Report',
]

// Horizontal on wide screens, wraps to a vertical chain on small ones
export default function WorkflowDiagram({ steps = PIPELINE_STEPS }) {
  return (
    <ol className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:gap-0">
      {steps.map((label, i) => (
        <li key={label} className="flex flex-col items-center lg:flex-1 lg:flex-row">
          <div className="w-full rounded-lg border border-line bg-card px-3 py-3 text-center transition-colors hover:border-brand/50 lg:min-h-[76px] lg:flex-1">
            <span className="mx-auto mb-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-brand/40 text-[10px] text-brand">
              {i + 1}
            </span>
            <span className="text-xs leading-snug">{label}</span>
          </div>
          {i < steps.length - 1 && (
            <>
              <ArrowRight size={16} className="mx-1 hidden shrink-0 text-brand/70 lg:block" />
              <ArrowDown size={16} className="my-1 shrink-0 text-brand/70 lg:hidden" />
            </>
          )}
        </li>
      ))}
    </ol>
  )
}
