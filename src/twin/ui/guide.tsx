import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { useLab } from '../../store/lab'
import { Btn, ByteBot } from '../../ui/common'
import { TEMP_DATASHEET } from '../engine/daq'
import { twinGuide, TWIN_MISSIONS, type TwinGuideStep } from '../engine/missions'
import { SENSORS } from '../engine/robot'
import { twinCtx, useTwin } from '../store'

type TwinGuideResult = ReturnType<typeof twinGuide>
export const useTwinGuideView = create<{ g: TwinGuideResult | null }>(() => ({ g: null }))

export function TwinGuideSync() {
  const s = useTwin()
  const route = useLab((x) => x.route)
  const g = useMemo(() => (s.guided && route === 'twin' ? twinGuide(s.progress.current, twinCtx(s)) : null), [s, route])
  const sig = g ? `${s.progress.current}|${g.current?.id}|${g.index}|${g.note}|${s.picked}|${g.steps.map((x) => (x.done ? 1 : 0)).join('')}` : 'off'
  useEffect(() => {
    useTwinGuideView.setState({ g })
  }, [sig])
  const stepId = g?.current?.id
  useEffect(() => {
    const cur = useTwinGuideView.getState().g?.current
    if (!cur) return
    const st = useTwin.getState()
    if (cur.camera && cur.camera !== st.camera.preset && st.progress.tutorial.seenIntro) st.setCamera(cur.camera)
    if (cur.panel && st.panelTab !== cur.panel) {
      st.setTab(cur.panel)
      if (st.sheet === 'peek' || st.sheet === 'hidden') st.setSheet('half')
    }
  }, [stepId])
  return null
}

function Action({ step }: { step: TwinGuideStep }) {
  const s = useTwin()
  switch (step.kind) {
    case 'select':
      return step.camera ? <Btn onClick={() => s.setCamera(step.camera!)}>🎥 ไปดู</Btn> : null
    case 'mount':
      return s.picked === step.sensor ? (
        <span className="text-xs text-amber-200">👇 แตะจุดที่มีลูกศรบนตัวหุ่น ({SENSORS[step.sensor!].nameTh})</span>
      ) : (
        <Btn variant="primary" onClick={() => s.pick(step.sensor!)}>
          ✋ หยิบ{SENSORS[step.sensor!].nameTh}
        </Btn>
      )
    case 'rate':
      return (
        <Btn
          variant="primary"
          onClick={() => {
            s.setRate(step.sensor!, step.rate!)
            s.setTab('data')
          }}
        >
          ⏱ ตั้ง {step.rate} ครั้ง/วินาที
        </Btn>
      )
    case 'link':
      return <Btn onClick={() => s.setTab('data')}>📶 เปิดแท็บข้อมูล</Btn>
    case 'pose':
      return (
        <Btn variant="primary" onClick={() => s.setHold(true)}>
          🧍 ให้หุ่นยืนท่าเตรียม
        </Btn>
      )
    case 'zero':
      return (
        <Btn variant="primary" onClick={s.zeroEncoder}>
          🎯 ตั้งศูนย์ Encoder
        </Btn>
      )
    case 'tempcal':
      return (
        <Btn
          variant="primary"
          onClick={() => {
            s.setTempCal({ ...TEMP_DATASHEET })
            s.setTab('calib')
          }}
        >
          ＋ ใส่ค่าตาม Datasheet
        </Btn>
      )
    case 'rule':
      return (
        <Btn
          variant="primary"
          onClick={() => {
            s.setRule(step.rule!, step.value!)
            s.setTab('monitor')
          }}
        >
          ＋ ตั้งค่า {step.value}
          {step.rule === 'tempMax' ? ' °C' : step.rule === 'vibMax' ? ' g' : '%'}
        </Btn>
      )
    case 'test':
      return (
        <Btn variant="primary" onClick={s.runTest}>
          🧪 ทดสอบแฝดอัตโนมัติ
        </Btn>
      )
    case 'observe':
      return <Btn onClick={() => s.setTab('mission')}>📋 เปิดแผงภารกิจ</Btn>
    case 'info':
      return step.panel ? <Btn onClick={() => s.setTab(step.panel!)}>📋 เปิดแผง</Btn> : null
    default:
      return null
  }
}

export function TwinGuideCard({ docked = false, compact = false, onExpand }: { docked?: boolean; compact?: boolean; onExpand?: () => void }) {
  const g = useTwinGuideView((s) => s.g)
  const guided = useTwin((s) => s.guided)
  const setGuided = useTwin((s) => s.setGuided)
  const mission = useTwin((s) => s.progress.current)
  const done = useTwin((s) => s.progress.completed.includes(s.progress.current))
  const goMission = useTwin((s) => s.goMission)
  const [open, setOpen] = useState(true)
  if (!guided || !g) return null
  const step = g.current
  const header = <span className="shrink-0 whitespace-nowrap text-xs font-bold text-teal-300">🧭 พาทำ · {step ? `ขั้น ${g.index + 1}/${g.total}` : 'ครบทุกขั้นแล้ว'}</span>
  const shell = docked ? 'w-full border-b border-teal-400/20 bg-ink-900/90 px-3 py-2' : 'glass anim-pop pointer-events-auto w-[min(94vw,460px)] rounded-2xl p-3'
  if (!open || compact)
    return (
      <button
        className={`${docked ? 'w-full border-b border-teal-400/20 bg-ink-900/90' : 'glass pointer-events-auto rounded-2xl'} flex min-h-11 items-center gap-2 px-3 text-left text-xs`}
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
        <div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${(Math.min(g.index, g.total) / Math.max(1, g.total)) * 100}%` }} />
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
        {!step && done && TWIN_MISSIONS[mission + 1] && (
          <Btn variant="primary" onClick={() => goMission(mission + 1)}>
            ไปภารกิจถัดไป →
          </Btn>
        )}
      </div>
    </div>
  )
}

export function TwinGuidePanelSection() {
  const guided = useTwin((s) => s.guided)
  const setGuided = useTwin((s) => s.setGuided)
  const g = useTwinGuideView((s) => s.g)
  return (
    <section className="rounded-2xl border border-teal-400/30 bg-ink-900/70 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-teal-200">วิธีทำภารกิจ</h3>
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
            <li key={step.id} className={`flex gap-2 rounded-lg px-1.5 py-1 text-xs ${i === g.index ? 'bg-teal-500/20 font-semibold text-white' : done ? 'text-emerald-200' : 'text-slate-400'}`}>
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
