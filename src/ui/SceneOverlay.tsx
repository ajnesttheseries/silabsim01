import { useState } from 'react'
import { describeHole } from '../engine/circuit/breadboard'
import { BOARD_PIN_MAP } from '../engine/circuit/board'
import {
  BAND_TH,
  CATALOG,
  COMPONENT_LIMITS,
  componentName,
  formatOhms,
  LED_COLOR_TH,
  parsePinNode,
  RESISTOR_BANDS,
  type ComponentType,
  type LedColor,
  type PlacedComponent,
  type ResistorValue,
  type ShelfItem,
} from '../engine/circuit/catalog'
import type { WireColor } from '../engine/circuit/netlist'
import { MISSIONS, objectivesStatus } from '../engine/missions'
import { CAMERAS, type CameraPreset } from '../scene/layout'
import { WIRE_HEX } from '../scene/models/boards'
import { missionCtx, useLab, type Selection } from '../store/lab'
import { Btn, ByteBot } from './common'
import { GuideCard } from './guide'

export function describeNode(node: string, comps: PlacedComponent[]): string {
  if (node.startsWith('bb:')) return `เบรดบอร์ด ${describeHole(node)}`
  if (node.startsWith('mcu:')) {
    const p = BOARD_PIN_MAP[node.slice(4)]
    return p ? `บอร์ด ขา ${p.power ?? `GPIO${p.gpio}`}` : node
  }
  const pn = parsePinNode(node)
  const c = pn && comps.find((x) => x.id === pn.compId)
  if (!c || !pn) return node
  const def = CATALOG[c.type].pinDefs?.find((d) => d.id === pn.pin)
  return `${componentName(c)} ขา ${def?.label ?? pn.pin}`
}

const WIRE_COLORS: Array<{ c: WireColor; th: string }> = [
  { c: 'red', th: 'แดง (VCC)' },
  { c: 'black', th: 'ดำ (GND)' },
  { c: 'yellow', th: 'เหลือง' },
  { c: 'green', th: 'เขียว' },
  { c: 'blue', th: 'น้ำเงิน' },
  { c: 'orange', th: 'ส้ม' },
  { c: 'white', th: 'ขาว' },
]

function CameraChips() {
  const setCamera = useLab((s) => s.setCamera)
  const preset = useLab((s) => s.camera.preset)
  return (
    <div className="pointer-events-auto flex gap-1 overflow-x-auto scroll-thin">
      {(Object.keys(CAMERAS) as CameraPreset[]).map((k) => (
        <button
          key={k}
          onClick={() => setCamera(k)}
          className={`min-h-11 shrink-0 rounded-xl px-3 text-xs font-semibold backdrop-blur ${preset === k ? 'bg-cyan-500 text-slate-950' : 'bg-ink-900/80 text-cyan-100 border border-white/10'}`}
        >
          🎥 {CAMERAS[k].th}
        </button>
      ))}
    </div>
  )
}

function Toolbar() {
  const mode = useLab((s) => s.mode)
  const setMode = useLab((s) => s.setMode)
  const wireColor = useLab((s) => s.wireColor)
  const setWireColor = useLab((s) => s.setWireColor)
  const powerOn = useLab((s) => s.simView.powerOn)
  const setPower = useLab((s) => s.setPower)
  const paused = useLab((s) => s.paused)
  const setPaused = useLab((s) => s.setPaused)
  const speed = useLab((s) => s.speed)
  const setSpeed = useLab((s) => s.setSpeed)
  const [colors, setColors] = useState(false)
  return (
    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1">
      <div className="glass flex items-center gap-0.5 rounded-2xl p-0.5 sm:gap-1 sm:p-1">
        <Btn variant={mode === 'select' ? 'primary' : 'ghost'} onClick={() => setMode('select')} aria-pressed={mode === 'select'} aria-label="โหมดเลือก" className="px-2 sm:px-3">
          👆<span className="hidden sm:inline"> เลือก</span>
        </Btn>
        <Btn variant={mode === 'wire' ? 'primary' : 'ghost'} onClick={() => setMode(mode === 'wire' ? 'select' : 'wire')} aria-pressed={mode === 'wire'} aria-label="โหมดต่อสาย" className="px-2 sm:px-3">
          〰️<span className="hidden sm:inline"> ต่อสาย</span>
        </Btn>
        <button
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15"
          onClick={() => setColors(!colors)}
          aria-label={`สีสาย: ${WIRE_COLORS.find((w) => w.c === wireColor)?.th}`}
        >
          <span className="h-6 w-6 rounded-full border-2 border-white/70" style={{ background: WIRE_HEX[wireColor] }} />
        </button>
        <Btn variant={mode === 'measure' ? 'primary' : 'ghost'} onClick={() => setMode(mode === 'measure' ? 'select' : 'measure')} aria-pressed={mode === 'measure'} aria-label="มัลติมิเตอร์ วัดแรงดัน" className="px-2 sm:px-3">
          📟<span className="hidden sm:inline"> วัดไฟ</span>
        </Btn>
      </div>
      <div className="glass flex items-center gap-0.5 rounded-2xl p-0.5 sm:gap-1 sm:p-1">
        <Btn variant={powerOn ? 'success' : 'danger'} onClick={() => setPower(!powerOn)} aria-pressed={powerOn} aria-label={powerOn ? 'ตัดไฟ (Power OFF)' : 'จ่ายไฟ (Power ON)'} className="px-2 sm:px-3">
          ⚡{powerOn ? 'ON' : 'OFF'}
        </Btn>
        <Btn variant="ghost" onClick={() => setPaused(!paused)} aria-label={paused ? 'ทำต่อ' : 'หยุดชั่วคราว'} className="px-2">
          {paused ? '▶' : '⏸'}
        </Btn>
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="h-11 rounded-xl border border-white/15 bg-ink-900 px-1 text-sm text-cyan-100 sm:px-2"
          aria-label="ความเร็วการจำลอง"
        >
          {[0.5, 1, 2, 4].map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
      </div>
      {colors && (
        <div className="glass anim-pop flex w-full flex-wrap justify-center gap-1 rounded-2xl p-2">
          {WIRE_COLORS.map((w) => (
            <button
              key={w.c}
              onClick={() => {
                setWireColor(w.c)
                setColors(false)
                if (mode !== 'wire') setMode('wire')
              }}
              className={`flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs ${wireColor === w.c ? 'bg-white/15' : ''}`}
            >
              <span className="h-5 w-5 rounded-full border border-white/60" style={{ background: WIRE_HEX[w.c] }} />
              {w.th}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Banner() {
  const placing = useLab((s) => s.placing)
  const mode = useLab((s) => s.mode)
  const wireStart = useLab((s) => s.wireStart)
  const measure = useLab((s) => s.measure)
  const comps = useLab((s) => s.circuit.components)
  const startPlacing = useLab((s) => s.startPlacing)
  const setMode = useLab((s) => s.setMode)
  if (placing) {
    const name = componentName({ type: placing.type, variant: placing.variant })
    return (
      <div className="glass pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 text-sm">
        <span>📍 แตะหรือลากไปที่รูบนเบรดบอร์ดเพื่อวาง <b>{name}</b></span>
        {!placing.moveId && (placing.type === 'led' || placing.type === 'buzzer') && (
          <Btn variant="ghost" onClick={() => startPlacing({ ...placing, flipped: !placing.flipped })}>
            🔄 กลับด้าน
          </Btn>
        )}
        <Btn variant="ghost" onClick={() => startPlacing(null)}>
          ยกเลิก
        </Btn>
      </div>
    )
  }
  if (mode === 'wire')
    return (
      <div className="glass pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 text-sm">
        <span>{wireStart ? `ต้นสาย: ${describeNode(wireStart, comps)} → แตะจุดปลายทาง` : 'แตะจุดเริ่มต้น (รูเบรดบอร์ด ขาบอร์ด หรือขาโมดูล)'}</span>
        <Btn variant="ghost" onClick={() => setMode('select')}>
          เสร็จ
        </Btn>
      </div>
    )
  if (mode === 'measure')
    return (
      <div className="glass pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 text-sm">
        <span>
          📟 สายดำของมิเตอร์ต่อ GND ไว้แล้ว แตะจุดที่ต้องการวัด
          {measure && (
            <>
              {' · '}
              <b className="font-mono text-amber-300">{measure.volts == null ? 'ลอย (ไม่ทราบค่า)' : `${measure.volts.toFixed(2)} V`}</b> ที่ {describeNode(measure.node, comps)}
            </>
          )}
        </span>
        <Btn variant="ghost" onClick={() => setMode('select')}>
          เสร็จ
        </Btn>
      </div>
    )
  return null
}

function ShelfCard({ item }: { item: ShelfItem }) {
  const e = CATALOG[item]
  const startPlacing = useLab((s) => s.startPlacing)
  const installModule = useLab((s) => s.installModule)
  const comps = useLab((s) => s.circuit.components)
  const usb = useLab((s) => s.circuit.usbConnected)
  const setUsb = useLab((s) => s.setUsb)
  const setMode = useLab((s) => s.setMode)
  const select = useLab((s) => s.select)
  const toast = useLab((s) => s.toast)
  const [color, setColor] = useState<LedColor>('red')
  const [ohm, setOhm] = useState<ResistorValue>(220)
  const type = item as ComponentType
  const limit = COMPONENT_LIMITS[type]
  const count = comps.filter((c) => c.type === type).length
  const full = limit !== undefined && count >= limit
  const place = (variant?: LedColor | ResistorValue) => {
    if (full) {
      toast('info', `แล็บนี้มี${e.nameTh}ให้ใช้ได้ ${limit} ชิ้น`)
      return
    }
    startPlacing({ type, variant })
    select(null)
  }
  return (
    <div>
      <p className="text-base font-bold text-white">{e.nameTh}</p>
      <p className="mb-2 text-xs text-cyan-300">{e.nameEn}</p>
      <p className="mb-1 text-sm text-slate-200">
        <b className="text-cyan-200">หน้าที่:</b> {e.func}
      </p>
      <p className="mb-1 text-sm text-slate-200">
        <b className="text-cyan-200">ขาต่อ:</b> {e.pins}
      </p>
      <p className="mb-3 text-sm text-amber-200">
        <b>⚠️ ข้อควรระวัง:</b> {e.caution}
      </p>
      {item === 'led' && (
        <div className="mb-2 flex gap-1">
          {(['red', 'green', 'blue'] as LedColor[]).map((c) => (
            <Btn key={c} variant={color === c ? 'primary' : 'soft'} onClick={() => setColor(c)}>
              {LED_COLOR_TH[c]}
            </Btn>
          ))}
        </div>
      )}
      {item === 'resistor' && (
        <div className="mb-2">
          <div className="flex flex-wrap gap-1">
            {([220, 1000, 10000] as ResistorValue[]).map((v) => (
              <Btn key={v} variant={ohm === v ? 'primary' : 'soft'} onClick={() => setOhm(v)}>
                {formatOhms(v)}
              </Btn>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-300">แถบสี: {RESISTOR_BANDS[ohm].map((b) => BAND_TH[b]).join(' – ')} (ทอง = ±5%)</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {e.onBreadboard && (
          <Btn variant="primary" onClick={() => place(item === 'led' ? color : item === 'resistor' ? ohm : undefined)} disabled={full}>
            📍 วางบนเบรดบอร์ด
          </Btn>
        )}
        {e.offBoard && (
          <Btn variant="primary" onClick={() => installModule(type)} disabled={count > 0}>
            {count > 0 ? 'ติดตั้งแล้ว' : '🔧 ติดตั้งบนโต๊ะ'}
          </Btn>
        )}
        {item === 'usb' && (
          <Btn variant={usb ? 'soft' : 'primary'} onClick={() => setUsb(!usb)}>
            {usb ? 'ถอดสาย USB' : '🔌 เสียบสาย USB เข้าบอร์ด'}
          </Btn>
        )}
        {item === 'jumper' && (
          <Btn variant="primary" onClick={() => setMode('wire')}>
            〰️ เริ่มต่อสาย
          </Btn>
        )}
        {item === 'multimeter' && (
          <Btn variant="primary" onClick={() => setMode('measure')}>
            📟 ใช้วัดแรงดัน
          </Btn>
        )}
        {(item === 'board' || item === 'breadboard') && <p className="text-xs text-slate-400">อุปกรณ์นี้วางอยู่บนโต๊ะแล้ว</p>}
      </div>
      {e.onBreadboard && <p className="mt-2 text-xs text-slate-400">เคล็ดลับ: กดค้างที่กล่องบนชั้นวางแล้วลากไปปล่อยบนเบรดบอร์ดได้เลย</p>}
    </div>
  )
}

function CompCard({ id }: { id: string }) {
  const comp = useLab((s) => s.circuit.components.find((c) => c.id === id))
  const allIssues = useLab((s) => s.report.issues)
  const issues = allIssues.filter((i) => i.compIds?.includes(id))
  const flip = useLab((s) => s.flipComponent)
  const remove = useLab((s) => s.removeComponent)
  const startPlacing = useLab((s) => s.startPlacing)
  const checkShown = useLab((s) => s.checkShown)
  if (!comp) return null
  const e = CATALOG[comp.type]
  return (
    <div>
      <p className="text-base font-bold text-white">{componentName(comp)}</p>
      <p className="mb-2 text-xs text-cyan-300">{e.nameEn}</p>
      <p className="mb-2 text-xs text-slate-300">ขา: {e.pinDefs?.map((p) => p.label).join(' · ')}</p>
      {checkShown && issues.length > 0 && (
        <ul className="mb-2 space-y-1">
          {issues.map((i, k) => (
            <li key={k} className={`rounded-lg px-2 py-1 text-xs ${i.severity === 'ok' ? 'bg-emerald-900/60' : i.severity === 'info' ? 'bg-slate-800' : i.severity === 'warning' ? 'bg-amber-900/60' : 'bg-rose-900/60'}`}>
              {i.message}
            </li>
          ))}
        </ul>
      )}
      {!checkShown && <p className="mb-2 text-xs text-slate-400">กด "ตรวจวงจร" ในแท็บวงจร เพื่อดูผลวิเคราะห์ของอุปกรณ์นี้</p>}
      <div className="flex flex-wrap gap-2">
        {comp.anchor && (
          <>
            <Btn onClick={() => startPlacing({ type: comp.type, variant: comp.variant, moveId: comp.id })}>✋ ย้าย</Btn>
            <Btn onClick={() => flip(comp.id)}>🔄 กลับด้าน</Btn>
          </>
        )}
        <Btn variant="danger" onClick={() => remove(comp.id)}>
          🗑 นำออก
        </Btn>
      </div>
    </div>
  )
}

function WireCard({ id }: { id: string }) {
  const w = useLab((s) => s.circuit.wires.find((x) => x.id === id))
  const comps = useLab((s) => s.circuit.components)
  const remove = useLab((s) => s.removeWire)
  if (!w) return null
  return (
    <div>
      <p className="mb-1 flex items-center gap-2 text-base font-bold text-white">
        <span className="h-4 w-4 rounded-full" style={{ background: WIRE_HEX[w.color] }} /> สายจัมเปอร์
      </p>
      <p className="mb-3 text-sm text-slate-200">
        {describeNode(w.a, comps)} ↔ {describeNode(w.b, comps)}
      </p>
      <Btn variant="danger" onClick={() => remove(w.id)}>
        🗑 ลบสาย
      </Btn>
    </div>
  )
}

function SceneCard({ sel }: { sel: Extract<Selection, { kind: 'scene' }> }) {
  const controls = useLab((s) => s.simView.controls)
  const setControls = useLab((s) => s.setControls)
  const water = useLab((s) => s.water)
  const setTab = useLab((s) => s.setTab)
  const setCamera = useLab((s) => s.setCamera)
  const env = useLab((s) => s.simView.env)
  switch (sel.item) {
    case 'board':
      return <ShelfCard item="board" />
    case 'breadboard':
      return <ShelfCard item="breadboard" />
    case 'heater':
      return (
        <div>
          <p className="mb-1 font-bold">🔥 ฮีตเตอร์ ({controls.heater}%)</p>
          <input type="range" min={0} max={100} step={5} value={controls.heater} onChange={(e) => setControls({ heater: Number(e.target.value) })} className="w-full accent-orange-400" aria-label="กำลังฮีตเตอร์" />
          <p className="text-xs text-slate-300">อุณหภูมิจริงในห้อง: {env.tempC.toFixed(1)} °C (ค่อย ๆ เปลี่ยนเพราะความเฉื่อยทางความร้อน)</p>
        </div>
      )
    case 'lamp':
      return (
        <div>
          <p className="mb-1 font-bold">💡 โคมไฟตั้งโต๊ะ ({controls.lamp}%)</p>
          <input type="range" min={0} max={100} step={5} value={controls.lamp} onChange={(e) => setControls({ lamp: Number(e.target.value) })} className="w-full accent-yellow-300" aria-label="ความสว่างโคมไฟ" />
          <p className="text-xs text-slate-300">ความสว่างที่เบรดบอร์ด ≈ {Math.round(env.lux)} lux</p>
        </div>
      )
    case 'curtain':
      return (
        <div>
          <p className="mb-2 font-bold">🪟 ม่านหน้าต่าง</p>
          <Btn variant="primary" onClick={() => setControls({ curtainOpen: !controls.curtainOpen })}>
            {controls.curtainOpen ? 'ปิดม่าน (ห้องมืดลง)' : 'เปิดม่าน (แสงแดดเข้า)'}
          </Btn>
        </div>
      )
    case 'fanDesk':
      return (
        <div>
          <p className="mb-1 font-bold">🌀 พัดลมตั้งโต๊ะ (เปิดด้วยมือ)</p>
          <p className="mb-2 text-xs text-slate-300">พัดลมตัวนี้เสียบปลั๊กบ้าน ไม่ได้ต่อกับบอร์ด ใช้ช่วยลดอุณหภูมิห้อง</p>
          <Btn variant="primary" onClick={() => setControls({ fanManual: !controls.fanManual })}>
            {controls.fanManual ? 'ปิดพัดลม' : 'เปิดพัดลม'}
          </Btn>
        </div>
      )
    case 'plant':
      return (
        <div>
          <p className="mb-1 font-bold">🪴 กระถางต้นไม้</p>
          <p className="mb-2 text-xs text-slate-300">ความชื้นในดินจริง ≈ {env.soil.toFixed(0)}% (ค่อย ๆ แห้งลงตามเวลา)</p>
          <Btn variant="primary" onClick={water}>
            🚿 รดน้ำ
          </Btn>
        </div>
      )
    case 'monitor':
      return (
        <div>
          <p className="mb-2 font-bold">🖥️ จอมอนิเตอร์ (Serial Monitor)</p>
          <div className="flex gap-2">
            <Btn variant="primary" onClick={() => setTab('monitor')}>
              เปิดแท็บมอนิเตอร์
            </Btn>
            <Btn onClick={() => setCamera('monitor')}>ซูมไปที่จอ</Btn>
          </div>
        </div>
      )
    default:
      return null
  }
}

function SelectionCard() {
  const sel = useLab((s) => s.selection)
  const select = useLab((s) => s.select)
  const placing = useLab((s) => s.placing)
  if (!sel || placing) return null
  return (
    <div className="glass anim-pop pointer-events-auto max-h-[60vh] w-[min(92vw,360px)] overflow-y-auto scroll-thin rounded-2xl p-3">
      <div className="float-right">
        <button className="h-9 w-9 rounded-lg text-slate-300 hover:bg-white/10" onClick={() => select(null)} aria-label="ปิดการ์ด">
          ✕
        </button>
      </div>
      {sel.kind === 'shelf' && <ShelfCard item={sel.item} />}
      {sel.kind === 'comp' && <CompCard id={sel.id} />}
      {sel.kind === 'wire' && <WireCard id={sel.id} />}
      {sel.kind === 'scene' && <SceneCard sel={sel} />}
    </div>
  )
}

function Helper() {
  // collapsed by default on phones so it does not cover the 3D view
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 640px)').matches)
  const state = useLab()
  const m = MISSIONS[state.progress.current]
  const st = objectivesStatus(m, missionCtx(state))
  const next = m.objectives.find((o) => !st[o.id])
  const shorted = state.report.shorted
  const done = state.progress.completed.includes(m.id)
  let msg = next ? `ขั้นต่อไป: ${next.th}` : 'ภารกิจนี้ผ่านแล้ว! ไปภารกิจถัดไปได้ในแท็บภารกิจ'
  let mood: 'happy' | 'think' | 'alert' = next ? 'think' : 'happy'
  if (shorted) {
    msg = 'ระวัง! วงจรลัดวงจรอยู่ ระบบตัดไฟให้แล้ว ไปที่แท็บวงจรแล้วกด "ตรวจวงจร" เพื่อดูจุดที่ผิด'
    mood = 'alert'
  } else if (state.mode === 'wire' && !state.wireStart) msg = 'จำไว้: สายแดง = ไฟเลี้ยง, สายดำ = GND, สีอื่น = สัญญาณ'
  if (done && !next && m.id === 6) msg = 'เยี่ยมมาก! กดดูผลสรุปและรับใบประกาศได้เลย'
  return (
    <div className="pointer-events-auto flex max-w-[min(92vw,420px)] items-end gap-2">
      <button onClick={() => setOpen(!open)} aria-label={open ? 'ซ่อนผู้ช่วย' : 'แสดงผู้ช่วย น้องไบต์'} className="relative shrink-0">
        <ByteBot size={44} mood={mood} />
        {!open && mood === 'alert' && <span className="absolute right-0 top-0 h-3 w-3 animate-ping rounded-full bg-rose-500" />}
      </button>
      {open && (
        <div className="glass anim-pop mb-2 rounded-2xl rounded-bl-sm px-3 py-2 text-xs text-cyan-50 sm:text-sm">
          <b className="text-cyan-300">น้องไบต์:</b> {msg}
        </div>
      )}
    </div>
  )
}

export function SceneOverlay() {
  const guided = useLab((s) => s.guided)
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-2">
      <div className="flex flex-col items-start gap-2">
        <CameraChips />
        <SelectionCard />
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="hidden lg:block">
          <GuideCard />
        </div>
        <Banner />
        <div className="flex w-full flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          {guided ? <span /> : <Helper />}
          <div className="self-center sm:self-auto">
            <Toolbar />
          </div>
        </div>
      </div>
    </div>
  )
}
