import { Inbox } from 'lucide-react'

export default function EmptyState({ icon: Icon = Inbox, title, text, children, compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-14'} px-4`}>
      <div className="mb-3 rounded-full border border-line bg-panel p-3">
        <Icon size={18} className="text-muted" />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{text}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
