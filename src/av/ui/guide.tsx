import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { useLab } from '../../store/lab'
import { Btn, ByteBot } from '../../ui/common'
import { avGuide, AV_MISSIONS, type AvGuideStep } from '../engine/missions'
import { PORTS } from '../engine/patch'
import { SOLUTION_EXHIBIT, type Cue } from '../engine/show'
import { avSound } from '../sound'
import { avCtx, useAv } from '../store'

type AvGuideResult = ReturnType<typeof avGuide>
export const useAvGuideView = create<{ g: AvGuideResult | null }>(() => ({ g: null }))

const CUE_TEMPLATES: Array<Partial<Cue>> = [
  { time: 0, name: 'Intro', parColor: 'blue', parLevel: 40, mover: 'off', wall: 'logo', mic: 'mute' },
  { time: 6, name: 'Verse', parColor: 'blue', parLevel: 30, mover: 'singer', wall: 'lyrics', mic: 'live' },
  { time: 14, name: 'Chorus', parColor: 'red', parLevel: 100, mover: 'singer', wall: 'visualizer', mic: 'live' },
  { time: 28, name: 'Blackout', parColor: 'black', parLevel: 0, mover: 'off', wall: 'off', mic: 'mute' },
]

export function AvGuideSync() {
  const s = useAv()
  const route = useLab((x) => x.route)
  const g = useMemo(() => (s.guided && route === 'av' ? avGuide(s.progress.current, avCtx(s)) : null), [s, route])
  const sig = g ? `${s.progress.current}|${g.current?.id}|${g.index}|${g.note}|${g.steps.map((x) => (x.done ? 1 : 0)).join('')}` : 'off'
  useEffect(() => {
    useAvGuideView.setState({ g })
  }, [sig])
  const stepId = g?.current?.id
  useEffect(() => {
    const cur = useAvGuideView.getState().g?.current
    if (!cur) return
    const st = useAv.getState()
    if (cur.camera && cur.camera !== st.camera.preset && st.progress.tutorial.seenIntro) st.setCamera(cur.camera)
    if (cur.panel && st.panelTab !== cur.panel) {
      st.setTab(cur.panel)
      if (st.sheet === 'peek' || st.sheet === 'hidden') st.setSheet('half')
    }
    if (cur.fixture) st.selectFixture(cur.fixture)
  }, [stepId])
  return null
}

function Action({ step }: { step: AvGuideStep }) {
  const s = useAv()
  switch (step.kind) {
    case 'cable':
      return s.mode === 'cable' ? (
        <span className="text-xs text-amber-200">
          👇 แตะช่อง {s.cableStart ? `"${PORTS[step.cable!.to].label}" ที่มีลูกศรอีกจุด` : `"${PORTS[step.cable!.from].label}" ที่มีลูกศร แล้วแตะอีกจุด`}
        </span>
      ) : (
        <Btn variant="primary" onClick={() => s.setMode('cable')}>
          🔌 เริ่มเสียบสาย
        </Btn>
      )
    case 'address':
    case 'color':
      return (
        <Btn
          variant="primary"
          onClick={() => {
            s.selectFixture(step.fixture!)
            s.setTab('light')
          }}
        >
          🎚️ เปิดคอนโซลแสง ({step.fixture!.toUpperCase()})
        </Btn>
      )
    case 'power':
      return (
        <Btn variant="success" onClick={() => s.setPower(step.power!, true)}>
          ⚡ เปิด{step.power === 'mixer' ? 'มิกเซอร์' : 'เพาเวอร์แอมป์'}
        </Btn>
      )
    case 'move':
      return (
        <Btn variant="primary" onClick={() => s.setMixer({ wedgePos: 'front' })}>
          ↪ ย้ายมอนิเตอร์มาหน้านักร้อง
        </Btn>
      )
    case 'cue': {
      const tpl = CUE_TEMPLATES[step.checkpoint!]
      return (
        <Btn
          variant="primary"
          onClick={() => {
            const existing = s.cues.find((c) => c.time === tpl.time)
            if (existing) s.updateCue(existing.id, tpl)
            else s.addCue(tpl)
            s.setTab('show')
          }}
        >
          ＋ ใส่คิวนี้ ({tpl.time} วิ) แล้วลองปรับเอง
        </Btn>
      )
    }
    case 'test':
      return (
        <Btn variant="primary" onClick={s.runShowTest}>
          🧪 ทดสอบโชว์อัตโนมัติ
        </Btn>
      )
    case 'choose':
      return <Btn onClick={() => s.setTab('mission')}>📋 เปิดแผงภารกิจ</Btn>
    case 'scene': {
      const which = step.scene!
      return (
        <Btn
          variant="primary"
          onClick={() => {
            s.updateScene(which, SOLUTION_EXHIBIT()[which])
            s.setExhibitDemo(true)
            s.setVisitor(which === 'visitor')
            s.setTab('show')
            s.setCamera('overview')
          }}
        >
          ＋ ใส่ค่าฉาก{which === 'visitor' ? ' "มีผู้ชม"' : ' "ไม่มีผู้ชม"'} แล้วลองปรับเอง
        </Btn>
      )
    }
    case 'exhibitTest':
      return (
        <Btn variant="primary" onClick={s.runExhibitTest}>
          🧪 ทดสอบนิทรรศการอัตโนมัติ
        </Btn>
      )
    case 'observe':
      if (step.observe === 'gain' || step.observe === 'loud')
        return s.live.rehearsing ? (
          <span className="text-xs text-amber-200">🎤 นักร้องกำลังซ้อม ปรับค่าในแท็บ "เสียง" แล้วดูแถบวัด</span>
        ) : (
          <Btn
            variant="primary"
            onClick={() => {
              avSound.unlock()
              s.setRehearsing(true)
              s.setTab('sound')
            }}
          >
            ▶ ให้นักร้องซ้อมร้อง
          </Btn>
        )
      return <Btn onClick={() => s.setTab('mission')}>📋 เปิดแผงภารกิจ</Btn>
    case 'select':
      return step.camera ? <Btn onClick={() => s.setCamera(step.camera!)}>🎥 ไปดู</Btn> : null
    default:
      return null
  }
}

export function AvGuideCard({ docked = false, compact = false, onExpand }: { docked?: boolean; compact?: boolean; onExpand?: () => void }) {
  const g = useAvGuideView((s) => s.g)
  const guided = useAv((s) => s.guided)
  const setGuided = useAv((s) => s.setGuided)
  const removeLast = useAv((s) => s.removeLastCable)
  const cables = useAv((s) => s.cables.length)
  const mission = useAv((s) => s.progress.current)
  const done = useAv((s) => s.progress.completed.includes(s.progress.current))
  const goMission = useAv((s) => s.goMission)
  const [open, setOpen] = useState(true)
  if (!guided || !g) return null
  const step = g.current
  const header = <span className="shrink-0 whitespace-nowrap text-xs font-bold text-fuchsia-300">🧭 พาทำ · {step ? `ขั้น ${g.index + 1}/${g.total}` : 'ครบทุกขั้นแล้ว'}</span>
  const shell = docked ? 'w-full border-b border-fuchsia-400/20 bg-ink-900/90 px-3 py-2' : 'glass anim-pop pointer-events-auto w-[min(94vw,460px)] rounded-2xl p-3'
  if (!open || compact)
    return (
      <button
        className={`${docked ? 'w-full border-b border-fuchsia-400/20 bg-ink-900/90' : 'glass pointer-events-auto rounded-2xl'} flex min-h-11 items-center gap-2 px-3 text-left text-xs`}
        onClick={() => {
          setOpen(true)
          onExpand?.()
        }}
      >
        {header}
        {g.note && <span aria-label="มีคำเตือน">⚠️</span>}
        <span className="truncate text-cyan-50">{step?.title ?? 'ไปภารกิจถัดไปได้เลย'}</span>
      </button>
    )
  return (
    <div className={shell} role="region" aria-label="โหมดพาทำ" aria-live="polite">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ByteBot size={30} mood={g.note ? 'alert' : step ? 'think' : 'happy'} />
          {header}
        </div>
        <div className="flex gap-1">
          <button className="min-h-9 rounded-lg px-2 text-xs text-slate-300 hover:bg-white/10" onClick={() => setGuided(false)}>
            💪 ทำเอง
          </button>
          <button className="min-h-9 rounded-lg px-2 text-xs text-slate-300 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="ย่อการ์ดพาทำ">
            ▾
          </button>
        </div>
      </div>
      <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-fuchsia-400 transition-all" style={{ width: `${(Math.min(g.index, g.total) / Math.max(1, g.total)) * 100}%` }} />
      </div>
      {step ? (
        <>
          <p className="text-sm font-semibold text-white">{step.title}</p>
          <p className="mt-0.5 text-xs text-slate-300">💡 {step.why}</p>
        </>
      ) : (
        <p className="text-sm font-semibold text-emerald-200">✅ ทำครบทุกขั้นแล้ว! {done ? 'ภารกิจนี้ผ่านแล้ว' : 'รอให้เป้าหมายในแผงภารกิจครบอีกนิด'}</p>
      )}
      {g.note && <p className="mt-1.5 rounded-lg bg-amber-900/60 px-2 py-1 text-xs text-amber-100">⚠️ {g.note}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {step && <Action step={step} />}
        {!step && done && AV_MISSIONS[mission + 1] && (
          <Btn variant="primary" onClick={() => goMission(mission + 1)}>
            ไปภารกิจถัดไป →
          </Btn>
        )}
        {cables > 0 && (step?.kind === 'cable' || g.note) && (
          <Btn variant="ghost" onClick={removeLast}>
            ↶ ถอดสายล่าสุด
          </Btn>
        )}
      </div>
    </div>
  )
}

export function AvGuidePanelSection() {
  const guided = useAv((s) => s.guided)
  const setGuided = useAv((s) => s.setGuided)
  const g = useAvGuideView((s) => s.g)
  return (
    <section className="rounded-2xl border border-fuchsia-400/30 bg-ink-900/70 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-fuchsia-200">วิธีทำภารกิจ</h3>
        <div className="flex gap-1" role="radiogroup" aria-label="เลือกโหมด">
          <Btn variant={guided ? 'primary' : 'soft'} role="radio" aria-checked={guided} onClick={() => setGuided(true)}>
            🧭 พาทำทีละขั้น
          </Btn>
          <Btn variant={!guided ? 'primary' : 'soft'} role="radio" aria-checked={!guided} onClick={() => setGuided(false)}>
            💪 ทำเอง
          </Btn>
        </div>
      </div>
      {guided && g ? (
        <ol className="space-y-1">
          {g.steps.map(({ step, done }, i) => (
            <li key={step.id} className={`flex gap-2 rounded-lg px-1.5 py-1 text-xs ${i === g.index ? 'bg-fuchsia-500/20 font-semibold text-white' : done ? 'text-emerald-200' : 'text-slate-400'}`}>
              <span aria-hidden>{done ? '✅' : i === g.index ? '👉' : '⬜'}</span>
              <span>
                {i + 1}. {step.title}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-slate-300">โหมดทำเอง: ดูเป้าหมายด้านล่างแล้วลงมือเอง ติดตรงไหนกด "ขอคำใบ้" หรือสลับเป็นโหมดพาทำได้ทุกเมื่อ</p>
      )}
    </section>
  )
}
