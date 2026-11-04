import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { componentName, CATALOG } from '../engine/circuit/catalog'
import { computeGuide, type GuideResult, type GuideStep } from '../engine/guide'
import { MISSIONS } from '../engine/missions'
import { ACTUATOR_INFO } from '../engine/rules'
import { WIRE_HEX } from '../scene/models/boards'
import { missionCtx, useLab } from '../store/lab'
import { Btn, ByteBot } from './common'

/** Latest guide result, shared by the 3D markers and the 2D guide card. */
export const useGuideView = create<{ g: GuideResult | null }>(() => ({ g: null }))

const WIRE_TH: Record<string, string> = { red: 'แดง', black: 'ดำ', yellow: 'เหลือง', green: 'เขียว', blue: 'น้ำเงิน', orange: 'ส้ม', white: 'ขาว' }

/** Recomputes the guide on every store change and moves camera/panel when the step changes. */
export function GuideSync() {
  const state = useLab()
  const g = useMemo(
    () => (state.guided && state.route === 'lab' ? computeGuide(state.progress.current, { ...missionCtx(state), circuit: state.circuit }) : null),
    [state],
  )
  // publish only when something visible changed (the store updates 10× per second)
  const sig = g ? `${state.progress.current}|${g.current?.id}|${g.index}|${g.note}|${g.wireNodes?.join()}|${g.steps.map((s) => (s.done ? 1 : 0)).join('')}|${g.steps.length}` : 'off'
  useEffect(() => {
    useGuideView.setState({ g })
  }, [sig])
  const stepId = g?.current?.id
  useEffect(() => {
    const cur = useGuideView.getState().g?.current
    if (!cur) return
    const st = useLab.getState()
    if (cur.camera && cur.camera !== st.camera.preset && st.progress.tutorial.seenIntro) st.setCamera(cur.camera)
    if (cur.panel && st.panelTab !== cur.panel) {
      st.setTab(cur.panel)
      if (st.sheet === 'peek') st.setSheet('half')
    }
  }, [stepId])
  return null
}

function StepAction({ step }: { step: GuideStep }) {
  const s = useLab()
  switch (step.kind) {
    case 'usb':
      return (
        <Btn variant="primary" onClick={() => s.setUsb(true)}>
          🔌 เสียบสาย USB
        </Btn>
      )
    case 'place': {
      const c = step.comp!
      const active = s.placing && s.placing.type === c.type && s.placing.variant === c.variant
      return active ? (
        <span className="text-xs text-amber-200">👇 แตะรูที่มีลูกศรชี้บนเบรดบอร์ด (เงาสีเขียวคือตำแหน่งที่ถูก)</span>
      ) : (
        <Btn
          variant="primary"
          onClick={() => {
            s.startPlacing({ type: c.type, variant: c.variant, flipped: c.flipped })
            s.setCamera('breadboard')
          }}
        >
          📦 หยิบ {componentName(c)}
        </Btn>
      )
    }
    case 'install':
      return (
        <Btn variant="primary" onClick={() => s.installModule(step.install!)}>
          🔧 ติดตั้ง {CATALOG[step.install!].nameTh}
        </Btn>
      )
    case 'wire': {
      const color = step.wire!.color
      if (s.mode === 'wire' && s.wireColor === color)
        return <span className="text-xs text-amber-200">{s.wireStart ? '👇 แตะจุดที่มีลูกศรอีกจุดเพื่อจบสาย' : '👇 แตะจุดที่มีลูกศรจุดแรก แล้วแตะอีกจุด'}</span>
      return (
        <Btn
          variant="primary"
          onClick={() => {
            s.setWireColor(color)
            s.setMode('wire')
          }}
        >
          <span className="h-4 w-4 rounded-full border border-white/70" style={{ background: WIRE_HEX[color] }} /> เริ่มต่อสาย (สี{WIRE_TH[color]})
        </Btn>
      )
    }
    case 'power':
      return (
        <Btn variant="success" onClick={() => s.setPower(true)}>
          ⚡ จ่ายไฟ
        </Btn>
      )
    case 'rule': {
      const r = step.rule!
      return (
        <Btn
          variant="primary"
          onClick={() => {
            s.addRule({ sensor: r.sensor, op: r.op, value: r.value, actuator: r.actuator, action: 'on', otherwise: true })
            s.setTab('rules')
          }}
        >
          ＋ เพิ่มกฎนี้ ({ACTUATOR_INFO[r.actuator].th})
        </Btn>
      )
    }
    case 'test':
      return (
        <Btn variant="primary" onClick={s.runAutoTest}>
          🧪 ทดสอบอัตโนมัติ
        </Btn>
      )
    case 'select':
      return step.shelf ? <Btn onClick={() => s.setCamera('shelf')}>🎥 ไปที่ชั้นวาง</Btn> : null
    case 'observe':
      if (step.observe === 'heater')
        return (
          <Btn variant="primary" onClick={() => s.setControls({ heater: 100 })}>
            🔥 เปิดฮีตเตอร์ 100%
          </Btn>
        )
      if (step.observe === 'light')
        return (
          <div className="flex flex-wrap gap-1.5">
            <Btn variant="primary" onClick={() => s.setControls({ lamp: 100, curtainOpen: true })}>
              💡 เปิดไฟโคม
            </Btn>
            <Btn onClick={() => s.setControls({ lamp: 0, curtainOpen: false })}>🌑 ปิดไฟ + ม่าน</Btn>
          </div>
        )
      if (step.observe === 'blink')
        return (
          <Btn variant="primary" onClick={() => s.setBlink('ledRed', true)}>
            ✨ สั่งกระพริบ
          </Btn>
        )
      return <Btn onClick={() => s.setTab('mission')}>📋 เปิดแผงภารกิจ</Btn>
    case 'choose':
      return <Btn onClick={() => s.setTab('mission')}>📋 เปิดแผงภารกิจ</Btn>
    default:
      return null
  }
}

/** Step card: floats over the 3D scene on desktop, docked into the bottom sheet on phones/tablets. */
export function GuideCard({ docked = false }: { docked?: boolean }) {
  const g = useGuideView((s) => s.g)
  const guided = useLab((s) => s.guided)
  const setGuided = useLab((s) => s.setGuided)
  const removeLastWire = useLab((s) => s.removeLastWire)
  const wires = useLab((s) => s.circuit.wires.length)
  const mission = useLab((s) => s.progress.current)
  const done = useLab((s) => s.progress.completed.includes(s.progress.current))
  const goMission = useLab((s) => s.goMission)
  const [open, setOpen] = useState(true)
  if (!guided || !g) return null
  const step = g.current
  const header = (
    <span className="text-xs font-bold text-cyan-300">
      🧭 พาทำ · {step ? `ขั้น ${g.index + 1}/${g.total}` : 'ครบทุกขั้นแล้ว'}
    </span>
  )
  const shell = docked ? 'w-full border-b border-cyan-400/20 bg-ink-900/90 px-3 py-2' : 'glass anim-pop pointer-events-auto w-[min(94vw,460px)] rounded-2xl p-3'
  if (!open)
    return (
      <button
        className={`${docked ? 'w-full border-b border-cyan-400/20 bg-ink-900/90' : 'glass pointer-events-auto max-w-[min(92vw,460px)] rounded-2xl'} flex min-h-11 items-center gap-2 px-3 text-left text-xs`}
        onClick={() => setOpen(true)}
      >
        {header}
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
        <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${(Math.min(g.index, g.total) / Math.max(1, g.total)) * 100}%` }} />
      </div>
      {step ? (
        <>
          <p className="text-sm font-semibold text-white">{step.title}</p>
          <p className="mt-0.5 text-xs text-slate-300">💡 {step.why}</p>
        </>
      ) : (
        <p className="text-sm font-semibold text-emerald-200">
          ✅ ทำครบทุกขั้นแล้ว! {done ? 'ภารกิจนี้ผ่านแล้ว' : 'รอให้เป้าหมายในแผงภารกิจครบอีกนิด'}
        </p>
      )}
      {g.note && <p className="mt-1.5 rounded-lg bg-amber-900/60 px-2 py-1 text-xs text-amber-100">⚠️ {g.note}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {step && <StepAction step={step} />}
        {!step && done && MISSIONS[mission + 1] && (
          <Btn variant="primary" onClick={() => goMission(mission + 1)}>
            ไปภารกิจถัดไป →
          </Btn>
        )}
        {wires > 0 && (step?.kind === 'wire' || g.note) && (
          <Btn variant="ghost" onClick={removeLastWire}>
            ↶ ลบสายล่าสุด
          </Btn>
        )}
      </div>
    </div>
  )
}

/** Mode switch + step checklist for the mission panel. */
export function GuidePanelSection() {
  const guided = useLab((s) => s.guided)
  const setGuided = useLab((s) => s.setGuided)
  const g = useGuideView((s) => s.g)
  return (
    <section className="rounded-2xl border border-cyan-400/30 bg-ink-900/70 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-cyan-200">วิธีทำภารกิจ</h3>
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
            <li key={step.id} className={`flex gap-2 rounded-lg px-1.5 py-1 text-xs ${i === g.index ? 'bg-cyan-500/20 font-semibold text-white' : done ? 'text-emerald-200' : 'text-slate-400'}`}>
              <span aria-hidden>{done ? '✅' : i === g.index ? '👉' : '⬜'}</span>
              <span>
                {i + 1}. {step.title}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-slate-300">โหมดทำเอง: ดูเป้าหมายด้านล่างแล้วออกแบบวงจรด้วยตัวเอง ติดตรงไหนกด "ขอคำใบ้" หรือสลับเป็นโหมดพาทำได้ทุกเมื่อ</p>
      )}
    </section>
  )
}
