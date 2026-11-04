import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useSimLoop } from '../sim/useSimLoop'
import { useLab, type PanelTab } from '../store/lab'
import { GuideCard, GuideSync } from './guide'
import { CircuitPanel } from './panels/CircuitPanel'
import { EnvPanel } from './panels/EnvPanel'
import { MissionPanel } from './panels/MissionPanel'
import { MonitorPanel } from './panels/MonitorPanel'
import { RulesPanel } from './panels/RulesPanel'
import { IntroModal } from './panels/Intro'
import { SceneOverlay } from './SceneOverlay'
import { TopBar } from './TopBar'

const LabScene = lazy(() => import('../scene/LabScene'))

const TABS: Array<{ id: PanelTab; th: string; icon: string }> = [
  { id: 'mission', th: 'ภารกิจ', icon: '🎯' },
  { id: 'circuit', th: 'วงจร', icon: '🔌' },
  { id: 'env', th: 'สภาพแวดล้อม', icon: '🌡️' },
  { id: 'monitor', th: 'มอนิเตอร์', icon: '📈' },
  { id: 'rules', th: 'กฎ', icon: '🧠' },
]

function useIsDesktop() {
  const q = '(min-width: 1024px)'
  const [d, setD] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setD(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return d
}

function SceneLoading({ stage }: { stage: number }) {
  const labels = ['กำลังโหลดโมดูล 3 มิติ…', 'กำลังสร้างห้องแล็บ…', 'พร้อมแล้ว!']
  const pct = [35, 80, 100][stage]
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink-950">
      <div className="w-64 text-center">
        <p className="mb-3 text-sm text-cyan-100">{labels[stage]}</p>
        <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-cyan-400 transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-400">{pct}%</p>
      </div>
    </div>
  )
}

function SceneStage() {
  const [stage, setStage] = useState(0)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void import('../scene/LabScene').then(() => setStage((s) => Math.max(s, 1)))
  }, [])
  return (
    <>
      <Suspense fallback={null}>
        <LabScene
          onReady={() => {
            setStage(2)
            setTimeout(() => setReady(true), 350)
          }}
        />
      </Suspense>
      {!ready && <SceneLoading stage={stage} />}
    </>
  )
}

function Panel({ desktop }: { desktop: boolean }) {
  const tab = useLab((s) => s.panelTab)
  const setTab = useLab((s) => s.setTab)
  const sheet = useLab((s) => s.sheet)
  const setSheet = useLab((s) => s.setSheet)
  const startY = useRef<number | null>(null)

  const body = (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-3">
      {tab === 'mission' && <MissionPanel />}
      {tab === 'circuit' && <CircuitPanel />}
      {tab === 'env' && <EnvPanel />}
      {tab === 'monitor' && <MonitorPanel />}
      {tab === 'rules' && <RulesPanel />}
    </div>
  )
  const tabs = (
    <nav className="flex shrink-0 gap-1 overflow-x-auto scroll-thin border-b border-white/10 px-2 py-1" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => {
            setTab(t.id)
            if (!desktop && sheet === 'peek') setSheet('half')
          }}
          className={`flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-3 text-sm font-semibold ${tab === t.id ? 'bg-cyan-500/20 text-cyan-100' : 'text-slate-300 hover:bg-white/5'}`}
        >
          <span aria-hidden>{t.icon}</span>
          {t.th}
        </button>
      ))}
    </nav>
  )

  if (desktop)
    return (
      <aside className="flex w-[430px] shrink-0 flex-col border-l border-white/10 bg-ink-950/95">
        {tabs}
        {body}
      </aside>
    )

  const h = sheet === 'peek' ? 'max-h-[45%]' : sheet === 'half' ? 'h-[50%]' : 'h-[82%]'
  return (
    <section className={`flex shrink-0 flex-col overflow-hidden rounded-t-3xl border-t border-cyan-400/30 bg-ink-950/98 transition-[height] duration-300 ${h}`}>
      <button
        aria-label="ปรับความสูงแผงควบคุม"
        className="flex h-7 shrink-0 cursor-grab items-center justify-center"
        onClick={() => setSheet(sheet === 'peek' ? 'half' : sheet === 'half' ? 'full' : 'peek')}
        onPointerDown={(e) => (startY.current = e.clientY)}
        onPointerUp={(e) => {
          if (startY.current == null) return
          const dy = e.clientY - startY.current
          startY.current = null
          if (Math.abs(dy) < 25) return
          if (dy < 0) setSheet(sheet === 'peek' ? 'half' : 'full')
          else setSheet(sheet === 'full' ? 'half' : 'peek')
        }}
      >
        <span className="h-1.5 w-12 rounded-full bg-white/30" />
      </button>
      <div className="shrink-0">
        <GuideCard docked />
      </div>
      {tabs}
      {sheet !== 'peek' && body}
    </section>
  )
}

export default function LabPage() {
  const desktop = useIsDesktop()
  useSimLoop(true)
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className={`relative flex min-h-0 flex-1 ${desktop ? 'flex-row' : 'flex-col'}`}>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <SceneStage />
          <SceneOverlay />
        </div>
        <Panel desktop={desktop} />
      </div>
      <IntroModal />
      <GuideSync />
    </div>
  )
}
