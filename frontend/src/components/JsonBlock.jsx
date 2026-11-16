// Used wherever we show backend data we don't have a nicer layout for.
export default function JsonBlock({ data, maxHeight = 280 }) {
  if (data === null || data === undefined) return <p className="text-xs text-mute">Not provided by the backend.</p>
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  return (
    <pre
      style={{ maxHeight }}
      className="overflow-auto rounded-md border border-line bg-bg p-3 font-mono text-xs leading-relaxed text-mute"
    >
      {text}
    </pre>
  )
}
