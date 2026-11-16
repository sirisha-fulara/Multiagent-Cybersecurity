import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { describeError, getAnalysis, getHealth, getHistory } from '../services/api'
import { normalizeAnalysis, normalizeHealth, normalizeHistory, OFFLINE_HEALTH } from '../utils/normalize'
import { toDate } from '../utils/format'
import { inRange } from '../utils/time'

const AppDataContext = createContext(null)

const FIRST_BATCH = 5 // how many recent reports we open up front for flow-level widgets
const HEALTH_POLL_MS = 30000

const byDateDesc = (a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0)

export function AppDataProvider({ children }) {
  const [health, setHealth] = useState(null)
  const [healthError, setHealthError] = useState(null)
  const [lastChecked, setLastChecked] = useState(null)

  const [history, setHistory] = useState([])
  const [historyStatus, setHistoryStatus] = useState({ loading: true, error: null })
  const [lastUpdated, setLastUpdated] = useState(null)

  const [details, setDetails] = useState({}) // analysis id -> normalized report
  const requested = useRef(new Set())

  const [range, setRange] = useState('all')

  const refreshHealth = useCallback(async () => {
    try {
      const data = await getHealth()
      setHealth(normalizeHealth(data))
      setHealthError(null)
    } catch (err) {
      setHealth(OFFLINE_HEALTH)
      setHealthError(describeError(err))
    }
    setLastChecked(new Date())
  }, [])

  const refreshHistory = useCallback(async () => {
    setHistoryStatus((s) => ({ ...s, loading: true }))
    try {
      const data = await getHistory()
      setHistory(normalizeHistory(data))
      setHistoryStatus({ loading: false, error: null })
      setLastUpdated(new Date())
    } catch (err) {
      setHistoryStatus({ loading: false, error: describeError(err) })
    }
  }, [])

  // fetch full reports, skipping anything we've already asked for
  const loadDetails = useCallback(async (ids) => {
    const wanted = ids.filter((id) => id != null && !requested.current.has(String(id)))
    wanted.forEach((id) => requested.current.add(String(id)))
    if (!wanted.length) return
    const results = await Promise.allSettled(wanted.map((id) => getAnalysis(id)))
    const loaded = {}
    results.forEach((res, i) => {
      const id = String(wanted[i])
      if (res.status === 'fulfilled') {
        const report = normalizeAnalysis(res.value)
        loaded[id] = { ...report, id: report.id ?? id }
      } else {
        requested.current.delete(id) // allow a retry later
      }
    })
    if (Object.keys(loaded).length) setDetails((d) => ({ ...d, ...loaded }))
  }, [])

  // used after a fresh analysis so the dashboard picks it up without a refetch
  const addAnalysis = useCallback((report) => {
    if (report?.id == null) return
    requested.current.add(String(report.id))
    setDetails((d) => ({ ...d, [String(report.id)]: report }))
  }, [])

  useEffect(() => {
    refreshHealth()
    refreshHistory()
    const timer = setInterval(refreshHealth, HEALTH_POLL_MS)
    return () => clearInterval(timer)
  }, [refreshHealth, refreshHistory])

  const sortedHistory = useMemo(() => [...history].sort(byDateDesc), [history])

  useEffect(() => {
    loadDetails(sortedHistory.slice(0, FIRST_BATCH).map((h) => h.id))
  }, [sortedHistory, loadDetails])

  const loadOlder = useCallback(
    (count = 10) => {
      const next = sortedHistory.filter((h) => !requested.current.has(String(h.id))).slice(0, count)
      return loadDetails(next.map((h) => h.id))
    },
    [sortedHistory, loadDetails],
  )

  // history rows sometimes lack counts; fill them from the full report when we have it
  const records = useMemo(
    () =>
      sortedHistory.map((h) => {
        const d = details[String(h.id)]
        if (!d) return h
        return {
          ...h,
          totalFlows: h.totalFlows ?? d.totalFlows,
          attackFlows: h.attackFlows ?? d.attackFlows,
          benignFlows: h.benignFlows ?? d.benignFlows,
          severity: h.severity ?? d.severity,
        }
      }),
    [sortedHistory, details],
  )

  const rangedRecords = useMemo(() => records.filter((r) => inRange(r.createdAt, range)), [records, range])

  const allFlows = useMemo(() => {
    const out = []
    for (const report of Object.values(details)) {
      for (const flow of report.flows) {
        out.push({
          ...flow,
          analysisId: report.id,
          analysisTime: report.createdAt,
          filename: report.filename,
          when: flow.timestamp ?? report.createdAt,
        })
      }
    }
    return out.sort((a, b) => (toDate(b.when)?.getTime() ?? 0) - (toDate(a.when)?.getTime() ?? 0))
  }, [details])

  const flows = useMemo(() => allFlows.filter((f) => inRange(f.when, range)), [allFlows, range])
  const alerts = useMemo(() => flows.filter((f) => f.verdict === 'attack'), [flows])

  const value = {
    health,
    healthError,
    lastChecked,
    refreshHealth,
    history: records,
    rangedHistory: rangedRecords,
    historyStatus,
    refreshHistory,
    lastUpdated,
    details,
    loadDetails,
    loadOlder,
    addAnalysis,
    flows,
    alerts,
    range,
    setRange,
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used inside <AppDataProvider>')
  return ctx
}
