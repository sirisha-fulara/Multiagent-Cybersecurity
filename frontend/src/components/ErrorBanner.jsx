import { AlertTriangle } from 'lucide-react'

export default function ErrorBanner({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      <p className="flex-1 text-ink">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-danger underline underline-offset-2">
          Retry
        </button>
      )}
    </div>
  )
}
