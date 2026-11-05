import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { scoreQuiz } from '../engine/quiz'
import { saveResult, type ResultRecord } from '../services/results'
import { sfx } from '../services/sound'
import { useLab } from '../store/lab'
import { computeLevels, defaultMixer, type Levels, type MixerState } from './engine/audio'
import { defaultAddresses, defaultConsole, type ConsoleValues, type FixtureOutput } from './engine/dmx'
import { AV_FINAL_QUIZ, AV_MINI_QUIZ, AV_MISSIONS, avObjectives, M4_QUESTION, type AvCtx } from './engine/missions'
import { analyzePatch, DEVICES, orientCable, PORTS, type Cable, type DeviceId, type PatchReport } from './engine/patch'
import { defaultExhibit, rigOutput, runExhibitTest, runShowTest, SOLUTION_CUES, SOLUTION_EXHIBIT, type Checkpoint, type Cue, type ExhibitScenes, type SceneState } from './engine/show'
import { AUDIO_CABLES, DMX_CABLES, MONITOR_CABLES, SOLUTION_ADDRESSES } from './engine/solutions'
import { avSound } from './sound'

export type AvCamera = 'overview' | 'truss' | 'stage' | 'foh' | 'rack'
export type AvTab = 'mission' | 'patch' | 'light' | 'sound' | 'show'
export type AvSelection = { kind: 'device'; id: DeviceId } | { kind: 'cable'; id: string } | null

export interface AvProgress {
  current: number
  completed: number[]
  found: string[]
  miniAnswers: Array<number | null>
  tutorial: { cam: boolean; select: boolean; cable: boolean; seenIntro: boolean }
  powerOrderOk: boolean
  gainOk: boolean
  loudOk: boolean
  m4Answer: number | null
  showScore: { score: number; total: number } | null
  /** mission 5 challenge: concert cue list or interactive exhibit */
  challenge: 'concert' | 'exhibit' | null
  exhibitScore: { score: number; total: number } | null
  finalAnswers: Array<number | null>
  hintLevel: Record<number, number>
  hintsUsed: number
  guidedUsed: boolean
  startedAt: number | null
  finishedAt: number | null
  resultId: string | null
}

const freshProgress = (): AvProgress => ({
  current: 0,
  completed: [],
  found: [],
  miniAnswers: [null, null, null],
  tutorial: { cam: false, select: false, cable: false, seenIntro: false },
  powerOrderOk: false,
  gainOk: false,
  loudOk: false,
  m4Answer: null,
  showScore: null,
  challenge: null,
  exhibitScore: null,
  finalAnswers: AV_FINAL_QUIZ.map(() => null),
  hintLevel: {},
  hintsUsed: 0,
  guidedUsed: false,
  startedAt: null,
  finishedAt: null,
  resultId: null,
})

export interface AvLive {
  t: number
  levels: Levels
  rig: Record<string, FixtureOutput>
  rehearsing: boolean
  showPlaying: boolean
  showT: number
  /** peak-hold meter for the stand mic channel (dBFS) */
  meter: number
}

interface AvState {
  cables: Cable[]
  patch: PatchReport
  addresses: Record<string, number>
  console: ConsoleValues
  mixer: MixerState
  cues: Cue[]
  progress: AvProgress
  guided: boolean
  live: AvLive
  showLive: { checkpoints: Checkpoint[]; score: number; total: number }
  showResults: Checkpoint[] | null
  scenes: ExhibitScenes
  /** apply the exhibit scenes live (presence demo) */
  exhibitDemo: boolean
  visitor: boolean
  exhibitLive: { checkpoints: Checkpoint[]; score: number; total: number }
  exhibitResults: Checkpoint[] | null
  selectedFixture: string
  mode: 'select' | 'cable'
  cableStart: string | null
  hoverPort: string | null
  selection: AvSelection
  camera: { preset: AvCamera; nonce: number }
  panelTab: AvTab
  sheet: 'peek' | 'half' | 'full'
  showTheory: boolean

  connect(port: string): void
  removeCable(id: string): void
  removeLastCable(): void
  clearCables(): void
  setMode(m: 'select' | 'cable'): void
  setHoverPort(p: string | null): void
  select(s: AvSelection): void
  setAddress(f: string, a: number): void
  setFader(f: string, ch: number, v: number): void
  selectFixture(f: string): void
  setMixer(p: Partial<MixerState>): void
  setChannel(ch: 'ch1' | 'ch2', p: Partial<MixerState['ch1']>): void
  setPower(which: 'mixer' | 'amp', on: boolean): void
  setRehearsing(on: boolean): void
  playShow(on: boolean): void
  addCue(c?: Partial<Cue>): void
  updateCue(id: string, c: Partial<Cue>): void
  removeCue(id: string): void
  runShowTest(): void
  loadSolution(what: 'dmx' | 'audio' | 'monitor' | 'cues' | 'exhibit'): void
  chooseChallenge(c: 'concert' | 'exhibit'): void
  updateScene(which: keyof ExhibitScenes, p: Partial<SceneState>): void
  setExhibitDemo(on: boolean): void
  setVisitor(on: boolean): void
  runExhibitTest(): void
  markFound(id: string): void
  answerMini(i: number, c: number): void
  answerM4(c: number): void
  answerFinal(i: number, c: number): void
  tutorialFlag(k: 'cam' | 'select' | 'cable' | 'seenIntro'): void
  setStats(p: Partial<Pick<AvProgress, 'gainOk' | 'loudOk'>>): void
  goMission(i: number): void
  resetMission(): void
  useHint(): number
  setGuided(on: boolean): void
  setCamera(p: AvCamera): void
  setTab(t: AvTab): void
  setSheet(s: 'peek' | 'half' | 'full'): void
  setTheory(on: boolean): void
  publish(live: AvLive): void
  finishLab(): void
  saveResult(): Promise<void>
  restartAll(): void
}

let uid = Date.now() % 100000
const newId = (p: string) => `${p}-${(++uid).toString(36)}`
const toast = (k: 'ok' | 'error' | 'info' | 'warn', t: string) => useLab.getState().toast(k, t)

export function avCtx(s: Pick<AvState, 'cables' | 'patch' | 'addresses' | 'mixer' | 'live' | 'progress' | 'cues' | 'showLive' | 'exhibitLive' | 'scenes'>): AvCtx {
  const p = s.progress
  return {
    cables: s.cables,
    patch: s.patch,
    addresses: s.addresses,
    mixer: s.mixer,
    levels: s.live.levels,
    rig: s.live.rig,
    found: p.found,
    miniQuizCorrect: scoreQuiz(AV_MINI_QUIZ, p.miniAnswers),
    tutorial: p.tutorial,
    powerOrderOk: p.powerOrderOk,
    gainOk: p.gainOk,
    loudOk: p.loudOk,
    answerOk: p.m4Answer === M4_QUESTION.answer,
    cues: s.cues,
    showScore: p.showScore,
    showCheckpoints: s.showLive.checkpoints.map((c) => c.pass),
    challenge: p.challenge,
    exhibitScore: p.exhibitScore,
    exhibitCheckpoints: s.exhibitLive.checkpoints.map((c) => c.pass),
    scenesEdited: JSON.stringify(s.scenes.idle) !== JSON.stringify(s.scenes.visitor),
    finalDone: p.finalAnswers.every((a) => a !== null),
  }
}

const initialPatch = analyzePatch([])
const initialLive = (): AvLive => ({
  t: 0,
  levels: computeLevels(defaultMixer(), initialPatch, null),
  rig: rigOutput(defaultConsole(), defaultAddresses(), initialPatch),
  rehearsing: false,
  showPlaying: false,
  showT: 0,
  meter: -60,
})

export const useAv = create<AvState>()(
  persist(
    (set, get) => {
      const recompute = (patchChanged: boolean) => {
        const s = get()
        const patch = patchChanged ? analyzePatch(s.cables) : s.patch
        const show = runShowTest(s.cues, s.addresses, patch, s.mixer)
        set({ patch, showLive: show, exhibitLive: runExhibitTest(s.scenes, s.addresses, patch, s.mixer) })
        checkMissions()
      }
      const checkMissions = () => {
        const s = get()
        if (useLab.getState().route !== 'av') return
        const m = AV_MISSIONS[s.progress.current]
        if (!m || s.progress.completed.includes(m.id)) return
        const st = avObjectives(m, avCtx(s))
        if (Object.values(st).every(Boolean)) {
          set({ progress: { ...s.progress, completed: [...s.progress.completed, m.id], guidedUsed: s.progress.guidedUsed || (s.guided && m.id >= 2 && m.id <= 5) } })
          sfx.success()
          toast('ok', `ผ่านภารกิจ "${m.title}" แล้ว เก่งมาก! 🎉`)
        }
      }

      return {
        cables: [],
        patch: initialPatch,
        addresses: defaultAddresses(),
        console: defaultConsole(),
        mixer: defaultMixer(),
        cues: [],
        progress: freshProgress(),
        guided: true,
        live: initialLive(),
        showLive: { checkpoints: [], score: 0, total: 4 },
        showResults: null,
        scenes: defaultExhibit(),
        exhibitDemo: false,
        visitor: false,
        exhibitLive: { checkpoints: [], score: 0, total: 2 },
        exhibitResults: null,
        selectedFixture: 'par1',
        mode: 'select',
        cableStart: null,
        hoverPort: null,
        selection: null,
        camera: { preset: 'overview', nonce: 0 },
        panelTab: 'mission',
        sheet: 'half',
        showTheory: false,

        connect: (port) => {
          const s = get()
          if (s.mode !== 'cable') return
          const used = s.cables.find((c) => c.from === port || c.to === port)
          if (used && port !== s.cableStart) {
            toast('warn', 'ช่องนี้มีสายเสียบอยู่แล้ว (1 ช่องเสียบได้ 1 สาย) แตะสายนั้นแล้วกด "ถอดสาย" ก่อน')
            sfx.warn()
            return
          }
          if (!s.cableStart) {
            set({ cableStart: port })
            sfx.click()
            return
          }
          if (s.cableStart === port) {
            set({ cableStart: null })
            return
          }
          const o = orientCable(s.cableStart, port)
          if (!o.ok) {
            toast('warn', o.reason)
            sfx.warn()
            set({ cableStart: null })
            return
          }
          set({ cables: [...s.cables, { id: newId('c'), from: o.from, to: o.to }], cableStart: null })
          sfx.plug()
          if (!get().progress.tutorial.cable) get().tutorialFlag('cable')
          recompute(true)
        },
        removeCable: (id) => {
          set({ cables: get().cables.filter((c) => c.id !== id), selection: null })
          sfx.remove()
          recompute(true)
        },
        removeLastCable: () => {
          const c = get().cables.at(-1)
          if (c) get().removeCable(c.id)
          else toast('info', 'ยังไม่มีสายให้ถอด')
        },
        clearCables: () => {
          set({ cables: [], selection: null, cableStart: null })
          sfx.remove()
          recompute(true)
        },
        setMode: (mode) => set({ mode, cableStart: null }),
        setHoverPort: (hoverPort) => {
          if (get().hoverPort !== hoverPort) set({ hoverPort })
        },
        select: (selection) => {
          set({ selection })
          if (!selection) return
          sfx.select()
          if (!get().progress.tutorial.select) get().tutorialFlag('select')
          if (selection.kind === 'device') get().markFound(selection.id)
        },
        setAddress: (f, a) => {
          set({ addresses: { ...get().addresses, [f]: Math.max(1, Math.min(512, Math.round(a) || 1)) } })
          recompute(false)
        },
        setFader: (f, ch, v) => {
          const c = get().console
          const vals = [...c[f]]
          vals[ch] = Math.max(0, Math.min(255, Math.round(v)))
          set({ console: { ...c, [f]: vals } })
        },
        selectFixture: (selectedFixture) => set({ selectedFixture }),
        setMixer: (p) => {
          set({ mixer: { ...get().mixer, ...p } })
          recompute(false)
        },
        setChannel: (ch, p) => {
          const m = get().mixer
          set({ mixer: { ...m, [ch]: { ...m[ch], ...p } } })
          recompute(false)
        },
        setPower: (which, on) => {
          const s = get()
          const m = s.mixer
          if (which === 'amp' && on && !m.mixerOn) {
            toast('warn', 'เปิดแอมป์ก่อนมิกเซอร์: ลำโพงได้รับไฟกระชากตอนมิกเซอร์เปิดทีหลัง (เสียง "ปุ") ควรเปิดมิกเซอร์ก่อนเสมอ')
            avSound.pop()
            set({ mixer: { ...m, ampOn: true }, progress: { ...s.progress, powerOrderOk: false } })
          } else if (which === 'amp' && on) {
            set({ mixer: { ...m, ampOn: true }, progress: { ...s.progress, powerOrderOk: true } })
            sfx.powerOn()
          } else if (which === 'mixer' && !on && m.ampOn) {
            toast('warn', 'ควรปิดแอมป์ก่อนปิดมิกเซอร์ ไม่เช่นนั้นจะมีเสียง "ปุ" กระแทกลำโพง')
            avSound.pop()
            set({ mixer: { ...m, mixerOn: false } })
          } else {
            set({ mixer: { ...m, [which === 'mixer' ? 'mixerOn' : 'ampOn']: on } })
            if (on) sfx.powerOn()
            else sfx.powerOff()
          }
          recompute(false)
        },
        setRehearsing: (rehearsing) => set({ live: { ...get().live, rehearsing, showPlaying: rehearsing ? false : get().live.showPlaying } }),
        playShow: (on) => set({ live: { ...get().live, showPlaying: on, showT: on ? 0 : get().live.showT, rehearsing: false } }),
        addCue: (c) => {
          const s = get()
          const last = [...s.cues].sort((a, b) => a.time - b.time).at(-1)
          const cue: Cue = {
            id: newId('cue'),
            time: last ? Math.min(31, last.time + 4) : 0,
            name: `คิว ${s.cues.length + 1}`,
            parColor: last?.parColor ?? 'blue',
            parLevel: last?.parLevel ?? 40,
            mover: last?.mover ?? 'off',
            wall: last?.wall ?? 'logo',
            mic: last?.mic ?? 'mute',
            ...c,
          }
          set({ cues: [...s.cues, cue] })
          sfx.click()
          recompute(false)
        },
        updateCue: (id, c) => {
          set({ cues: get().cues.map((x) => (x.id === id ? { ...x, ...c } : x)) })
          recompute(false)
        },
        removeCue: (id) => {
          set({ cues: get().cues.filter((x) => x.id !== id) })
          sfx.remove()
          recompute(false)
        },
        chooseChallenge: (challenge) => {
          set({ progress: { ...get().progress, challenge }, showResults: null, exhibitResults: null })
          if (challenge === 'concert') set({ exhibitDemo: false })
          sfx.click()
          checkMissions()
        },
        updateScene: (which, p) => {
          const sc = get().scenes
          set({ scenes: { ...sc, [which]: { ...sc[which], ...p } } })
          recompute(false)
        },
        setExhibitDemo: (exhibitDemo) => set({ exhibitDemo, live: { ...get().live, showPlaying: false, rehearsing: false } }),
        setVisitor: (visitor) => {
          set({ visitor })
          sfx.click()
        },
        runExhibitTest: () => {
          const s = get()
          const r = runExhibitTest(s.scenes, s.addresses, s.patch, s.mixer)
          set({ exhibitResults: r.checkpoints, progress: { ...s.progress, exhibitScore: { score: r.score, total: r.total } } })
          if (r.score >= r.total) sfx.success()
          else sfx.error()
          checkMissions()
        },
        runShowTest: () => {
          const s = get()
          const r = runShowTest(s.cues, s.addresses, s.patch, s.mixer)
          set({ showResults: r.checkpoints, progress: { ...s.progress, showScore: { score: r.score, total: r.total } } })
          if (r.score >= 4) sfx.success()
          else sfx.error()
          checkMissions()
        },
        loadSolution: (what) => {
          const s = get()
          if (what === 'cues') set({ cues: SOLUTION_CUES() })
          else if (what === 'exhibit') set({ scenes: SOLUTION_EXHIBIT() })
          else {
            const keep = (fam: 'dmx' | 'audio') => s.cables.filter((c) => (PORTS[c.from].kind.startsWith('dmx') ? 'dmx' : 'audio') !== fam)
            if (what === 'dmx') set({ cables: [...keep('dmx'), ...DMX_CABLES.map((c) => ({ ...c, id: newId('c') }))], addresses: SOLUTION_ADDRESSES() })
            if (what === 'audio')
              set({ cables: [...keep('audio'), ...AUDIO_CABLES.map((c) => ({ ...c, id: newId('c') }))], mixer: { ...s.mixer, micOnStand: 'micDyn' } })
            if (what === 'monitor') {
              const cables = get().cables.filter((c) => c.to !== 'wedge.in' && c.from !== 'mixer.mon')
              set({ cables: [...cables, ...MONITOR_CABLES.map((c) => ({ ...c, id: newId('c') }))], mixer: { ...get().mixer, wedgePos: 'front', paPos: 'front' } })
            }
          }
          toast('info', 'วางตัวอย่างเฉลยให้แล้ว ลองสังเกตว่าแต่ละสาย/ค่าตั้งอยู่ตรงไหน')
          recompute(true)
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
          if (AV_MINI_QUIZ[i].answer === c) sfx.correct()
          else sfx.error()
          checkMissions()
        },
        answerM4: (c) => {
          set({ progress: { ...get().progress, m4Answer: c } })
          if (c === M4_QUESTION.answer) sfx.correct()
          else sfx.error()
          checkMissions()
        },
        answerFinal: (i, c) => {
          const p = get().progress
          if (p.finalAnswers[i] !== null) return
          const finalAnswers = [...p.finalAnswers]
          finalAnswers[i] = c
          set({ progress: { ...p, finalAnswers } })
          if (AV_FINAL_QUIZ[i].answer === c) sfx.correct()
          else sfx.error()
          checkMissions()
        },
        tutorialFlag: (k) => {
          const p = get().progress
          set({ progress: { ...p, tutorial: { ...p.tutorial, [k]: true } } })
          checkMissions()
        },
        setStats: (patch) => {
          const p = get().progress
          if (Object.entries(patch).every(([k, v]) => p[k as 'gainOk'] === v)) return
          set({ progress: { ...p, ...patch } })
          checkMissions()
        },
        goMission: (i) => {
          const p = get().progress
          if (i > 0 && !p.completed.includes(i - 1)) {
            toast('info', 'ภารกิจนี้ยังล็อกอยู่ ผ่านภารกิจก่อนหน้าก่อนนะ')
            return
          }
          set({ progress: { ...p, current: i }, panelTab: 'mission', showTheory: false })
          sfx.click()
          checkMissions()
        },
        resetMission: () => {
          const p = get().progress
          const m = p.current
          const patch: Partial<AvProgress> = {}
          if (m === 0) patch.tutorial = { cam: false, select: false, cable: false, seenIntro: true }
          if (m === 1) Object.assign(patch, { found: [], miniAnswers: [null, null, null] })
          if (m === 3) Object.assign(patch, { powerOrderOk: false, gainOk: false })
          if (m === 4) Object.assign(patch, { loudOk: false, m4Answer: null })
          if (m === 5) Object.assign(patch, { showScore: null, exhibitScore: null, challenge: null })
          if (m === 6) patch.finalAnswers = AV_FINAL_QUIZ.map(() => null)
          set({ progress: { ...p, ...patch, completed: p.completed.filter((x) => x !== m) }, showResults: null })
          toast('info', 'เริ่มภารกิจนี้ใหม่แล้ว')
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
        setCamera: (preset) => {
          set({ camera: { preset, nonce: get().camera.nonce + 1 } })
          if (!get().progress.tutorial.cam) get().tutorialFlag('cam')
        },
        setTab: (panelTab) => set({ panelTab }),
        setSheet: (sheet) => set({ sheet }),
        setTheory: (showTheory) => set({ showTheory }),
        publish: (live) => {
          set({ live })
          checkMissions()
        },
        finishLab: () => {
          const p = get().progress
          set({ progress: { ...p, finishedAt: p.finishedAt ?? Date.now(), resultId: p.resultId ?? newId('avres') } })
          get().setRehearsing(false)
          get().playShow(false)
          useLab.getState().setRoute('avsummary')
          void get().saveResult()
        },
        saveResult: async () => {
          const s = get()
          const p = s.progress
          const id = p.resultId ?? newId('avres')
          if (!p.resultId) set({ progress: { ...p, resultId: id } })
          const end = p.finishedAt ?? Date.now()
          const profile = useLab.getState().profile
          const rec: ResultRecord = {
            id,
            lab: 'av',
            nickname: profile.nickname || 'ไม่ระบุชื่อ',
            school: profile.school,
            startedAt: p.startedAt ?? end,
            finishedAt: end,
            durationS: Math.round((end - (p.startedAt ?? end)) / 1000),
            quizScore: p.finalAnswers.every((a) => a !== null) ? scoreQuiz(AV_FINAL_QUIZ, p.finalAnswers) : null,
            quizTotal: AV_FINAL_QUIZ.length,
            missionsPassed: [...p.completed].sort(),
            challenge: p.challenge === 'exhibit' ? 'exhibit' : 'concert-show',
            autoScore: (p.challenge === 'exhibit' ? p.exhibitScore?.score : p.showScore?.score) ?? null,
            hintsUsed: p.hintsUsed,
            guided: p.guidedUsed,
          }
          const r = await saveResult(rec)
          toast(r.local ? 'ok' : 'error', r.remote === 'ok' ? 'บันทึกผลแล้ว (ในเครื่องและบนฐานข้อมูล)' : r.remote === 'error' ? `บันทึกในเครื่องแล้ว แต่ส่งขึ้นฐานข้อมูลไม่สำเร็จ: ${r.error}` : 'บันทึกผลในเครื่องนี้แล้ว')
        },
        restartAll: () => {
          set({
            cables: [],
            patch: initialPatch,
            addresses: defaultAddresses(),
            console: defaultConsole(),
            mixer: defaultMixer(),
            cues: [],
            progress: freshProgress(),
            live: initialLive(),
            showResults: null,
            selection: null,
            cableStart: null,
          })
          recompute(true)
        },
      }
    },
    {
      name: 'av-lab-state-v1',
      version: 1,
      partialize: (s) => ({ cables: s.cables, addresses: s.addresses, console: s.console, mixer: s.mixer, cues: s.cues, scenes: s.scenes, progress: s.progress, guided: s.guided }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AvState>
        return { ...current, ...p, progress: { ...freshProgress(), ...(p.progress ?? {}) } }
      },
    },
  ),
)

// derive patch + show status from the hydrated state (localStorage hydrates synchronously)
function syncDerived() {
  const s = useAv.getState()
  const patch = analyzePatch(s.cables)
  useAv.setState({ patch, showLive: runShowTest(s.cues, s.addresses, patch, s.mixer), exhibitLive: runExhibitTest(s.scenes, s.addresses, patch, s.mixer) })
}
syncDerived()
useAv.persist.onFinishHydration(syncDerived)

export const deviceName = (id: string) => DEVICES[id as DeviceId]?.nameTh ?? id
