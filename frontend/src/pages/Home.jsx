import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Brain, FileSearch, Layers, Menu, Network, ScanSearch, ScrollText, Shield, Users, X,
} from 'lucide-react'
import NetworkGraphic from '../components/NetworkGraphic'
import WorkflowDiagram from '../components/WorkflowDiagram'
import { Tag } from '../components/Badges'

const FEATURES = [
  { icon: ScanSearch, title: 'Anomaly Detection', text: 'Identify unusual network traffic using machine learning.' },
  { icon: Network, title: 'Attack Classification', text: 'Classify suspicious traffic into recognized attack categories.' },
  { icon: ScrollText, title: 'Rule-Based Detection', text: 'Identify suspicious traffic patterns using predefined detection rules.' },
  { icon: Brain, title: 'Threat Intelligence', text: 'Retrieve relevant cybersecurity knowledge for detected threats.' },
  { icon: FileSearch, title: 'Explainable AI', text: 'Present evidence and reasoning behind security findings.' },
  { icon: Users, title: 'Multi-Agent Analysis', text: 'Coordinate specialized agents to produce unified analysis results.' },
]

const TECH = [
  { name: 'Python', note: 'Backend language', active: true },
  { name: 'Flask', note: 'REST API', active: true },
  { name: 'Scikit-learn', note: 'ML tooling', active: true },
  { name: 'Random Forest', note: 'Anomaly detection & attack classification', active: true },
  { name: 'XGBoost', note: 'Experimental – not part of the active pipeline', active: false },
  { name: 'RAG', note: 'Retrieval for threat intelligence context', active: true },
  { name: 'React', note: 'This interface', active: true },
  { name: 'PostgreSQL / Neon', note: 'Analysis history storage', active: true },
]

const NAV = [
  ['Home', '#top'],
  ['Features', '#features'],
  ['Architecture', '#architecture'],
  ['Technology', '#technology'],
]

export default function Home() {
  const [open, setOpen] = useState(false)

  return (
    <div id="top" className="min-h-screen scroll-smooth">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="rounded-md border border-brand/40 bg-brand/10 p-1.5">
              <Shield size={18} className="text-brand" />
            </span>
            <span className="text-sm font-semibold tracking-[0.18em]">CYBERSHIELD</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
            {NAV.map(([label, href]) => (
              <a key={label} href={href} className="transition-colors hover:text-ink">{label}</a>
            ))}
            <Link to="/app/documentation" className="transition-colors hover:text-ink">Documentation</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/app" className="btn btn-primary hidden sm:inline-flex">Get Started</Link>
            <button className="text-muted md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {open && (
          <div className="flex flex-col gap-3 border-t border-line px-5 py-4 text-sm md:hidden">
            {NAV.map(([label, href]) => (
              <a key={label} href={href} onClick={() => setOpen(false)}>{label}</a>
            ))}
            <Link to="/app/documentation">Documentation</Link>
            <Link to="/app" className="btn btn-primary">Get Started</Link>
          </div>
        )}
      </header>

      {/* hero */}
      <section className="node-bg border-b border-line">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="chip mb-5 border-brand/30 bg-brand/10 text-brand">Multi-agent · Explainable · Evidence-backed</span>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">
              Intelligent Network Threat Detection. <span className="text-brand">Explained.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              An explainable, multi-agent cybersecurity platform that detects suspicious network activity, classifies attacks,
              investigates threats, and delivers evidence-backed security insights.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/app" className="btn btn-primary !px-5 !py-2.5">
                Explore Dashboard <ArrowRight size={16} />
              </Link>
              <a href="#features" className="btn btn-ghost !px-5 !py-2.5">Explore Features</a>
            </div>
          </div>
          <NetworkGraphic />
        </div>
      </section>

      {/* features */}
      <section id="features" className="mx-auto max-w-7xl scroll-mt-16 px-5 py-20">
        <SectionTitle eyebrow="Capabilities" title="What the platform does" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-5 transition-all hover:border-brand/50 hover:shadow-glow">
              <span className="mb-4 inline-flex rounded-md border border-brand/25 bg-brand/10 p-2 text-brand">
                <Icon size={18} />
              </span>
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="architecture" className="scroll-mt-16 border-y border-line bg-sidebar">
        <div className="mx-auto max-w-7xl px-5 py-20">
          <SectionTitle eyebrow="Architecture" title="How it works" />
          <WorkflowDiagram />
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted">
            Traffic is turned into flows, scored by the detection and classification agents, checked against rules, enriched with retrieved
            threat knowledge and merged into one report.
          </p>
        </div>
      </section>

      {/* technology */}
      <section id="technology" className="mx-auto max-w-7xl scroll-mt-16 px-5 py-20">
        <SectionTitle eyebrow="Technology" title="Built with" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TECH.map((t) => (
            <div key={t.name} className="card flex items-start justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="mt-1 text-xs text-muted">{t.note}</p>
              </div>
              <Tag tone={t.active ? 'green' : 'orange'}>{t.active ? 'Active' : 'Experimental'}</Tag>
            </div>
          ))}
        </div>
      </section>

      {/* final CTA */}
      <section className="node-bg border-y border-line">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <Layers className="mx-auto mb-4 text-brand" size={28} />
          <h2 className="text-3xl font-semibold tracking-tight">Take Control of Your Network Security.</h2>
          <Link to="/app" className="btn btn-primary mt-8 !px-6 !py-3">
            Launch CYBERSHIELD Dashboard <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="bg-sidebar">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="flex items-center gap-2 font-semibold tracking-[0.18em]"><Shield size={16} className="text-brand" /> CYBERSHIELD</p>
            <p className="mt-2 text-xs text-muted">Multi-Agent Explainable AI Cybersecurity Platform</p>
          </div>
          <FooterCol title="Project">
            <Link to="/app/documentation">About the Project</Link>
            <Link to="/app/documentation">Documentation</Link>
          </FooterCol>
          <FooterCol title="Technology">
            <a href="#technology">Technology Stack</a>
            <a href="#architecture">Architecture</a>
          </FooterCol>
          <FooterCol title="Project information">
            <p className="text-xs text-muted">Detection and analysis only – CYBERSHIELD does not block or modify network traffic.</p>
          </FooterCol>
        </div>
      </footer>
    </div>
  )
}

function SectionTitle({ eyebrow, title }) {
  return (
    <div className="mb-10 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
    </div>
  )
}

function FooterCol({ title, children }) {
  return (
    <div className="flex flex-col gap-2 text-sm text-muted [&_a:hover]:text-ink">
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-ink">{title}</p>
      {children}
    </div>
  )
}
