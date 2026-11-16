import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../services/api'
import { flowsToAlerts, normalizeHistoryList, normalizeReport } from '../utils/normalize'

const DataContext = createContext(null)

// How many recent reports we open in full to build dashboard charts.
// History rows only carry totals, so flow-level charts need the full reports.
const DETAIL_LIMIT = 8

export function AnalysisProvider({ children }) {
  const [history, setHistory] = useState([])
  const [reports, setReports] = useState({}) // id -> normalized report
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const loadingRef = useRef(false)

  const load = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setError(null)
    try {
      const raw = await api.history()
      const list = normalizeHistoryList(raw)
      setHistory(list)

      const recent = list.filter((h) => h.id).slice(0, DETAIL_LIMIT)
      const results = await Promise.allSettled(recent.map((h) => api.getAnalysis(h.id)))
      const next = {}
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next[recent[i].id] = normalizeReport(r.value, recent[i].id)
      })
      setReports((prev) => ({ ...prev, ...next }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Called after a fresh analysis so the new run shows up everywhere.
  const addReport = useCallback((id, raw) => {
    if (!id) return
    setReports((prev) => ({ ...prev, [id]: normalizeReport(raw, id) }))
  }, [])

  const derived = useMemo(() => {
    const reportList = Object.values(reports).filter(Boolean)
    const flows = reportList.flatMap((r) =>
      r.flows.map((f) => ({ ...f, analysisId: r.id, analysisFile: r.filename })),
    )
    const alerts = reportList.flatMap((r) => flowsToAlerts(r.flows, r.id))
    return { reportList, flows, alerts }
  }, [reports])

  const value = { history, reports, ...derived, loading, error, reload: load, addReport }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useAnalysisData = () => useContext(DataContext)
