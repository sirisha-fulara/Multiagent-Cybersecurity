import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

export default function UploadStatus({ phase, progress, error, doneText }) {
  if (phase === 'uploading' || phase === 'processing') {
    return (
      <div className="rounded-md border border-line bg-panel p-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-brand" />
            {phase === 'uploading' ? `Uploading… ${progress}%` : 'Upload complete – the backend is processing the file…'}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded bg-line">
          <div
            className={`h-full bg-brand transition-all ${phase === 'processing' ? 'w-full animate-pulse' : ''}`}
            style={phase === 'uploading' ? { width: `${progress}%` } : undefined}
          />
        </div>
      </div>
    )
  }
  if (phase === 'done') {
    return (
      <p className="flex items-center gap-2 rounded-md border border-brand/30 bg-brand/10 px-3 py-2 text-xs text-brand">
        <CheckCircle2 size={14} /> {doneText}
      </p>
    )
  }
  if (phase === 'failed' && error) {
    return (
      <p className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
        <XCircle size={14} className="mt-px shrink-0" /> {error}
      </p>
    )
  }
  return null
}
