import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { describeHole } from '../engine/circuit/breadboard'
import {
  CATALOG,
  canAnchorAt,
  componentName,
  footprint,
  type ComponentType,
  type LedColor,
  type PlacedComponent,
  type ResistorValue,
  type ShelfItem,
} from '../engine/circuit/catalog'
import { emptyCircuit, type CircuitState, type Wire, type WireColor } from '../engine/circuit/netlist'
import { SOLUTIONS, type SolutionKey } from '../engine/circuit/solutions'
import type { CircuitReport, Issue } from '../engine/circuit/validator'
import { waterPlant, walkBy, type EnvControls, type EnvState } from '../engine/environment'
import { LabSim, type Actuators, type Readings } from '../engine/firmware'
import { MISSIONS, objectivesStatus, type MissionCtx } from '../engine/missions'
import { FINAL_QUIZ, MINI_QUIZ, scoreQuiz } from '../engine/quiz'
import type { ActuatorKey, Rule } from '../engine/rules'
import { SENSOR_INFO } from '../engine/rules'
import { runScenarioTests, type Challenge, type ScenarioResult } from '../engine/scenarios'
import { defaultSoilCal, type SoilCalibration } from '../engine/sensors'
import type { CameraPreset } from '../scene/layout'
import { saveResult, type ResultRecord } from '../services/results'
import { setMuted, sfx } from '../services/sound'

export const sim = new LabSim(Math.floor(Math.random() * 1e6))

export type Route = 'landing' | 'lab' | 'summary' | 'staff'
export type Mode = 'select' | 'wire' | 'measure'
export type Quality = 'auto' | 'low' | 'mid' | 'high'
export type PanelTab = 'mission' | 'circuit' | 'env' | 'monitor' | 'rules'

export type Selection =
  | { kind: 'shelf'; item: ShelfItem }
  | { kind: 'comp'; id: string }
  | { kind: 'wire'; id: string }
  | { kind: 'scene'; item: 'board' | 'breadboard' | 'heater' | 'lamp' | 'fanDesk' | 'plant' | 'monitor' | 'curtain' | 'deco'; label?: string }
  | null

export interface Placing {
  type: ComponentType
  variant?: LedColor | ResistorValue
  moveId?: string
  flipped?: boolean
}

export interface Toast {
  id: number
  kind: 'ok' | 'error' | 'info' | 'warn'
  text: string
}

export interface Progress {
  current: number
  completed: number[]
  found: ShelfItem[]
  miniAnswers: Array<number | null>
  tutorial: { cam: boolean; select: boolean; wire: boolean; seenIntro: boolean }
  blinkUsed: boolean
  obs: { tMin: number; tMax: number; lMin: number; lMax: number }
  ldrAnswer: 'up' | 'down' | null
  ldrAnswerCorrect: boolean
  challenge: Challenge | null
  autoTest: { score: number; total: number } | null
  finalAnswers: Array<number | null>
  hintLevel: Record<number, number>
  hintsUsed: number
  startedAt: number | null
  finishedAt: number | null
  resultId: string | null
}

const freshObs = () => ({ tMin: Infinity, tMax: -Infinity, lMin: Infinity, lMax: -Infinity })
const freshProgress = (): Progress => ({
  current: 0,
  completed: [],
  found: [],
  miniAnswers: [null, null, null],
  tutorial: { cam: false, select: false, wire: false, seenIntro: false },
  blinkUsed: false,
  obs: freshObs(),
  ldrAnswer: null,
  ldrAnswerCorrect: false,
  challenge: null,
  autoTest: null,
  finalAnswers: FINAL_QUIZ.map(() => null),
  hintLevel: {},
  hintsUsed: 0,
  startedAt: null,
  finishedAt: null,
  resultId: null,
})

export interface SimView {
  powerOn: boolean
  powered: boolean
  readings: Readings
  actuators: Actuators
  env: EnvState
  controls: EnvControls
  serialLen: number
  logLen: number
  tripped: boolean
}

const view = (): SimView => ({
  powerOn: sim.powerOn,
  powered: sim.powered,
  readings: sim.readings,
  actuators: sim.actuators,
  env: sim.env,
  controls: { ...sim.controls },
  serialLen: sim.serialCount,
  logLen: sim.logCount,
  tripped: sim.tripped,
})

interface LabState {
  route: Route
  profile: { nickname: string; school: string }
  circuit: CircuitState
  report: CircuitReport
  rules: Rule[]
  soilCal: SoilCalibration
  progress: Progress
  simView: SimView
  paused: boolean
  speed: number
  noise: boolean
  pirHold: number
  manual: Partial<Record<ActuatorKey, boolean>>
  blink: Partial<Record<ActuatorKey, boolean>>

  selection: Selection
  mode: Mode
  placing: Placing | null
  wireStart: string | null
  wireColor: WireColor
  hoverNode: string | null
  measure: { node: string; volts: number | null } | null
  highlight: { comps: string[]; nodes: string[] }
  checkShown: boolean
  autoResults: ScenarioResult[] | null

  quality: Quality
  autoQuality: 'low' | 'mid' | 'high'
  soundOn: boolean
  presenter: boolean
  dataFlow: boolean
  camera: { preset: CameraPreset; nonce: number }
  panelTab: PanelTab
  sheet: 'peek' | 'half' | 'full'
  showSchematic: boolean
  showTheory: boolean
  toasts: Toast[]
  confirm: { text: string; onYes: () => void } | null

  // actions
  setRoute(r: Route): void
  setProfile(p: { nickname: string; school: string }): void
  startLab(): void
  publish(): void
  select(s: Selection): void
  setMode(m: Mode): void
  startPlacing(p: Placing | null): void
  placeAt(anchor: string): boolean
  installModule(type: ComponentType): void
  flipComponent(id: string): void
  removeComponent(id: string): void
  tapNode(node: string): void
  removeWire(id: string): void
  setUsb(on: boolean): void
  clearCircuit(): void
  loadSolution(key: SolutionKey): void
  setWireColor(c: WireColor): void
  setHover(n: string | null): void
  checkCircuit(): void
  focusIssue(i: Issue | null): void
  setPower(on: boolean): void
  setPaused(p: boolean): void
  setSpeed(s: number): void
  setNoise(n: boolean): void
  setControls(c: Partial<EnvControls>): void
  water(): void
  walk(): void
  calibrate(which: 'dry' | 'wet' | 'reset'): void
  setPirHold(s: number): void
  setManual(k: ActuatorKey, v: boolean | undefined): void
  setBlink(k: ActuatorKey, v: boolean): void
  addRule(r?: Partial<Rule>): void
  updateRule(id: string, r: Partial<Rule>): void
  removeRule(id: string): void
  markFound(i: ShelfItem): void
  answerMini(i: number, c: number): void
  tutorialFlag(k: 'cam' | 'select' | 'wire' | 'seenIntro'): void
  answerLdr(a: 'up' | 'down'): void
  chooseChallenge(c: Challenge): void
  runAutoTest(): void
  answerFinal(i: number, c: number): void
  goMission(i: number): void
  resetMission(): void
  useHint(): number
  finishLab(): void
  saveResult(): Promise<void>
  restartAll(): void
  setQuality(q: Quality): void
  setAutoQuality(q: 'low' | 'mid' | 'high'): void
  setSound(on: boolean): void
  setPresenter(on: boolean): void
  setDataFlow(on: boolean): void
  setCamera(p: CameraPreset): void
  setTab(t: PanelTab): void
  setSheet(s: 'peek' | 'half' | 'full'): void
  setSchematic(on: boolean): void
  setTheory(on: boolean): void
  toast(kind: Toast['kind'], text: string): void
  dismissToast(id: number): void
  ask(text: string, onYes: () => void): void
  closeConfirm(): void
}

let toastId = 0
let uid = Date.now() % 100000
const newId = (prefix: string) => `${prefix}-${(++uid).toString(36)}`

/** Holes/pins currently used by component legs or wire ends (each takes one lead). */
function usedNodes(c: CircuitState, exceptComp?: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const comp of c.components) {
    if (comp.id === exceptComp) continue
    const fp = footprint(comp)
    if (fp) for (const h of Object.values(fp)) m.set(h, componentName(comp))
  }
  for (const w of c.wires) {
    m.set(w.a, 'สายไฟ')
    m.set(w.b, 'สายไฟ')
  }
  return m
}

export function missionCtx(s: Pick<LabState, 'report' | 'circuit' | 'simView' | 'progress' | 'rules'>): MissionCtx {
  const p = s.progress
  return {
    report: s.report,
    usb: s.circuit.usbConnected,
    powered: s.simView.powered,
    readings: s.simView.readings,
    actuators: s.simView.actuators,
    found: p.found,
    miniQuizCorrect: scoreQuiz(MINI_QUIZ, p.miniAnswers),
    tutorial: p.tutorial,
    blinkUsed: p.blinkUsed,
    obs: p.obs,
    ldrAnswerCorrect: p.ldrAnswerCorrect,
    challenge: p.challenge,
    rules: s.rules,
    autoTest: p.autoTest,
    finalDone: p.finalAnswers.every((a) => a !== null),
  }
}

export const useLab = create<LabState>()(
  persist(
    (set, get) => {
      const applyCircuit = (c: CircuitState) => {
        sim.setCircuit(c)
        const wasTripped = sim.tripped
        set({ circuit: c, report: sim.report, simView: view() })
        if (wasTripped && sim.report.shorted) {
          sfx.error()
          get().toast('error', 'ลัดวงจร! ระบบตัดไฟจำลองให้อัตโนมัติ ตรวจสายที่ต่อไฟ + กับ GND ถึงกัน')
          set({ checkShown: true, panelTab: 'circuit' })
        }
        checkMissions()
      }

      const checkMissions = () => {
        const s = get()
        const p = s.progress
        if (s.route !== 'lab') return
        const m = MISSIONS[p.current]
        if (!m || p.completed.includes(m.id)) return
        const st = objectivesStatus(m, missionCtx(s))
        if (Object.values(st).every(Boolean)) {
          set({ progress: { ...p, completed: [...p.completed, m.id] } })
          sfx.success()
          s.toast('ok', `ผ่านภารกิจ "${m.title}" แล้ว เก่งมาก! 🎉`)
        }
      }

      return {
        route: 'landing',
        profile: { nickname: '', school: '' },
        circuit: emptyCircuit(),
        report: sim.report,
        rules: [],
        soilCal: defaultSoilCal(),
        progress: freshProgress(),
        simView: view(),
        paused: false,
        speed: 1,
        noise: true,
        pirHold: 3,
        manual: {},
        blink: {},
        selection: null,
        mode: 'select',
        placing: null,
        wireStart: null,
        wireColor: 'yellow',
        hoverNode: null,
        measure: null,
        highlight: { comps: [], nodes: [] },
        checkShown: false,
        autoResults: null,
        quality: 'auto',
        autoQuality: 'high',
        soundOn: true,
        presenter: false,
        dataFlow: true,
        camera: { preset: 'overview', nonce: 0 },
        panelTab: 'mission',
        sheet: 'half',
        showSchematic: false,
        showTheory: false,
        toasts: [],
        confirm: null,

        setRoute: (route) => {
          set({ route })
          if (route !== 'lab') sim.setPower(false)
        },
        setProfile: (profile) => set({ profile }),
        startLab: () => {
          const p = get().progress
          set({ route: 'lab', progress: p.startedAt ? p : { ...p, startedAt: Date.now() } })
        },
        publish: () => {
          const s = get()
          const r = sim.readings
          const p = s.progress
          let obs = p.obs
          if (p.current === 3 && sim.powered && r.temp != null && (r.temp < obs.tMin || r.temp > obs.tMax))
            obs = { ...obs, tMin: Math.min(obs.tMin, r.temp), tMax: Math.max(obs.tMax, r.temp) }
          if (p.current === 4 && sim.powered && r.light != null && s.report.ldrs.some((d) => d.status === 'ok') && (r.light < obs.lMin || r.light > obs.lMax))
            obs = { ...obs, lMin: Math.min(obs.lMin, r.light), lMax: Math.max(obs.lMax, r.light) }
          set({ simView: view(), ...(obs !== p.obs ? { progress: { ...p, obs } } : {}) })
          checkMissions()
        },

        select: (selection) => {
          set({ selection })
          if (selection) {
            sfx.select()
            if (!get().progress.tutorial.select) get().tutorialFlag('select')
            if (selection.kind === 'shelf') get().markFound(selection.item)
          }
        },
        setMode: (mode) => set({ mode, wireStart: null, placing: null, measure: mode === 'measure' ? get().measure : null }),
        startPlacing: (placing) => set({ placing, mode: 'select', wireStart: null }),

        placeAt: (anchor) => {
          const s = get()
          const pl = s.placing
          if (!pl) return false
          if (!canAnchorAt(pl.type, anchor)) {
            s.toast('warn', 'วางตรงนี้ไม่ได้ ขาอุปกรณ์ต้องอยู่ในพื้นที่แถว A–J และไม่ล้นขอบเบรดบอร์ด')
            sfx.warn()
            return false
          }
          const candidate: PlacedComponent = pl.moveId
            ? { ...s.circuit.components.find((c) => c.id === pl.moveId)!, anchor }
            : { id: newId(pl.type), type: pl.type, variant: pl.variant, anchor, flipped: pl.flipped }
          const fp = footprint(candidate)
          const used = usedNodes(s.circuit, pl.moveId)
          const clash = fp && Object.values(fp).find((h) => used.has(h))
          if (!fp || clash) {
            s.toast('warn', clash ? `${describeHole(clash)} มี${used.get(clash)}เสียบอยู่แล้ว เลือกตำแหน่งอื่น` : 'วางตรงนี้ไม่ได้')
            sfx.warn()
            return false
          }
          const comps = pl.moveId ? s.circuit.components.map((c) => (c.id === pl.moveId ? candidate : c)) : [...s.circuit.components, candidate]
          applyCircuit({ ...s.circuit, components: comps })
          set({ placing: null, selection: { kind: 'comp', id: candidate.id } })
          sfx.place()
          return true
        },

        installModule: (type) => {
          const s = get()
          if (s.circuit.components.some((c) => c.type === type)) {
            s.toast('info', `${CATALOG[type].nameTh} ติดตั้งอยู่แล้ว`)
            return
          }
          const c: PlacedComponent = { id: newId(type), type, anchor: null }
          applyCircuit({ ...s.circuit, components: [...s.circuit.components, c] })
          set({ selection: { kind: 'comp', id: c.id } })
          sfx.place()
          s.toast('ok', `ติดตั้ง${CATALOG[type].nameTh}แล้ว ต่อสายจากขาของโมดูลไปยังบอร์ดหรือเบรดบอร์ด`)
        },

        flipComponent: (id) => {
          const s = get()
          const comp = s.circuit.components.find((c) => c.id === id)
          if (!comp || !comp.anchor) return
          const flipped = { ...comp, flipped: !comp.flipped }
          applyCircuit({ ...s.circuit, components: s.circuit.components.map((c) => (c.id === id ? flipped : c)) })
          sfx.place()
        },

        removeComponent: (id) => {
          const s = get()
          const wires = s.circuit.wires.filter((w) => !w.a.startsWith(`cmp:${id}:`) && !w.b.startsWith(`cmp:${id}:`))
          applyCircuit({ ...s.circuit, components: s.circuit.components.filter((c) => c.id !== id), wires })
          set({ selection: null, highlight: { comps: [], nodes: [] } })
          sfx.remove()
        },

        tapNode: (node) => {
          const s = get()
          if (s.mode === 'measure') {
            const volts = sim.measure(node)
            set({ measure: { node, volts } })
            sfx.click()
            return
          }
          if (s.mode !== 'wire') return
          const used = usedNodes(s.circuit)
          if (used.has(node) && node !== s.wireStart) {
            const what = used.get(node)
            s.toast(
              'warn',
              node.startsWith('bb:')
                ? `รูนี้มี${what}เสียบอยู่แล้ว (1 รูเสียบได้ 1 ขา) ใช้รูอื่นในคอลัมน์เดียวกันได้ เพราะเชื่อมกันภายใน`
                : `ขานี้มีสายต่ออยู่แล้ว ถ้าต้องการแยกไฟหลายจุด ให้ต่อผ่านรางไฟบนเบรดบอร์ด`,
            )
            sfx.warn()
            return
          }
          if (!s.wireStart) {
            set({ wireStart: node })
            sfx.click()
            return
          }
          if (s.wireStart === node) {
            set({ wireStart: null })
            return
          }
          const w: Wire = { id: newId('w'), a: s.wireStart, b: node, color: s.wireColor }
          applyCircuit({ ...s.circuit, wires: [...s.circuit.wires, w] })
          set({ wireStart: null })
          sfx.plug()
          if (!get().progress.tutorial.wire) get().tutorialFlag('wire')
        },

        removeWire: (id) => {
          const s = get()
          applyCircuit({ ...s.circuit, wires: s.circuit.wires.filter((w) => w.id !== id) })
          set({ selection: null })
          sfx.remove()
        },

        setUsb: (on) => {
          const s = get()
          applyCircuit({ ...s.circuit, usbConnected: on })
          if (!on) sim.setPower(false)
          set({ simView: view() })
          sfx.plug()
          s.toast(on ? 'ok' : 'info', on ? 'เสียบสาย USB แล้ว บอร์ดพร้อมรับไฟ 5V' : 'ถอดสาย USB แล้ว')
        },

        clearCircuit: () => {
          sim.setPower(false)
          applyCircuit({ ...emptyCircuit(), usbConnected: get().circuit.usbConnected })
          set({ selection: null, highlight: { comps: [], nodes: [] }, checkShown: false, manual: {}, blink: {} })
          sim.manual = {}
          sim.blink = {}
          sfx.remove()
        },

        loadSolution: (key) => {
          sim.setPower(false)
          applyCircuit(SOLUTIONS[key]())
          set({ selection: null, checkShown: true, panelTab: 'circuit' })
          get().toast('info', 'วางวงจรตัวอย่างให้แล้ว ลองสังเกตว่าแต่ละสายต่อจากไหนไปไหน แล้วกด Power ON')
        },

        setWireColor: (wireColor) => set({ wireColor }),
        setHover: (hoverNode) => {
          if (get().hoverNode !== hoverNode) set({ hoverNode })
        },

        checkCircuit: () => {
          const r = get().report
          set({ checkShown: true })
          const worst = r.issues.find((i) => i.severity !== 'ok' && i.severity !== 'info')
          if (!r.issues.length) get().toast('info', 'ยังไม่มีอะไรให้ตรวจ ลองวางอุปกรณ์และต่อสายก่อน')
          else if (!worst) {
            sfx.correct()
            get().toast('ok', 'วงจรถูกต้อง ไม่พบจุดผิด 👍')
          } else {
            if (worst.severity === 'warning') sfx.warn()
            else sfx.error()
            get().focusIssue(worst)
          }
        },
        focusIssue: (i) => set({ highlight: { comps: i?.compIds ?? [], nodes: i?.nodes ?? [] } }),

        setPower: (on) => {
          const r = sim.setPower(on)
          if (!r.ok) {
            sfx.error()
            get().toast('error', r.reason === 'short' ? 'จ่ายไฟไม่ได้: วงจรลัดวงจรอยู่ แก้ก่อนแล้วลองใหม่' : 'จ่ายไฟไม่ได้: ยังไม่ได้เสียบสาย USB ให้บอร์ด')
            if (r.reason === 'short') set({ checkShown: true, panelTab: 'circuit' })
          } else if (on) sfx.powerOn()
          else sfx.powerOff()
          set({ simView: view() })
        },
        setPaused: (paused) => set({ paused }),
        setSpeed: (speed) => set({ speed }),
        setNoise: (noise) => {
          sim.noise = noise
          set({ noise })
        },
        setControls: (c) => {
          sim.controls = { ...sim.controls, ...c }
          set({ simView: view() })
        },
        water: () => {
          sim.env = waterPlant(sim.env)
          sfx.click()
          set({ simView: view() })
        },
        walk: () => {
          sim.env = walkBy(sim.env)
          sfx.click()
        },
        calibrate: (which) => {
          const adc = sim.readings.soilAdc
          const cal = get().soilCal
          if (which === 'reset') {
            sim.soilCal = defaultSoilCal()
            set({ soilCal: sim.soilCal })
            return
          }
          if (adc == null) {
            get().toast('warn', 'ยังอ่านค่าเซนเซอร์ความชื้นในดินไม่ได้ ตรวจวงจรและจ่ายไฟก่อน')
            return
          }
          const next = { ...cal, [which]: adc }
          if (Math.abs(next.dry - next.wet) < 200) get().toast('warn', 'ค่าแห้งกับค่าเปียกใกล้กันเกินไป ลองรดน้ำ/รอให้ดินแห้งก่อนกด Calibrate')
          sim.soilCal = next
          set({ soilCal: next })
          get().toast('ok', `บันทึกค่า${which === 'dry' ? 'ดินแห้ง' : 'ดินเปียก'} = ${adc}`)
        },
        setPirHold: (pirHold) => {
          sim.pirHoldS = pirHold
          set({ pirHold })
        },
        setManual: (k, v) => {
          const manual = { ...get().manual, [k]: v }
          if (v === undefined) delete manual[k]
          sim.manual = manual
          set({ manual })
        },
        setBlink: (k, v) => {
          const blink = { ...get().blink, [k]: v }
          sim.blink = blink
          set({ blink })
          if (v) set({ progress: { ...get().progress, blinkUsed: true } })
        },

        addRule: (r) => {
          const rule: Rule = {
            id: newId('rule'),
            sensor: 'temp',
            op: '>',
            value: SENSOR_INFO.temp.def,
            actuator: 'fan',
            action: 'on',
            otherwise: true,
            enabled: true,
            ...r,
          }
          const rules = [...get().rules, rule]
          sim.rules = rules
          set({ rules })
          sfx.click()
        },
        updateRule: (id, r) => {
          const rules = get().rules.map((x) => (x.id === id ? { ...x, ...r } : x))
          sim.rules = rules
          set({ rules })
        },
        removeRule: (id) => {
          const rules = get().rules.filter((x) => x.id !== id)
          sim.rules = rules
          set({ rules })
          sfx.remove()
        },

        markFound: (i) => {
          const p = get().progress
          if (!p.found.includes(i)) set({ progress: { ...p, found: [...p.found, i] } })
        },
        answerMini: (i, c) => {
          const p = get().progress
          const miniAnswers = [...p.miniAnswers]
          miniAnswers[i] = c
          set({ progress: { ...p, miniAnswers } })
          if (MINI_QUIZ[i].answer === c) sfx.correct()
          else sfx.error()
          checkMissions()
        },
        tutorialFlag: (k) => {
          const p = get().progress
          set({ progress: { ...p, tutorial: { ...p.tutorial, [k]: true } } })
          checkMissions()
        },
        answerLdr: (a) => {
          const s = get()
          const d = s.report.ldrs.find((x) => x.status === 'ok')
          const correct = !!d && (d.ldrOnTop ? a === 'up' : a === 'down')
          set({ progress: { ...s.progress, ldrAnswer: a, ldrAnswerCorrect: correct } })
          if (correct) sfx.correct()
          else sfx.error()
          checkMissions()
        },
        chooseChallenge: (challenge) => {
          set({ progress: { ...get().progress, challenge, autoTest: null }, autoResults: null })
          sfx.click()
          checkMissions()
        },
        runAutoTest: () => {
          const s = get()
          const ch = s.progress.challenge
          if (!ch) return
          const out = runScenarioTests(ch, s.circuit, s.rules, s.soilCal)
          set({ autoResults: out.results, progress: { ...s.progress, autoTest: { score: out.score, total: out.total } } })
          if (out.score >= 3) sfx.success()
          else sfx.error()
          checkMissions()
        },
        answerFinal: (i, c) => {
          const p = get().progress
          if (p.finalAnswers[i] !== null) return
          const finalAnswers = [...p.finalAnswers]
          finalAnswers[i] = c
          set({ progress: { ...p, finalAnswers } })
          if (FINAL_QUIZ[i].answer === c) sfx.correct()
          else sfx.error()
          checkMissions()
        },
        goMission: (i) => {
          const p = get().progress
          const unlocked = i === 0 || p.completed.includes(i - 1)
          if (!unlocked) {
            get().toast('info', 'ภารกิจนี้ยังล็อกอยู่ ผ่านภารกิจก่อนหน้าก่อนนะ')
            return
          }
          set({ progress: { ...p, current: i, obs: freshObs() }, panelTab: 'mission', showTheory: false })
          sfx.click()
          checkMissions()
        },
        resetMission: () => {
          const p = get().progress
          const m = p.current
          const patch: Partial<Progress> = { obs: freshObs() }
          if (m === 0) patch.tutorial = { cam: false, select: false, wire: false, seenIntro: true }
          if (m === 1) Object.assign(patch, { found: [], miniAnswers: [null, null, null] })
          if (m === 2) patch.blinkUsed = false
          if (m === 4) Object.assign(patch, { ldrAnswer: null, ldrAnswerCorrect: false })
          if (m === 5) Object.assign(patch, { challenge: null, autoTest: null })
          if (m === 6) patch.finalAnswers = FINAL_QUIZ.map(() => null)
          set({ progress: { ...p, ...patch, completed: p.completed.filter((x) => x !== m) }, autoResults: null })
          get().toast('info', 'เริ่มภารกิจนี้ใหม่แล้ว (วงจรยังอยู่ ถ้าต้องการล้างวงจร กด "ล้างวงจร")')
        },
        useHint: () => {
          const p = get().progress
          const lvl = Math.min(3, (p.hintLevel[p.current] ?? 0) + 1)
          set({ progress: { ...p, hintLevel: { ...p.hintLevel, [p.current]: lvl }, hintsUsed: p.hintsUsed + 1 } })
          return lvl
        },
        finishLab: () => {
          const p = get().progress
          set({ progress: { ...p, finishedAt: p.finishedAt ?? Date.now(), resultId: p.resultId ?? newId('res') }, route: 'summary' })
          sim.setPower(false)
          void get().saveResult()
        },
        saveResult: async () => {
          const s = get()
          const p = s.progress
          const id = p.resultId ?? newId('res')
          if (!p.resultId) set({ progress: { ...p, resultId: id } })
          const end = p.finishedAt ?? Date.now()
          const rec: ResultRecord = {
            id,
            nickname: s.profile.nickname || 'ไม่ระบุชื่อ',
            school: s.profile.school,
            startedAt: p.startedAt ?? end,
            finishedAt: end,
            durationS: Math.round((end - (p.startedAt ?? end)) / 1000),
            quizScore: p.finalAnswers.every((a) => a !== null) ? scoreQuiz(FINAL_QUIZ, p.finalAnswers) : null,
            quizTotal: FINAL_QUIZ.length,
            missionsPassed: [...p.completed].sort(),
            challenge: p.challenge,
            autoScore: p.autoTest?.score ?? null,
            hintsUsed: p.hintsUsed,
          }
          const r = await saveResult(rec)
          s.toast(
            r.local ? 'ok' : 'error',
            r.remote === 'ok' ? 'บันทึกผลแล้ว (ในเครื่องและบนฐานข้อมูล)' : r.remote === 'error' ? `บันทึกในเครื่องแล้ว แต่ส่งขึ้นฐานข้อมูลไม่สำเร็จ: ${r.error}` : r.local ? 'บันทึกผลในเครื่องนี้แล้ว' : 'บันทึกผลไม่สำเร็จ (เบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูล)',
          )
        },
        restartAll: () => {
          sim.setPower(false)
          sim.rules = []
          sim.manual = {}
          sim.blink = {}
          sim.soilCal = defaultSoilCal()
          applyCircuit(emptyCircuit())
          set({ progress: freshProgress(), rules: [], manual: {}, blink: {}, soilCal: defaultSoilCal(), selection: null, checkShown: false, autoResults: null, route: 'landing' })
        },

        setQuality: (quality) => set({ quality }),
        setAutoQuality: (autoQuality) => set({ autoQuality }),
        setSound: (soundOn) => {
          setMuted(!soundOn)
          set({ soundOn })
        },
        setPresenter: (presenter) => set({ presenter }),
        setDataFlow: (dataFlow) => set({ dataFlow }),
        setCamera: (preset) => {
          set({ camera: { preset, nonce: get().camera.nonce + 1 } })
          if (!get().progress.tutorial.cam) get().tutorialFlag('cam')
        },
        setTab: (panelTab) => set({ panelTab }),
        setSheet: (sheet) => set({ sheet }),
        setSchematic: (showSchematic) => set({ showSchematic }),
        setTheory: (showTheory) => set({ showTheory }),
        toast: (kind, text) => {
          const id = ++toastId
          set({ toasts: [...get().toasts.slice(-3), { id, kind, text }] })
          setTimeout(() => get().dismissToast(id), kind === 'error' ? 6500 : 4200)
        },
        dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
        ask: (text, onYes) => set({ confirm: { text, onYes } }),
        closeConfirm: () => set({ confirm: null }),
      }
    },
    {
      name: 'aiot-lab-state-v1',
      version: 1,
      partialize: (s) => ({
        profile: s.profile,
        circuit: s.circuit,
        rules: s.rules,
        soilCal: s.soilCal,
        progress: s.progress,
        quality: s.quality,
        soundOn: s.soundOn,
        dataFlow: s.dataFlow,
        noise: s.noise,
        route: s.route === 'staff' ? 'landing' : s.route,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LabState>
        const progress = { ...freshProgress(), ...(p.progress ?? {}) }
        // Infinity is not JSON-serialisable; restore observation bounds
        progress.obs = freshObs()
        return { ...current, ...p, progress }
      },
    },
  ),
)

/** Push persisted state into the simulation after hydration (localStorage hydrates synchronously). */
function syncSimFromStore() {
  const s = useLab.getState()
  sim.setCircuit(s.circuit)
  sim.rules = s.rules
  sim.soilCal = s.soilCal
  sim.noise = s.noise
  setMuted(!s.soundOn)
  useLab.setState({ report: sim.report, simView: view() })
}
syncSimFromStore()
useLab.persist.onFinishHydration(syncSimFromStore)

export const missionStatus = (s: LabState) => {
  const m = MISSIONS[s.progress.current]
  return { mission: m, status: objectivesStatus(m, missionCtx(s)) }
}
