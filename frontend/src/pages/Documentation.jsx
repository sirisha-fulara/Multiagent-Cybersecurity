import { useState } from 'react'
import { ArrowDown, ArrowRight } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import WorkflowDiagram from '../components/WorkflowDiagram'
import { Tag } from '../components/Badges'
import { API_BASE_URL } from '../services/api'

function Box({ children, tone = 'default' }) {
  const tones = {
    default: 'border-line bg-panel',
    green: 'border-brand/40 bg-brand/10 text-brand',
    blue: 'border-info/40 bg-info/10 text-info',
  }
  return <div className={`rounded-md border px-3 py-2 text-center text-xs ${tones[tone]}`}>{children}</div>
}

const Arrow = () => (
  <>
    <ArrowRight size={14} className="mx-auto hidden shrink-0 text-brand/70 sm:block" />
    <ArrowDown size={14} className="mx-auto text-brand/70 sm:hidden" />
  </>
)

const SECTIONS = [
  {
    id: 'overview',
    title: 'Project overview',
    body: () => (
      <>
        <p>
          CYBERSHIELD analyses network traffic for suspicious behaviour. It combines machine-learning models, rule-based checks and a retrieval step that
          pulls relevant cybersecurity knowledge, then merges everything into one report an analyst can read and verify.
        </p>
        <p>
          It is a detection and analysis tool. It doesn't block traffic, quarantine hosts or change any network configuration.
        </p>
      </>
    ),
  },
  {
    id: 'architecture',
    title: 'System architecture',
    body: () => (
      <>
        <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
          <Box tone="blue">React interface</Box><Arrow />
          <Box>Flask REST API</Box><Arrow />
          <Box tone="green">Detection pipeline<br />(ML · rules · RAG)</Box><Arrow />
          <Box>Neon PostgreSQL<br />(history)</Box>
        </div>
        <p>The interface only talks to the Flask API. Finished analyses are stored in PostgreSQL, which is what the Reports and Dashboard pages read back.</p>
      </>
    ),
  },
  {
    id: 'agents',
    title: 'Multi-agent workflow',
    body: () => (
      <>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Box>Detection Agent<br /><span className="text-muted">is this flow anomalous?</span></Box>
          <Box>Classification Agent<br /><span className="text-muted">which attack category?</span></Box>
          <Box>Threat Intelligence Agent<br /><span className="text-muted">what do we know about it?</span></Box>
          <Box tone="green">Coordinator Agent<br /><span className="opacity-80">builds the final result</span></Box>
        </div>
        <p>Each specialised agent produces its own output; the coordinator combines them. The interface only shows an agent's output or timing when the API returns it.</p>
      </>
    ),
  },
  {
    id: 'ml',
    title: 'Machine learning pipeline',
    body: () => (
      <>
        <WorkflowDiagram steps={['Flow features (78)', 'Random Forest – anomaly', 'Random Forest – classification', 'Verdict + category']} />
        <p>
          Models are trained on the CICIDS2017 feature set. XGBoost models were explored but are <Tag tone="orange">experimental</Tag> and not part of live analysis.
        </p>
      </>
    ),
  },
  {
    id: 'rag',
    title: 'RAG architecture',
    body: () => (
      <>
        <WorkflowDiagram steps={['Detected attack category', 'Retrieve passages from knowledge base', 'Generate grounded context', 'Threat intelligence finding']} />
        <p>
          Threat intelligence is retrieved from the project's own cybersecurity knowledge base – it is not a live external feed. The interface labels this
          content "Retrieved knowledge" to keep it apart from facts observed in the traffic.
        </p>
      </>
    ),
  },
  {
    id: 'inputs',
    title: 'Supported input formats',
    body: () => (
      <ul className="list-disc space-y-1.5 pl-5">
        <li><b>Single flow</b> – the 78 numeric CICIDS2017 features, entered by hand or loaded from a CSV row.</li>
        <li><b>Batch CSV</b> – a .csv file with up to 2,000 flows.</li>
        <li><b>PCAP / PCAPNG</b> – packet captures; the backend extracts flows and also runs packet-level aggregate checks.</li>
      </ul>
    ),
  },
  {
    id: 'api',
    title: 'API endpoints',
    body: () => (
      <>
        <p>Base URL: <code className="font-mono text-brand">{API_BASE_URL}</code> (override with <code className="font-mono">VITE_API_URL</code>)</p>
        <table className="mt-2 w-full text-left text-xs">
          <tbody>
            {[
              ['GET', '/api/health', 'Service health'],
              ['POST', '/api/analyze', 'Analyse one flow (JSON)'],
              ['POST', '/api/analyze-batch', 'Analyse a CSV (multipart)'],
              ['POST', '/api/analyze-pcap', 'Analyse a capture (multipart)'],
              ['GET', '/api/analysis/{id}', 'Fetch one stored report'],
              ['GET', '/api/history', 'List stored analyses'],
            ].map(([m, p, d]) => (
              <tr key={p} className="border-t border-line">
                <td className="py-2 pr-3"><Tag tone={m === 'GET' ? 'blue' : 'green'}>{m}</Tag></td>
                <td className="pr-3 font-mono">{p}</td>
                <td className="text-muted">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: 'method',
    title: 'Analysis methodology',
    body: () => (
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>Traffic is converted to flow records (for PCAPs, by the backend).</li>
        <li>The anomaly model scores each flow; flagged flows go to the classifier.</li>
        <li>Rule-based checks look for known traffic patterns independently of the models.</li>
        <li>Threat intelligence is retrieved for detected categories.</li>
        <li>Results are merged into a report. ML predictions, rule findings and packet-level aggregate detection are kept separate rather than collapsed into one score.</li>
      </ol>
    ),
  },
  {
    id: 'limits',
    title: 'Known limitations',
    body: () => (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Predictions are statistical and can be wrong – treat them as leads to verify, not confirmed incidents.</li>
        <li>Models are trained on CICIDS2017; traffic that looks very different from that dataset may be misjudged.</li>
        <li>Batch analysis is limited to 2,000 flows per upload.</li>
        <li>Dashboard flow-level charts use the most recent reports loaded in the browser, not the entire history.</li>
        <li>Evaluation metrics and knowledge-base documents aren't served by the API; they come from local files in <code className="font-mono">src/data</code>.</li>
        <li>No authentication, blocking or automated response is implemented.</li>
      </ul>
    ),
  },
]

export default function Documentation() {
  const [active, setActive] = useState(SECTIONS[0].id)

  return (
    <div>
      <PageHeader title="Documentation" subtitle="How CYBERSHIELD is put together and how to read its results." />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="card sticky top-20 hidden h-fit p-2 lg:block">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={() => setActive(s.id)}
              className={`block rounded px-3 py-2 text-sm transition-colors ${active === s.id ? 'bg-brand/10 text-brand' : 'text-muted hover:text-ink'}`}
            >
              {s.title}
            </a>
          ))}
        </nav>

        <div className="space-y-5">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="card scroll-mt-20 p-5">
              <h2 className="mb-3 text-base font-medium">{s.title}</h2>
              <div className="space-y-3 text-sm leading-relaxed text-ink/90">{s.body()}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
