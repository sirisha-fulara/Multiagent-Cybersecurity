import { useCallback, useRef, useState } from 'react'
import { describeError } from '../services/api'

// Shared state machine for the CSV and PCAP uploaders:
// idle -> uploading -> processing -> done | failed
export function useUpload({ send, validate, onSuccess }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const busy = useRef(false) // stops a double-click from sending the file twice

  const select = useCallback(
    async (picked) => {
      const problem = await validate(picked)
      setResult(null)
      setPhase('idle')
      setProgress(0)
      if (problem) {
        setFile(null)
        setError(problem)
        return
      }
      setError(null)
      setFile(picked)
    },
    [validate],
  )

  const clear = useCallback(() => {
    setFile(null)
    setError(null)
    setResult(null)
    setPhase('idle')
    setProgress(0)
  }, [])

  const run = useCallback(async () => {
    if (!file || busy.current) return
    busy.current = true
    setError(null)
    setResult(null)
    setProgress(0)
    setPhase('uploading')
    try {
      const data = await send(file, {
        onProgress: (pct) => {
          setProgress(pct)
          if (pct >= 100) setPhase('processing') // bytes are up, server is crunching
        },
      })
      setResult(data)
      setPhase('done')
      onSuccess?.(data)
    } catch (err) {
      setError(describeError(err))
      setPhase('failed')
    } finally {
      busy.current = false
    }
  }, [file, send, onSuccess])

  return { file, error, phase, progress, result, select, clear, run, running: phase === 'uploading' || phase === 'processing' }
}
