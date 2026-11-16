
import { useEffect, useMemo, useState } from 'react'
import { BookOpen, FileText, Quote, Search, RefreshCw } from 'lucide-react'
import PageHeader, { Panel } from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { Tag } from '../components/Badges'
import { useAppData } from '../context/AppDataContext'
import { getKnowledgeBase } from '../services/api'

export default function KnowledgeBase() {
  const { flows, details } = useAppData()

  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    let active = true

    async function loadDocuments() {
      try {
        setLoading(true)
        const response = await getKnowledgeBase()

        if (active) {
          setDocuments(response.documents || [])
          setError(null)
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
            err.message ||
            'Unable to load knowledge base.'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDocuments()

    return () => {
      active = false
    }
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()

    return documents.filter((d) =>
      !q ||
      [d.title, d.category, d.summary, d.content]
        .some((v) => v && String(v).toLowerCase().includes(q))
    )
  }, [documents, query])

  const open = documents.find((d) => d.id === openId)

  const retrieved = useMemo(() => {
    const seen = new Map()

    const add = (intel, from) => {
      for (const p of intel?.passages ?? []) {
        const title = p.title || 'Retrieved passage'
        const detail = p.detail || ''
        const key = title + detail

        if (!seen.has(key)) {
          seen.set(key, { ...p, title, from })
        }
      }
    }

    flows.forEach((f) => add(f.intel, f.attackType))

    Object.values(details).forEach((r) =>
      add(r.intel, r.filename || `Report ${r.id}`)
    )

    const all = [...seen.values()]
    const q = query.trim().toLowerCase()

    return q
      ? all.filter((p) =>
        `${p.title} ${p.detail || ''}`.toLowerCase().includes(q)
      )
      : all
  }, [flows, details, query])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Knowledge Base"
        subtitle="Cybersecurity documents used by the RAG-based threat intelligence agent."
        actions={
          <button
            className="btn btn-ghost"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      <div className="relative max-w-lg">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          className="input w-full pl-9"
          placeholder="Search documents and retrieved passages..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel
          title={`Documents (${matches.length})`}
          icon={BookOpen}
          className="h-fit"
        >
          {loading ? (
            <p className="text-sm text-muted">Loading knowledge base...</p>
          ) : documents.length === 0 ? (
            <EmptyState
              compact
              title="No documents found"
              text="Check that rag/data/cybersecurity.txt exists and contains text."
            />
          ) : matches.length === 0 ? (
            <p className="text-xs text-muted">
              No documents match "{query}".
            </p>
          ) : (
            <ul className="space-y-1">
              {matches.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => setOpenId(d.id)}
                    className={`w-full rounded px-3 py-2 text-left transition-colors ${openId === d.id
                        ? 'bg-brand/10'
                        : 'hover:bg-panel'
                      }`}
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <FileText size={13} className="text-brand" />
                      {d.title}
                    </span>

                    <span className="ml-5 text-[11px] text-muted">
                      {d.category}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          {open && (
            <Panel
              title={open.title}
              right={<Tag>{open.category}</Tag>}
            >
              {open.summary && (
                <p className="mb-3 text-sm text-muted">
                  {open.summary}
                </p>
              )}

              <div className="whitespace-pre-wrap text-[13px] leading-relaxed">
                {open.content}
              </div>

              <p className="mt-4 text-xs text-muted">
                Source: {open.source}
              </p>
            </Panel>
          )}

          <Panel
            title={`Passages retrieved during analyses (${retrieved.length})`}
            icon={Quote}
          >
            {retrieved.length === 0 ? (
              <p className="text-xs text-muted">
                No retrieved passages have been returned with the loaded analyses.
                Run an analysis with a detected attack to populate this section.
              </p>
            ) : (
              <ul className="space-y-2">
                {retrieved.slice(0, 30).map((p, i) => (
                  <li
                    key={i}
                    className="rounded border border-line bg-panel/50 px-3 py-2 text-[13px]"
                  >
                    {p.title}

                    {p.detail && (
                      <span className="mt-1 block text-xs text-muted">
                        {p.detail}
                      </span>
                    )}

                    {p.from && (
                      <span className="mt-1 block text-[11px] text-info">
                        via {p.from}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
