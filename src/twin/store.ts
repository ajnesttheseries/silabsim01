import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { scoreQuiz } from '../engine/quiz'
import { saveResult, type ResultRecord } from '../services/results'
import { sfx } from '../services/sound'
import { useLab } from '../store/lab'
import type { SheetState } from '../ui/LabSheet'
import { DEFAULT_RATES, DEFAULT_TEMP_CAL, encoderRaw, linkLoad, linkStatus, SOLUTION_RATES, TEMP_DATASHEET, type LinkStatus, type Rates, type TempCal } from './engine/daq'
import { TWIN_FINAL_QUIZ, TWIN_MINI_QUIZ, TWIN_MISSIONS, twinObjectives, type TwinCtx } from './engine/missions'
import { emptyMounts, mountReport, SENSORS, sensorAt, SLOT_TH, SOLUTION_MOUNTS, type DeviceId, type Mounts, type SensorId, type SlotId } from './engine/robot'
import { initTruth, type Fault, type Truth } from './engine/signals'
import { DEFAULT_RULES, runTwinTest, SOLUTION_RULES, type AlertKind, type AlertRules, type Checkpoint, type Reading } from './engine/twin'

export type TwinCamera = 'overview' | 'robot' | 'twin' | 'tray'
export type TwinTab = 'mission' | 'sensors' | 'data' | 'calib' | 'monitor'
export type TwinSelection = { kind: 'device'; id: DeviceId } | { kind: 'sensor'; id: SensorId } | null

export interface TwinProgress {
  current: number
  completed: number[]
  found: string[]
  miniAnswers: Array<number | null>
  tutorial: { seenIntro: boolean }
  testScore: { score: number; total: number } | null
  finalAnswers: Array<number | null>
  hintLevel: Record<number, number>
  hintsUsed: number
  guidedUsed: boolean
  startedAt: number | null
  finishedAt: number | null
  resultId: string | null
}

const freshProgress = (): TwinProgress => ({
  current: 0,
  completed: [],
  found: [],
  miniAnswers: [null, null, null],
  tutorial: { seenIntro: false },
  testScore: null,
  finalAnswers: TWIN_FINAL_QUIZ.map(() => null),
  hintLevel: {},
  hintsUsed: 0,
  guidedUsed: false,
  startedAt: null,
  finishedAt: null,
  resultId: null,
})

export interface TwinLive {
  truth: Truth
  reading: Reading
  latency: number
  /** alerts raised by the twin right now (live demo) */
  alerts: AlertKind[]
  /** robot was safe-stopped by an alert */
  stopped: boolean
}

interface TwinState {
  mounts: Mounts
  rates: Rates
  encoderOffset: number
  tempCal: TempCal
  rules: AlertRules
  progress: TwinProgress
  guided: boolean
  /** robot holds its ready pose (arm at 0°) */
  hold: boolean
  /** fault injected in the live demo */
  liveFault: Fault
  /** bumped to restart the physical robot in the live sim */
  robotEpoch: number
  live: TwinLive
  link: LinkStatus
  testLive: { checkpoints: Checkpoint[]; score: number; total: number }
  testResults: Checkpoint[] | null
  /** sensor picked from the tray, waiting to be mounted */
  picked: SensorId | null
  selection: TwinSelection
  camera: { preset: TwinCamera; nonce: number }
  panelTab: TwinTab
  sheet: SheetState
  showTheory: boolean

  pick(s: SensorId | null): void
  mount(slot: SlotId): void
  unmount(s: SensorId): void
  setRate(s: SensorId, r: number): void
  setHold(on: boolean): void
  zeroEncoder(): void
  setTempCal(p: Partial<TempCal>): void
  setRule(k: keyof AlertRules, v: number): void
  injectFault(f: Fault): void
  resetRobot(): void
  runTest(): void
  loadSolution(what: 'mounts' | 'rates' | 'calib' | 'rules'): void
  select(s: TwinSelection): void
  markFound(id: string): void
  answerMini(i: number, c: number): void
  answerFinal(i: number, c: number): void
  tutorialFlag(k: 'seenIntro'): void
  goMission(i: number): void
  resetMission(): void
  useHint(): number
  setGuided(on: boolean): void
  setCamera(p: TwinCamera): void
  setTab(t: TwinTab): void
  setSheet(s: SheetState): void
  setTheory(on: boolean): void
  publish(live: TwinLive): void
  finishLab(): void
  saveResult(): Promise<void>
  restartAll(): void
}

let uid = Date.now() % 100000
const newId = (p: string) => `${p}-${(++uid).toString(36)}`
const toast = (k: 'ok' | 'error' | 'info' | 'warn', t: string) => useLab.getState().toast(k, t)
const emptyReading = (): Reading => ({ angle: null, temp: null, vib: null, soc: null, current: null })

export function twinCtx(s: Pick<TwinState, 'mounts' | 'rates' | 'encoderOffset' | 'tempCal' | 'rules' | 'progress' | 'picked' | 'link' | 'hold' | 'testLive'>): TwinCtx {
  const p = s.progress
  return {
    tutorial: p.tutorial,
    found: p.found,
    miniQuizCorrect: scoreQuiz(TWIN_MINI_QUIZ, p.miniAnswers),
    mount: mountReport(s.mounts),
    picked: s.picked,
    rates: s.rates,
    link: s.link,
    hold: s.hold,
    encoderOffset: s.encoderOffset,
    tempCal: s.tempCal,
    rules: s.rules,
    testCheckpoints: s.testLive.checkpoints.map((c) => c.pass),
    testScore: p.testScore,
    finalDone: p.finalAnswers.every((a) => a !== null),
  }
}

const cfgOf = (s: Pick<TwinState, 'mounts' | 'rates' | 'encoderOffset' | 'tempCal'>) => ({ mounts: s.mounts, rates: s.rates, encoderOffset: s.encoderOffset, tempCal: s.tempCal })

export const useTwin = create<TwinState>()(
  persist(
    (set, get) => {
      const recompute = () => {
        const s = get()
        set({ link: linkStatus(linkLoad(s.rates, s.mounts)), testLive: runTwinTest(cfgOf(s), s.rules) })
        checkMissions()
      }
      const checkMissions = () => {
        const s = get()
        if (useLab.getState().route !== 'twin') return
        const m = TWIN_MISSIONS[s.progress.current]
        if (!m || s.progress.completed.includes(m.id)) return
        const st = twinObjectives(m, twinCtx(s))
        if (Object.values(st).every(Boolean)) {
          set({ progress: { ...s.progress, completed: [...s.progress.completed, m.id], guidedUsed: s.progress.guidedUsed || (s.guided && m.id >= 2 && m.id <= 5) } })
          sfx.success()
          toast('ok', `ผ่านภารกิจ "${m.title}" แล้ว เก่งมาก! 🎉`)
        }
      }

      return {
        mounts: emptyMounts(),
        rates: DEFAULT_RATES(),
        encoderOffset: 0,
        tempCal: DEFAULT_TEMP_CAL(),
        rules: DEFAULT_RULES(),
        progress: freshProgress(),
        guided: true,
        hold: false,
        liveFault: 'none',
        robotEpoch: 0,
        live: { truth: initTruth(), reading: emptyReading(), latency: 0, alerts: [], stopped: false },
        link: linkStatus(0),
        testLive: { checkpoints: [], score: 0, total: 4 },
        testResults: null,
        picked: null,
        selection: null,
        camera: { preset: 'overview', nonce: 0 },
        panelTab: 'mission',
        sheet: 'half',
        showTheory: false,

        pick: (picked) => {
          // the "holding" banner at the bottom says what to do; no info card covering the robot
          set({ picked, selection: null })
          if (picked) {
            sfx.select()
            if (get().camera.preset !== 'robot') get().setCamera('robot')
          }
        },
        mount: (slot) => {
          const s = get()
          const sensor = s.picked
          if (!sensor) return
          const other = sensorAt(s.mounts, slot)
          if (other && other !== sensor) {
            toast('warn', `ที่${SLOT_TH[slot]}มี${SENSORS[other].nameTh}ติดอยู่แล้ว ถอดออกก่อนในแท็บเซนเซอร์`)
            sfx.warn()
            return
          }
          set({ mounts: { ...s.mounts, [sensor]: slot }, picked: null, selection: null })
          if (slot === SENSORS[sensor].slot) {
            sfx.plug()
            toast('ok', `ติด${SENSORS[sensor].nameTh}แล้ว ข้อมูลเริ่มไหล แฝดประกอบ${({ legs: 'ขา', pelvis: 'สะโพก', arms: 'แขน', torso: 'ลำตัว', head: 'หัว' } as const)[SENSORS[sensor].part]}ขึ้นมา!`)
          } else {
            sfx.warn()
            toast('warn', `${SENSORS[sensor].nameTh}ติดที่${SLOT_TH[slot]}: ข้อมูลไม่ตรงกับที่ต้องการ ดูเหตุผลในแท็บเซนเซอร์`)
          }
          recompute()
        },
        unmount: (sensor) => {
          set({ mounts: { ...get().mounts, [sensor]: null } })
          sfx.remove()
          recompute()
        },
        setRate: (sensor, r) => {
          set({ rates: { ...get().rates, [sensor]: r } })
          recompute()
        },
        setHold: (hold) => {
          set({ hold })
          sfx.click()
        },
        zeroEncoder: () => {
          const s = get()
          if (s.mounts.angle !== 'shoulderR') {
            toast('warn', 'ติดเซนเซอร์มุมที่ข้อไหล่ขวาก่อน (ภารกิจที่ 2)')
            return
          }
          const raw = encoderRaw(s.live.truth.angle)
          set({ encoderOffset: raw })
          if (Math.abs(s.live.truth.angle) > 2) {
            sfx.warn()
            toast('warn', `ตั้งศูนย์ตอนแขนกางอยู่ ${s.live.truth.angle.toFixed(0)}° ศูนย์จึงเพี้ยน ให้หุ่นยืนท่าเตรียมก่อนแล้วกดใหม่`)
          } else {
            sfx.correct()
            toast('ok', 'ตั้งศูนย์แล้ว แขนแฝดตรงกับแขนจริง')
          }
          recompute()
        },
        setTempCal: (p) => {
          set({ tempCal: { ...get().tempCal, ...p } })
          recompute()
        },
        setRule: (k, v) => {
          set({ rules: { ...get().rules, [k]: v } })
          recompute()
        },
        injectFault: (liveFault) => {
          set({ liveFault, hold: false })
          sfx.click()
        },
        resetRobot: () => {
          set({ liveFault: 'none', hold: false, robotEpoch: get().robotEpoch + 1, live: { ...get().live, truth: initTruth(), stopped: false, alerts: [] } })
          sfx.powerOn()
        },
        runTest: () => {
          const s = get()
          const r = runTwinTest(cfgOf(s), s.rules)
          set({ testResults: r.checkpoints, testLive: r, progress: { ...s.progress, testScore: { score: r.score, total: r.total } } })
          if (r.score >= r.total) sfx.success()
          else sfx.error()
          checkMissions()
        },
        loadSolution: (what) => {
          if (what === 'mounts') set({ mounts: SOLUTION_MOUNTS(), picked: null })
          if (what === 'rates') set({ rates: SOLUTION_RATES() })
          if (what === 'calib') set({ encoderOffset: encoderRaw(0), tempCal: { ...TEMP_DATASHEET } })
          if (what === 'rules') set({ rules: SOLUTION_RULES() })
          toast('info', 'วางตัวอย่างเฉลยให้แล้ว ลองสังเกตว่าแต่ละค่าตั้งไว้เท่าไรและเพราะอะไร')
          recompute()
        },
        select: (selection) => {
          set({ selection })
          if (!selection) return
          sfx.select()
          if (selection.kind === 'device') get().markFound(selection.id)
        },
        markFound: (id) => {
          const p = get().progress
          if (!p.found.includes(id)) set({ progress: { ...p, found: [...p.found, id] } })
          checkMissions()
        },
        answerMini: (i, c) => {
          const p = get().progress
          const miniAnswers = [...p.miniAnswers]
          miniAnswers[i] = c
          set({ progress: { ...p, miniAnswers } })
          if (TWIN_MINI_QUIZ[i].answer === c) sfx.correct()
          else sfx.error()
          checkMissions()
        },
        answerFinal: (i, c) => {
          const p = get().progress
          if (p.finalAnswers[i] !== null) return
          const finalAnswers = [...p.finalAnswers]
          finalAnswers[i] = c
          set({ progress: { ...p, finalAnswers } })
          if (TWIN_FINAL_QUIZ[i].answer === c) sfx.correct()
          else sfx.error()
          checkMissions()
        },
        tutorialFlag: (k) => {
          const p = get().progress
          set({ progress: { ...p, tutorial: { ...p.tutorial, [k]: true } } })
          checkMissions()
        },
        goMission: (i) => {
          const p = get().progress
          if (i > 0 && !p.completed.includes(i - 1)) {
            toast('info', 'ภารกิจนี้ยังล็อกอยู่ ผ่านภารกิจก่อนหน้าก่อนนะ')
            return
          }
          set({ progress: { ...p, current: i }, panelTab: 'mission', showTheory: false, hold: false })
          sfx.click()
          checkMissions()
        },
        resetMission: () => {
          const p = get().progress
          const m = p.current
          const patch: Partial<TwinProgress> = {}
          if (m === 1) Object.assign(patch, { found: [], miniAnswers: [null, null, null] })
          if (m === 2) set({ mounts: emptyMounts(), picked: null })
          if (m === 3) set({ rates: DEFAULT_RATES() })
          if (m === 4) set({ encoderOffset: 0, tempCal: DEFAULT_TEMP_CAL(), hold: false })
          if (m === 5) {
            set({ rules: DEFAULT_RULES(), testResults: null })
            patch.testScore = null
          }
          if (m === 6) patch.finalAnswers = TWIN_FINAL_QUIZ.map(() => null)
          set({ progress: { ...get().progress, ...patch, completed: p.completed.filter((x) => x !== m) } })
          toast('info', 'เริ่มภารกิจนี้ใหม่แล้ว')
          recompute()
        },
        useHint: () => {
          const p = get().progress
          const lvl = Math.min(3, (p.hintLevel[p.current] ?? 0) + 1)
          set({ progress: { ...p, hintLevel: { ...p.hintLevel, [p.current]: lvl }, hintsUsed: p.hintsUsed + 1 } })
          return lvl
        },
        setGuided: (guided) => {
          set({ guided })
          sfx.click()
        },
        setCamera: (preset) => set({ camera: { preset, nonce: get().camera.nonce + 1 } }),
        setTab: (panelTab) => set({ panelTab }),
        setSheet: (sheet) => set({ sheet }),
        setTheory: (showTheory) => set({ showTheory }),
        publish: (live) => {
          set({ live })
          checkMissions()
        },
        finishLab: () => {
          const p = get().progress
          set({ progress: { ...p, finishedAt: p.finishedAt ?? Date.now(), resultId: p.resultId ?? newId('twres') } })
          useLab.getState().setRoute('twinsummary')
          void get().saveResult()
        },
        saveResult: async () => {
          const s = get()
          const p = s.progress
          const id = p.resultId ?? newId('twres')
          if (!p.resultId) set({ progress: { ...p, resultId: id } })
          const end = p.finishedAt ?? Date.now()
          const profile = useLab.getState().profile
          const rec: ResultRecord = {
            id,
            lab: 'twin',
            nickname: profile.nickname || 'ไม่ระบุชื่อ',
            school: profile.school,
            startedAt: p.startedAt ?? end,
            finishedAt: end,
            durationS: Math.round((end - (p.startedAt ?? end)) / 1000),
            quizScore: p.finalAnswers.every((a) => a !== null) ? scoreQuiz(TWIN_FINAL_QUIZ, p.finalAnswers) : null,
            quizTotal: TWIN_FINAL_QUIZ.length,
            missionsPassed: [...p.completed].sort(),
            challenge: 'twin-guard',
            autoScore: p.testScore?.score ?? null,
            hintsUsed: p.hintsUsed,
            guided: p.guidedUsed,
          }
          const r = await saveResult(rec)
          toast(r.local ? 'ok' : 'error', r.remote === 'ok' ? 'บันทึกผลแล้ว (ในเครื่องและบนฐานข้อมูล)' : r.remote === 'error' ? `บันทึกในเครื่องแล้ว แต่ส่งขึ้นฐานข้อมูลไม่สำเร็จ: ${r.error}` : 'บันทึกผลในเครื่องนี้แล้ว')
        },
        restartAll: () => {
          set({
            mounts: emptyMounts(),
            rates: DEFAULT_RATES(),
            encoderOffset: 0,
            tempCal: DEFAULT_TEMP_CAL(),
            rules: DEFAULT_RULES(),
            progress: freshProgress(),
            hold: false,
            liveFault: 'none',
            live: { truth: initTruth(), reading: emptyReading(), latency: 0, alerts: [], stopped: false },
            testResults: null,
            picked: null,
            selection: null,
          })
          recompute()
        },
      }
    },
    {
      name: 'twin-lab-state-v1',
      version: 1,
      partialize: (s) => ({ mounts: s.mounts, rates: s.rates, encoderOffset: s.encoderOffset, tempCal: s.tempCal, rules: s.rules, progress: s.progress, guided: s.guided }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<TwinState>
        return { ...current, ...p, progress: { ...freshProgress(), ...(p.progress ?? {}) } }
      },
    },
  ),
)

function syncDerived() {
  const s = useTwin.getState()
  useTwin.setState({ link: linkStatus(linkLoad(s.rates, s.mounts)), testLive: runTwinTest(cfgOf(s), s.rules) })
}
syncDerived()
useTwin.persist.onFinishHydration(syncDerived)
