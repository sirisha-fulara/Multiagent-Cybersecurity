import axios from 'axios'
import { parseCsv } from '../utils/csv'

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000'

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

const UPLOAD_TIMEOUT = 15 * 60 * 1000
const JOB_POLL_INTERVAL = 2000
const MAX_POLL_TIME = 30 * 60 * 1000

// ---------------- JOB POLLING ----------------

export async function waitForJob(jobId, { signal, onProgress } = {}) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < MAX_POLL_TIME) {
    if (signal?.aborted) {
      throw new Error('Analysis monitoring cancelled.')
    }

    const { data } = await client.get(
      `/api/jobs/${encodeURIComponent(jobId)}`,
      { signal }
    )

    onProgress?.(data)

    if (data.status === 'completed') {
      return data.result
    }

    if (data.status === 'failed') {
      throw new Error(data.error || data.message || 'Analysis failed.')
    }

    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, JOB_POLL_INTERVAL)

      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer)
          reject(new Error('Analysis monitoring cancelled.'))
        },
        { once: true }
      )
    })
  }

  throw new Error(
    'Analysis is still running. Check the job status again.'
  )
}

// ---------------- SUBMIT JOB ----------------

async function submitJob(url, body, config = {}) {
  const { data } = await client.post(url, body, config)

  if (!data.job_id) {
    throw new Error('Backend did not return a job ID.')
  }

  return waitForJob(data.job_id, {
    signal: config.signal,
    onProgress: config.onJobProgress,
  })
}

// ---------------- HEALTH ----------------

export const getHealth = async () => {
  const { data } = await client.get('/api/health', {
    timeout: 8000,
  })
  return data
}

// ---------------- HISTORY ----------------

export const getHistory = async () => {
  const { data } = await client.get('/api/history')
  return data
}

// ---------------- REPORT ----------------

export const getAnalysis = async (id) => {
  const { data } = await client.get(
    `/api/analysis/${encodeURIComponent(id)}`
  )
  return data
}

// ---------------- SINGLE FLOW ----------------

export async function analyzeFlow(features) {
  const { data } = await client.post('/api/analyze', {
    flow: features,
  })

  return data
}

// ---------------- BATCH CSV ----------------

export async function analyzeBatch(file, opts = {}) {
  const csvText = await file.text()
  const { rows } = parseCsv(csvText, 2000)

  const flows = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        const trimmed = String(value ?? '').trim()

        if (!trimmed) return [key, null]

        const number = Number(trimmed)

        return [
          key,
          Number.isFinite(number) ? number : trimmed,
        ]
      }),
    ),
  )

  const { data } = await client.post(
    '/api/analyze-batch',
    { flows },
    {
      timeout: UPLOAD_TIMEOUT,
      signal: opts.signal,
    },
  )

  opts.onProgress?.(100)

  return data
}

// ---------------- PCAP ----------------

export async function analyzePcap(file, opts = {}) {
  const form = new FormData()
  form.append('file', file)

  return submitJob(
    '/api/analyze-pcap',
    form,
    {
      ...opts,
      timeout: UPLOAD_TIMEOUT,
      onUploadProgress: (event) => {
        if (event.total && opts.onProgress) {
          opts.onProgress(
            Math.round((event.loaded / event.total) * 100)
          )
        }
      },
    }
  )
}

// ---------------- ERROR HANDLING ----------------

export function describeError(err) {
  if (err.response) {
    const body = err.response.data

    return (
      body?.message ||
      body?.error ||
      `Server error: ${err.response.status}`
    )
  }

  if (err.code === 'ECONNABORTED') {
    return 'Request timed out.'
  }

  if (err.request) {
    return `Cannot connect to backend at ${API_BASE_URL}.`
  }

  return err.message || 'Something went wrong.'
}

export const getKnowledgeBase = async () => {
  const { data } = await client.get('/api/knowledge-base')
  return data
}