import { useRef, useState } from 'react'
import { AlertCircle, FileText, UploadCloud, X } from 'lucide-react'
import { fmtBytes } from '../utils/format'

export default function FileUploader({ accept, file, onFile, onClear, error, disabled, title, hint, icon: Icon = UploadCloud }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) onFile(dropped)
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`node-bg cursor-pointer rounded-lg border border-dashed px-4 py-8 text-center transition-colors ${
          dragging ? 'border-brand bg-brand/5' : 'border-line hover:border-brand/50'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <Icon className="mx-auto mb-2 text-brand" size={26} />
        <p className="text-sm font-medium">{title || 'Drag & drop a file here'}</p>
        <p className="mt-1 text-xs text-muted">
          or <span className="text-brand underline">browse</span>
          {hint ? ` · ${hint}` : ''}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => {
            const picked = e.target.files?.[0]
            if (picked) onFile(picked)
            e.target.value = '' // so picking the same file twice still fires
          }}
        />
      </div>

      {file && (
        <div className="mt-3 flex items-center gap-3 rounded-md border border-line bg-panel px-3 py-2">
          <FileText size={16} className="text-brand" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{file.name}</p>
            <p className="text-xs text-muted">{fmtBytes(file.size)}</p>
          </div>
          {!disabled && (
            <button className="text-muted hover:text-ink" onClick={onClear} aria-label="Remove file">
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-2 text-xs text-danger">
          <AlertCircle size={14} className="mt-px shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
