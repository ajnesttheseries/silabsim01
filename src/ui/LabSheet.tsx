import { useRef, type ReactNode } from 'react'

export type SheetState = 'hidden' | 'peek' | 'half' | 'full'

interface Props<T extends string> {
  desktop: boolean
  sheet: SheetState
  setSheet(s: SheetState): void
  tabs: ReadonlyArray<{ id: T; th: string; icon: string }>
  tab: T
  setTab(t: T): void
  /** panel content for the selected tab */
  body: ReactNode
  /** full guide card (half/full sheet on phones) */
  guide?: ReactNode
  /** one-line guide strip (peek sheet on phones) */
  guideCompact?: ReactNode
  /** short status shown on the "show panel" bar while hidden, e.g. "🧭 ขั้น 2/5" */
  hiddenLabel?: string
  accent: 'cyan' | 'fuchsia' | 'teal'
  width: string
}

const ACCENT = {
  cyan: { active: 'bg-cyan-500/20 text-cyan-100', border: 'border-cyan-400/30', btn: 'text-cyan-100' },
  fuchsia: { active: 'bg-fuchsia-500/20 text-fuchsia-100', border: 'border-fuchsia-400/30', btn: 'text-fuchsia-100' },
  teal: { active: 'bg-teal-500/20 text-teal-100', border: 'border-teal-400/30', btn: 'text-teal-100' },
}

/**
 * The lab's control panel. Desktop: a side panel that can collapse to a thin strip.
 * Phone/tablet: a bottom sheet with four sizes. "hidden" gives the 3D scene the
 * whole screen, "peek" shows one guide line + tabs, then "half" and "full".
 */
export function LabSheet<T extends string>(p: Props<T>) {
  const a = ACCENT[p.accent]
  const startY = useRef<number | null>(null)
  const nav = (
    <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto scroll-thin px-2 py-1" role="tablist">
      {p.tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={p.tab === t.id}
          onClick={() => {
            p.setTab(t.id)
            if (!p.desktop && (p.sheet === 'peek' || p.sheet === 'hidden')) p.setSheet('half')
          }}
          className={`flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-3 text-sm font-semibold ${p.tab === t.id ? a.active : 'text-slate-300 hover:bg-white/5'}`}
        >
          <span aria-hidden>{t.icon}</span>
          {t.th}
        </button>
      ))}
    </nav>
  )
  const body = <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-3">{p.body}</div>

  if (p.desktop) {
    if (p.sheet === 'hidden')
      return (
        <aside className="flex w-12 shrink-0 flex-col items-center gap-2 border-l border-white/10 bg-ink-950/95 py-2">
          <button className={`min-h-11 w-10 rounded-xl border border-white/10 bg-ink-800 text-lg ${a.btn} hover:bg-ink-700`} onClick={() => p.setSheet('half')} aria-label="แสดงแผงควบคุม" title="แสดงแผงควบคุม">
            ◀
          </button>
          <button className="text-xs text-slate-300 [writing-mode:vertical-rl]" onClick={() => p.setSheet('half')}>
            แผงควบคุม {p.hiddenLabel ? `· ${p.hiddenLabel}` : ''}
          </button>
        </aside>
      )
    return (
      <aside className={`flex ${p.width} shrink-0 flex-col border-l border-white/10 bg-ink-950/95`}>
        <div className="flex shrink-0 items-center border-b border-white/10">
          {nav}
          <button className="mr-1 min-h-11 min-w-11 shrink-0 rounded-xl text-slate-300 hover:bg-white/10" onClick={() => p.setSheet('hidden')} aria-label="ซ่อนแผงควบคุม (ขยายพื้นที่ฉาก)" title="ซ่อนแผงควบคุม">
            ▶
          </button>
        </div>
        {body}
      </aside>
    )
  }

  if (p.sheet === 'hidden')
    return (
      <section className={`shrink-0 border-t ${a.border} bg-ink-950/98`}>
        <button className={`flex min-h-12 w-full items-center justify-center gap-2 px-3 text-sm font-semibold ${a.btn}`} onClick={() => p.setSheet('peek')} aria-label="แสดงแผงควบคุม">
          <span aria-hidden>▴</span> แสดงแผงควบคุม
          {p.hiddenLabel && <span className="truncate text-xs font-normal text-slate-300">· {p.hiddenLabel}</span>}
        </button>
      </section>
    )

  const h = p.sheet === 'peek' ? '' : p.sheet === 'half' ? 'h-[50%]' : 'h-[82%]'
  const cycle = () => p.setSheet(p.sheet === 'peek' ? 'half' : p.sheet === 'half' ? 'full' : 'peek')
  return (
    <section className={`flex shrink-0 flex-col overflow-hidden rounded-t-3xl border-t ${a.border} bg-ink-950/98 transition-[height] duration-300 ${h}`}>
      <div className="relative flex h-11 shrink-0 items-center justify-center">
        <button
          aria-label="ปรับความสูงแผงควบคุม"
          className="flex h-full flex-1 cursor-grab items-center justify-center"
          onClick={cycle}
          onPointerDown={(e) => (startY.current = e.clientY)}
          onPointerUp={(e) => {
            if (startY.current == null) return
            const dy = e.clientY - startY.current
            startY.current = null
            if (Math.abs(dy) < 25) return
            if (dy < 0) p.setSheet(p.sheet === 'peek' ? 'half' : 'full')
            else p.setSheet(p.sheet === 'full' ? 'half' : p.sheet === 'half' ? 'peek' : 'hidden')
          }}
        >
          <span className="h-1.5 w-12 rounded-full bg-white/30" />
        </button>
        <button className="absolute right-1 top-0 flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-xs text-slate-300 hover:bg-white/10" onClick={() => p.setSheet('hidden')} aria-label="ซ่อนแผงควบคุม (ขยายพื้นที่ฉาก)">
          ซ่อน ▾
        </button>
      </div>
      <div className="shrink-0">{p.sheet === 'peek' ? p.guideCompact : p.guide}</div>
      <div className="shrink-0 border-b border-white/10">{nav}</div>
      {p.sheet !== 'peek' && body}
    </section>
  )
}
