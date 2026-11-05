import { useMemo, useState } from 'react'
import {
  ACTUATOR_INFO,
  conditionTrue,
  generateArduino,
  generateMicroPython,
  pinMapFromReport,
  SENSOR_INFO,
  type ActuatorKey,
  type Rule,
  type SensorKey,
} from '../../engine/rules'
import { useLab } from '../../store/lab'
import { Btn, Modal, Section } from '../common'

const SEL = 'h-11 rounded-xl border border-white/15 bg-ink-900 px-2 text-sm text-cyan-50'

function RuleRow({ r }: { r: Rule }) {
  const update = useLab((s) => s.updateRule)
  const remove = useLab((s) => s.removeRule)
  const readings = useLab((s) => s.simView.readings)
  const report = useLab((s) => s.report)
  const comps = useLab((s) => s.circuit.components)
  const pins = useMemo(() => pinMapFromReport(report, comps), [report, comps])
  const info = SENSOR_INFO[r.sensor]
  const cond = conditionTrue(r, readings)
  const wired = pins[r.actuator] !== undefined
  const sensorWired = { temp: pins.dht, humidity: pins.dht, light: pins.ldr, soil: pins.soil, motion: pins.pir }[r.sensor] !== undefined
  return (
    <div className={`rounded-xl border p-2 ${r.enabled ? 'border-cyan-400/30 bg-ink-800/70' : 'border-white/5 bg-ink-900/40 opacity-60'}`}>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="rounded-lg bg-violet-500/30 px-2 py-1 font-bold">ถ้า</span>
        <select
          className={SEL}
          value={r.sensor}
          onChange={(e) => {
            const s = e.target.value as SensorKey
            update(r.id, { sensor: s, value: SENSOR_INFO[s].def, op: s === 'motion' ? '>' : r.op })
          }}
          aria-label="เซนเซอร์"
        >
          {(Object.keys(SENSOR_INFO) as SensorKey[]).map((k) => (
            <option key={k} value={k}>
              {SENSOR_INFO[k].th}
            </option>
          ))}
        </select>
        {r.sensor === 'motion' ? (
          <select className={SEL} value={r.op} onChange={(e) => update(r.id, { op: e.target.value as Rule['op'], value: 1 })} aria-label="เงื่อนไข">
            <option value=">">ตรวจพบ</option>
            <option value="<">ไม่พบ</option>
          </select>
        ) : (
          <>
            <select className={SEL} value={r.op} onChange={(e) => update(r.id, { op: e.target.value as Rule['op'] })} aria-label="เครื่องหมาย">
              <option value=">">มากกว่า (&gt;)</option>
              <option value="<">น้อยกว่า (&lt;)</option>
            </select>
            <input
              type="number"
              className={`${SEL} w-24`}
              value={r.value}
              min={info.min}
              max={info.max}
              step={info.step}
              onChange={(e) => update(r.id, { value: Number(e.target.value) })}
              aria-label="ค่าเกณฑ์"
            />
            <span className="text-xs text-slate-300">{info.unit}</span>
          </>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm">
        <span className="rounded-lg bg-emerald-500/30 px-2 py-1 font-bold">แล้ว</span>
        <select className={SEL} value={r.action} onChange={(e) => update(r.id, { action: e.target.value as Rule['action'] })} aria-label="การทำงาน">
          <option value="on">เปิด</option>
          <option value="off">ปิด</option>
        </select>
        <select className={SEL} value={r.actuator} onChange={(e) => update(r.id, { actuator: e.target.value as ActuatorKey })} aria-label="อุปกรณ์">
          {(Object.keys(ACTUATOR_INFO) as ActuatorKey[]).map((k) => (
            <option key={k} value={k}>
              {ACTUATOR_INFO[k].th}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <label className="flex min-h-10 items-center gap-1.5">
          <input type="checkbox" className="h-5 w-5 accent-cyan-400" checked={r.otherwise} onChange={(e) => update(r.id, { otherwise: e.target.checked })} />
          ไม่เช่นนั้น {r.action === 'on' ? 'ปิด' : 'เปิด'} (ELSE)
        </label>
        <label className="flex min-h-10 items-center gap-1.5">
          <input type="checkbox" className="h-5 w-5 accent-cyan-400" checked={r.enabled} onChange={(e) => update(r.id, { enabled: e.target.checked })} />
          ใช้งาน
        </label>
        <Btn variant="ghost" onClick={() => remove(r.id)} aria-label="ลบกฎ">
          🗑
        </Btn>
      </div>
      <p className="mt-1 text-xs">
        สถานะตอนนี้:{' '}
        {cond === null ? (
          <span className="text-amber-300">อ่านค่าเซนเซอร์ไม่ได้ → กฎนี้ยังไม่ทำงาน</span>
        ) : cond ? (
          <span className="text-emerald-300">เงื่อนไขเป็นจริง ✔</span>
        ) : (
          <span className="text-slate-300">เงื่อนไขเป็นเท็จ</span>
        )}
        {!wired && <span className="ml-1 text-rose-300">· {ACTUATOR_INFO[r.actuator].th} ยังไม่ได้ต่อกับ GPIO</span>}
        {!sensorWired && <span className="ml-1 text-rose-300">· ยังไม่พบเซนเซอร์{SENSOR_INFO[r.sensor].th}ในวงจร</span>}
      </p>
    </div>
  )
}

function CodeView() {
  const [lang, setLang] = useState<'ino' | 'py'>('ino')
  const [open, setOpen] = useState(false)
  const rules = useLab((s) => s.rules)
  const report = useLab((s) => s.report)
  const comps = useLab((s) => s.circuit.components)
  const cal = useLab((s) => s.soilCal)
  const code = useMemo(() => {
    const pm = pinMapFromReport(report, comps)
    return lang === 'ino' ? generateArduino(rules, pm, cal) : generateMicroPython(rules, pm, cal)
  }, [lang, rules, report, comps, cal])
  return (
    <>
      <Btn onClick={() => setOpen(true)} disabled={!rules.length}>
        {'</>'} ดูเป็นโค้ด
      </Btn>
      <Modal open={open} onClose={() => setOpen(false)} title="โค้ดที่วิศวกรเขียนจริง (อ่านอย่างเดียว)" wide>
        <div className="mb-2 flex gap-2">
          <Btn variant={lang === 'ino' ? 'primary' : 'soft'} onClick={() => setLang('ino')}>
            Arduino C++
          </Btn>
          <Btn variant={lang === 'py' ? 'primary' : 'soft'} onClick={() => setLang('py')}>
            MicroPython
          </Btn>
        </div>
        <pre className="max-h-[60vh] overflow-auto rounded-xl bg-black/70 p-3 font-mono text-xs leading-relaxed text-emerald-200" tabIndex={0}>
          {code}
        </pre>
        <p className="mt-2 text-xs text-slate-400">เลขขาในโค้ดมาจากวงจรที่น้องต่อจริงในแล็บ ถ้าเปลี่ยนสาย โค้ดจะเปลี่ยนตาม</p>
      </Modal>
    </>
  )
}

function ManualTest() {
  const manual = useLab((s) => s.manual)
  const setManual = useLab((s) => s.setManual)
  const rules = useLab((s) => s.rules)
  const byKey = useLab((s) => s.simView.actuators.byKey)
  const ruled = new Set(rules.filter((r) => r.enabled).map((r) => r.actuator))
  return (
    <Section title="ทดสอบสั่งงานด้วยมือ (Manual)">
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(ACTUATOR_INFO) as ActuatorKey[]).map((k) => (
          <Btn key={k} variant={manual[k] ? 'success' : 'soft'} onClick={() => setManual(k, manual[k] ? undefined : true)} disabled={ruled.has(k)}>
            {byKey[k] ? '🟢' : '⚫'} {ACTUATOR_INFO[k].th}
          </Btn>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-400">อุปกรณ์ที่มีกฎควบคุมอยู่จะสั่งด้วยมือไม่ได้ เพราะระบบตัดสินใจเอง · 🟢 = ทำงานจริงในฉาก</p>
    </Section>
  )
}

export function RulesPanel() {
  const rules = useLab((s) => s.rules)
  const addRule = useLab((s) => s.addRule)
  const challenge = useLab((s) => s.progress.challenge)
  return (
    <div className="space-y-3">
      <Section title="ตัวสร้างเงื่อนไข (IF–THEN Rule Builder)" right={<CodeView />}>
        <p className="mb-2 text-xs text-slate-300">ตั้งกฎให้บอร์ด "คิดและทำงานเอง" ทุกครั้งที่อ่านค่าเซนเซอร์ บอร์ดจะตรวจกฎทุกข้อ (กฎด้านล่างมีผลทับกฎด้านบน)</p>
        <div className="space-y-2">
          {rules.map((r) => (
            <RuleRow key={r.id} r={r} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Btn variant="primary" onClick={() => addRule()}>
            ＋ เพิ่มกฎ
          </Btn>
          {challenge === 'classroom' && (
            <>
              <Btn onClick={() => addRule({ sensor: 'temp', op: '>', value: 32, actuator: 'fan', action: 'on' })}>แม่แบบ: ร้อน → พัดลม</Btn>
              <Btn onClick={() => addRule({ sensor: 'light', op: '<', value: 2500, actuator: 'ledRed', action: 'on' })}>แม่แบบ: มืด → ไฟ</Btn>
            </>
          )}
          {challenge === 'pet' && (
            <>
              <Btn onClick={() => addRule({ sensor: 'temp', op: '>', value: 32, actuator: 'fan', action: 'on' })}>แม่แบบ: ร้อน → พัดลม</Btn>
              <Btn onClick={() => addRule({ sensor: 'motion', op: '>', value: 1, actuator: 'ledGreen', action: 'on' })}>แม่แบบ: น้องแมวมา → ไฟต้อนรับ</Btn>
            </>
          )}
          {challenge === 'plant' && (
            <>
              <Btn onClick={() => addRule({ sensor: 'soil', op: '<', value: 35, actuator: 'ledRed', action: 'on' })}>แม่แบบ: ดินแห้ง → LED แดง</Btn>
              <Btn onClick={() => addRule({ sensor: 'soil', op: '<', value: 35, actuator: 'buzzer', action: 'on' })}>แม่แบบ: ดินแห้ง → บัซเซอร์</Btn>
              <Btn onClick={() => addRule({ sensor: 'soil', op: '>', value: 35, actuator: 'ledGreen', action: 'on' })}>แม่แบบ: ดินชื้น → LED เขียว</Btn>
            </>
          )}
        </div>
      </Section>
      <ManualTest />
    </div>
  )
}
