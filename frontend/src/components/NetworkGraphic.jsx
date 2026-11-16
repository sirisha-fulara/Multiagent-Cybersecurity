import { Shield } from 'lucide-react'

// Hand-placed nodes so the layout looks intentional rather than random.
const NODES = [
  { id: 'a', x: 60, y: 70, r: 5 },
  { id: 'b', x: 150, y: 28, r: 4 },
  { id: 'c', x: 290, y: 52, r: 6 },
  { id: 'd', x: 400, y: 110, r: 4 },
  { id: 'e', x: 40, y: 190, r: 4 },
  { id: 'f', x: 420, y: 240, r: 6 },
  { id: 'g', x: 70, y: 320, r: 5 },
  { id: 'h', x: 170, y: 400, r: 4 },
  { id: 'i', x: 310, y: 410, r: 5 },
  { id: 'j', x: 410, y: 350, r: 4 },
  { id: 'k', x: 120, y: 150, r: 3 },
  { id: 'l', x: 350, y: 180, r: 3 },
  { id: 'm', x: 130, y: 280, r: 3 },
  { id: 'n', x: 340, y: 310, r: 3 },
]
const CENTER = { x: 230, y: 220 }

const LINKS = [
  ['a', 'k'], ['k', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'l'], ['l', 'f'], ['e', 'k'], ['e', 'g'],
  ['g', 'm'], ['m', 'h'], ['h', 'i'], ['i', 'n'], ['n', 'j'], ['j', 'f'], ['k', 'center'], ['l', 'center'],
  ['m', 'center'], ['n', 'center'], ['c', 'center'], ['h', 'center'], ['e', 'center'], ['f', 'center'],
]

const pos = (id) => (id === 'center' ? CENTER : NODES.find((n) => n.id === id))

export default function NetworkGraphic() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[480px]">
      <svg viewBox="0 0 460 460" className="h-full w-full">
        <defs>
          <radialGradient id="halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#32D583" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#32D583" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={CENTER.x} cy={CENTER.y} r="190" fill="url(#halo)" />
        <circle cx={CENTER.x} cy={CENTER.y} r="120" fill="none" stroke="#18352A" strokeDasharray="3 6" />
        <circle cx={CENTER.x} cy={CENTER.y} r="185" fill="none" stroke="#18352A" strokeDasharray="2 8" />

        {LINKS.map(([from, to], i) => {
          const a = pos(from)
          const b = pos(to)
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#18352A" strokeWidth="1" />
        })}

        {/* a few "packets" travelling along links toward the shield */}
        {['k', 'n', 'c', 'h'].map((id, i) => {
          const n = pos(id)
          return (
            <circle key={id} r="2.5" fill="#4ADE80">
              <animate attributeName="cx" values={`${n.x};${CENTER.x}`} dur={`${3 + i * 0.7}s`} repeatCount="indefinite" begin={`${i * 0.6}s`} />
              <animate attributeName="cy" values={`${n.y};${CENTER.y}`} dur={`${3 + i * 0.7}s`} repeatCount="indefinite" begin={`${i * 0.6}s`} />
              <animate attributeName="opacity" values="0;1;0" dur={`${3 + i * 0.7}s`} repeatCount="indefinite" begin={`${i * 0.6}s`} />
            </circle>
          )
        })}

        {NODES.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.r + 5} fill="#32D583" opacity="0.06" />
            <circle cx={n.x} cy={n.y} r={n.r} fill="#0B1713" stroke="#32D583" strokeWidth="1.2" />
          </g>
        ))}

        {/* two nodes drawn in red to hint at flagged hosts */}
        <circle cx={410} cy={350} r="4" fill="#FF4D4D" opacity="0.9" />
        <circle cx={60} cy={70} r="5" fill="#F59E0B" opacity="0.9" />
      </svg>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-brand/50 bg-card shadow-[0_0_40px_rgba(50,213,131,0.25)]">
          <Shield size={46} className="text-brand" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
}
