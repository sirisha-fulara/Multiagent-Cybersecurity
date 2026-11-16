import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../services/api'

const HealthContext = createContext(null)

const POLL_MS = 30000

/*
 * Wraps GET /api/health. We keep the raw payload so pages can look for
 * per-component fields (database, agents, rag...) and only show what the
 * backend actually reported.
 */
export function HealthProvider({ children }) {
  const [state, setState] = useState({
    status: 'checking', // 'checking' | 'online' | 'offline'
    payload: null,
    error: null,
    checkedAt: null,
  })
  const busy = useRef(false)

  const check = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const payload = await api.health()
      setState({ status: 'online', payload, error: null, checkedAt: new Date() })
    } catch (err) {
      setState({ status: 'offline', payload: null, error: err.message, checkedAt: new Date() })
    } finally {
      busy.current = false
    }
  }, [])

  useEffect(() => {
    check()
    const t = setInterval(check, POLL_MS)
    return () => clearInterval(t)
  }, [check])

  return <HealthContext.Provider value={{ ...state, refresh: check }}>{children}</HealthContext.Provider>
}

export const useHealth = () => useContext(HealthContext)

/*
 * Look for a component's status inside the health payload.
 * Returns 'online' | 'offline' | 'unknown'. 'unknown' means the backend
 * didn't say, so the UI shows "Not independently monitored".
 */
export function componentStatus(payload, names) {
  if (!payload || typeof payload !== 'object') return 'unknown'
  const containers = [payload, payload.components, payload.services, payload.agents, payload.checks].filter(
    (c) => c && typeof c === 'object',
  )
  for (const box of containers) {
    for (const name of names) {
      if (!(name in box)) continue
      const v = box[name]
      const flag = typeof v === 'object' && v !== null ? (v.status ?? v.ok ?? v.healthy ?? v.available) : v
      if (flag === true) return 'online'
      if (flag === false) return 'offline'
      if (typeof flag === 'string') {
        const s = flag.toLowerCase()
        if (['ok', 'online', 'up', 'healthy', 'ready', 'connected', 'loaded', 'available'].includes(s)) return 'online'
        if (['error', 'offline', 'down', 'unhealthy', 'failed', 'disconnected', 'unavailable'].includes(s)) return 'offline'
      }
    }
  }
  return 'unknown'
}
