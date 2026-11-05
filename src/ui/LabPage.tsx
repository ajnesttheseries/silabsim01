import { lazy, Suspense, useEffect, useState } from 'react'
import { useSimLoop } from '../sim/useSimLoop'
import { useLab, type PanelTab } from '../store/lab'
import { GuideCard, GuideSync, useGuideView } from './guide'
import { LabSheet } from './LabSheet'
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
  const guided = useLab((s) => s.guided)
  const g = useGuideView((s) => s.g)
  const hiddenLabel = guided && g ? (g.current ? `🧭 ขั้น ${g.index + 1}/${g.total}` : '🧭 ครบทุกขั้นแล้ว') : undefined
  return (
    <LabSheet
      desktop={desktop}
      sheet={sheet}
      setSheet={setSheet}
      tabs={TABS}
      tab={tab}
      setTab={setTab}
      accent="cyan"
      width="w-[430px]"
      hiddenLabel={hiddenLabel}
      guide={<GuideCard docked />}
      guideCompact={<GuideCard docked compact onExpand={() => setSheet('half')} />}
      body={
        <>
          {tab === 'mission' && <MissionPanel />}
          {tab === 'circuit' && <CircuitPanel />}
          {tab === 'env' && <EnvPanel />}
          {tab === 'monitor' && <MonitorPanel />}
          {tab === 'rules' && <RulesPanel />}
        </>
      }
    />
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
