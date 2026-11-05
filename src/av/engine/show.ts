/**
 * Show control: a cue list over a 32-second song. Cues go through the real path
 * console → DMX universe → each fixture's own address, so a wrongly addressed or
 * unpatched fixture fails the show test exactly as it would on a real stage.
 */
import { computeLevels, type MixerState } from './audio'
import { buildUniverse, COLOR_RGB, colorName, CONSOLE_PATCH, fixtureOutput, FIXTURES, type ColorName, type ConsoleValues, type FixtureOutput } from './dmx'
import type { PatchReport } from './patch'

export type V3 = [number, number, number]

export const SHOW_LENGTH = 32
export const SONG: Array<{ id: 'intro' | 'verse' | 'chorus' | 'outro' | 'end'; th: string; from: number; to: number }> = [
  { id: 'intro', th: 'อินโทร (ดนตรีนำ)', from: 0, to: 6 },
  { id: 'verse', th: 'ท่อนร้องแรก (Verse)', from: 6, to: 14 },
  { id: 'chorus', th: 'ท่อนฮุก (Chorus)', from: 14, to: 24 },
  { id: 'outro', th: 'ท่อนจบ (Outro)', from: 24, to: 28 },
  { id: 'end', th: 'จบโชว์', from: 28, to: 32 },
]
export const sectionAt = (t: number) => SONG.find((s) => t >= s.from && t < s.to) ?? SONG[SONG.length - 1]

/** Singer SPL at the mic during the show (null = not singing). */
export function showSingerSpl(t: number): number | null {
  const s = sectionAt(t).id
  if (s !== 'verse' && s !== 'chorus') return null
  const base = s === 'verse' ? 96 : 104
  return base + 3 * (2 * Math.abs(Math.sin(Math.PI * 2.5 * t)) - 1)
}

/* ---------------- geometry of the rig (metres) ---------------- */
export const STAGE_Y = 1
export const FIXTURE_POS: Record<string, V3> = {
  par1: [-4.5, 5.7, 0.4],
  par2: [-1.5, 5.7, 0.4],
  par3: [1.5, 5.7, 0.4],
  par4: [4.5, 5.7, 0.4],
  mover1: [-3, 5.8, 0.4],
  mover2: [3, 5.8, 0.4],
}
export const SINGER_SPOT: V3 = [0, STAGE_Y, 0.8]
const AUDIENCE_SPOT: V3 = [0, 0, 8]

/** Beam direction for pan/tilt in degrees: tilt 0 = straight down, pan 0 = towards the audience (+z). */
export function beamDirection(pan: number, tilt: number): V3 {
  const p = (pan * Math.PI) / 180
  const t = (tilt * Math.PI) / 180
  return [Math.sin(p) * Math.sin(t), -Math.cos(t), Math.cos(p) * Math.sin(t)]
}
/** Inverse of beamDirection: DMX values (0–255) to aim a mover at a point. */
export function aimValues(from: V3, to: V3): { pan: number; tilt: number } {
  const v: V3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  const l = Math.hypot(...v)
  const tilt = (Math.acos(-v[1] / l) * 180) / Math.PI
  const pan = (Math.atan2(v[0], v[2]) * 180) / Math.PI
  return { pan: Math.round(128 + (pan / 90) * 128), tilt: Math.round((tilt / 90) * 255) }
}
/** Where a beam lands on a horizontal plane at height y (null if it points up). */
export function beamHit(from: V3, dir: V3, y = STAGE_Y): V3 | null {
  if (dir[1] >= -1e-3) return null
  const k = (y - from[1]) / dir[1]
  return [from[0] + dir[0] * k, y, from[2] + dir[2] * k]
}

/* ---------------- cues ---------------- */

export type MoverMode = 'off' | 'singer' | 'audience' | 'sweep'
export type WallMode = 'off' | 'logo' | 'visualizer' | 'lyrics' | 'info'
export type ParColor = Exclude<ColorName, 'mixed'>

export interface Cue {
  id: string
  time: number
  name: string
  parColor: ParColor
  parLevel: number // 0–100 %
  mover: MoverMode
  wall: WallMode
  mic: 'mute' | 'live'
}

export const MOVER_TH: Record<MoverMode, string> = { off: 'ปิด', singer: 'ส่องนักร้อง (Spotlight)', audience: 'ส่องผู้ชม', sweep: 'ส่ายไปมา' }
export const WALL_TH: Record<WallMode, string> = { off: 'ปิดจอ', logo: 'โลโก้งาน', visualizer: 'ภาพเต้นตามเพลง', lyrics: 'เนื้อเพลง', info: 'ข้อมูลนิทรรศการ' }

export const BLACKOUT: Omit<Cue, 'id' | 'time' | 'name'> = { parColor: 'black', parLevel: 0, mover: 'off', wall: 'off', mic: 'mute' }

export function cueAt(cues: Cue[], t: number): Omit<Cue, 'id' | 'time' | 'name'> {
  let cur: Omit<Cue, 'id' | 'time' | 'name'> = BLACKOUT
  for (const c of [...cues].sort((a, b) => a.time - b.time)) if (c.time <= t + 1e-6) cur = c
  return cur
}

export function cueToConsole(c: Omit<Cue, 'id' | 'time' | 'name'>, t: number): ConsoleValues {
  const out: ConsoleValues = {}
  const [r, g, b] = COLOR_RGB[c.parColor]
  for (const f of FIXTURES) {
    if (f.type === 'par') out[f.id] = [Math.round((c.parLevel / 100) * 255), r, g, b]
    else {
      const from = FIXTURE_POS[f.id]
      if (c.mover === 'off') out[f.id] = [128, 96, 0, 255, 255, 255]
      else if (c.mover === 'sweep') {
        const s = Math.sin(t * 1.6 + (f.id === 'mover2' ? Math.PI : 0))
        out[f.id] = [Math.round(128 + s * 70), 110, 255, 255, 255, 255]
      } else {
        const aim = aimValues(from, c.mover === 'singer' ? SINGER_SPOT : AUDIENCE_SPOT)
        out[f.id] = [aim.pan, aim.tilt, 255, 255, 255, 255]
      }
    }
  }
  return out
}

/** Physical result of a console state on the rig. */
export function rigOutput(values: ConsoleValues, addresses: Record<string, number>, patch: PatchReport, noise = 0): Record<string, FixtureOutput> {
  const u = buildUniverse(values)
  return Object.fromEntries(FIXTURES.map((f) => [f.id, fixtureOutput(f.id, addresses[f.id] ?? CONSOLE_PATCH[f.id], u, !!patch.dmxReceiving[f.id], patch.dmxTerminated, noise)]))
}

/* ---------------- automatic show test ---------------- */

export interface Check {
  th: string
  ok: boolean
}
export interface Checkpoint {
  t: number
  th: string
  checks: Check[]
  pass: boolean
}

const PARS = ['par1', 'par2', 'par3', 'par4']
const MOVERS = ['mover1', 'mover2']

/** At least one lit moving head lands its beam on the singer / exhibit spot. */
function onSpot(rig: Record<string, FixtureOutput>) {
  return MOVERS.some((m) => {
    const o = rig[m]
    if (o.intensity < 0.5) return false
    const hit = beamHit(FIXTURE_POS[m], beamDirection(o.pan, o.tilt))
    return !!hit && Math.hypot(hit[0] - SINGER_SPOT[0], hit[2] - SINGER_SPOT[2]) < 1.2
  })
}

export function runShowTest(cues: Cue[], addresses: Record<string, number>, patch: PatchReport, mixer: MixerState) {
  const at = (t: number) => {
    const cue = cueAt(cues, t)
    const rig = rigOutput(cueToConsole(cue, t), addresses, patch, 0)
    return { cue, rig }
  }
  const micWorks = (t: number) => {
    const lv = computeLevels({ ...mixer, mixerOn: true, ampOn: true }, patch, showSingerSpl(t) ?? 100)
    return lv.signal && lv.paBoxes > 0 && !lv.feedback
  }
  const parColors = (rig: Record<string, FixtureOutput>) => PARS.map((p) => colorName(rig[p].r, rig[p].g, rig[p].b))
  const onSinger = onSpot

  const cps: Checkpoint[] = []
  {
    const t = 3
    const { cue, rig } = at(t)
    const cols = parColors(rig)
    const lv = PARS.map((p) => rig[p].intensity)
    cps.push(mk(t, 'อินโทร (วินาทีที่ 3): บรรยากาศสลัว ๆ รอนักร้อง', [
      { th: 'ไฟ PAR ทุกดวงเป็นสีน้ำเงิน', ok: cols.every((c) => c === 'blue') },
      { th: 'ความสว่าง PAR หรี่ ๆ (ไม่เกิน 60%)', ok: lv.every((x) => x > 0.05 && x <= 0.62) },
      { th: 'ไฟ Moving Head ยังปิด', ok: MOVERS.every((m) => rig[m].intensity < 0.05) },
      { th: 'จอ LED แสดงโลโก้งาน', ok: cue.wall === 'logo' },
      { th: 'ไมค์ยังปิด (Mute) กันเสียงรบกวน', ok: cue.mic === 'mute' },
    ]))
  }
  {
    const t = 10
    const { cue, rig } = at(t)
    cps.push(mk(t, 'ท่อนร้องแรก (วินาทีที่ 10): เน้นนักร้อง', [
      { th: 'Moving Head ส่องสปอตไลต์ไปที่นักร้อง', ok: onSinger(rig) },
      { th: 'ไมค์เปิด (Live) และเสียงออกลำโพงได้โดยไม่หอน', ok: cue.mic === 'live' && micWorks(t) },
      { th: 'จอ LED แสดงเนื้อเพลงหรือภาพเต้นตามเพลง', ok: cue.wall === 'lyrics' || cue.wall === 'visualizer' },
    ]))
  }
  {
    const t = 19
    const { cue, rig } = at(t)
    const cols = parColors(rig)
    cps.push(mk(t, 'ท่อนฮุก (วินาทีที่ 19): พลังเต็มที่', [
      { th: 'ไฟ PAR ทุกดวงสว่างเต็มที่ (90% ขึ้นไป)', ok: PARS.every((p) => rig[p].intensity >= 0.88) },
      { th: 'ไฟ PAR เป็นสีโทนร้อน: แดงหรือม่วงแดง', ok: cols.every((c) => c === 'red' || c === 'magenta') },
      { th: 'จอ LED แสดงภาพเต้นตามเพลง (Visualizer)', ok: cue.wall === 'visualizer' },
      { th: 'ไมค์ยังเปิดอยู่', ok: cue.mic === 'live' && micWorks(t) },
    ]))
  }
  {
    const t = 30
    const { cue, rig } = at(t)
    cps.push(mk(t, 'จบโชว์ (วินาทีที่ 30): Blackout', [
      { th: 'ไฟทุกดวงดับ', ok: [...PARS, ...MOVERS].every((f) => rig[f].intensity < 0.05) },
      { th: 'จอ LED ปิด', ok: cue.wall === 'off' },
      { th: 'ไมค์ปิด (Mute)', ok: cue.mic === 'mute' },
    ]))
  }
  return { checkpoints: cps, score: cps.filter((c) => c.pass).length, total: cps.length }
}

function mk(t: number, th: string, checks: Check[]): Checkpoint {
  return { t, th, checks, pass: checks.every((c) => c.ok) }
}

/** Reference cue list (hint level 3 + unit tests). */
export const SOLUTION_CUES = (): Cue[] => [
  { id: 'q1', time: 0, name: 'Intro', parColor: 'blue', parLevel: 40, mover: 'off', wall: 'logo', mic: 'mute' },
  { id: 'q2', time: 6, name: 'Verse', parColor: 'blue', parLevel: 30, mover: 'singer', wall: 'lyrics', mic: 'live' },
  { id: 'q3', time: 14, name: 'Chorus', parColor: 'red', parLevel: 100, mover: 'singer', wall: 'visualizer', mic: 'live' },
  { id: 'q4', time: 24, name: 'Outro', parColor: 'amber', parLevel: 50, mover: 'singer', wall: 'lyrics', mic: 'live' },
  { id: 'q5', time: 28, name: 'Blackout', parColor: 'black', parLevel: 0, mover: 'off', wall: 'off', mic: 'mute' },
]

/* ---------------- interactive exhibit (Sensing & AI bridge) ---------------- */

/** A stage state without timing: what the room looks and sounds like. */
export type SceneState = Omit<Cue, 'id' | 'time' | 'name'>
export interface ExhibitScenes {
  /** nobody near the exhibit */
  idle: SceneState
  /** the motion sensor detects a visitor */
  visitor: SceneState
}

export const defaultExhibit = (): ExhibitScenes => ({
  idle: { parColor: 'blue', parLevel: 40, mover: 'off', wall: 'logo', mic: 'mute' },
  visitor: { parColor: 'blue', parLevel: 40, mover: 'off', wall: 'logo', mic: 'mute' },
})

export const SOLUTION_EXHIBIT = (): ExhibitScenes => ({
  idle: { parColor: 'amber', parLevel: 20, mover: 'off', wall: 'logo', mic: 'mute' },
  visitor: { parColor: 'amber', parLevel: 70, mover: 'singer', wall: 'info', mic: 'live' },
})

/** Narration level at the mic while a visitor is present (a guide speaking close to the mic). */
export const NARRATION_SPL = 98

export function runExhibitTest(scenes: ExhibitScenes, addresses: Record<string, number>, patch: PatchReport, mixer: MixerState) {
  const rigOf = (s: SceneState) => rigOutput(cueToConsole(s, 0), addresses, patch, 0)
  const narrationWorks = () => {
    const lv = computeLevels({ ...mixer, mixerOn: true, ampOn: true }, patch, NARRATION_SPL)
    return lv.signal && lv.paBoxes > 0 && !lv.feedback
  }
  const idle = rigOf(scenes.idle)
  const visit = rigOf(scenes.visitor)
  const visitColors = PARS.map((p) => colorName(visit[p].r, visit[p].g, visit[p].b))
  const checkpoints: Checkpoint[] = [
    mk(0, 'ไม่มีผู้ชม: ห้องสงบ ประหยัดพลังงาน', [
      { th: 'ไฟ PAR เปิดหรี่ ๆ (ไม่เกิน 30%) ให้ห้องไม่มืดสนิท', ok: PARS.every((p) => idle[p].intensity > 0.03 && idle[p].intensity <= 0.32) },
      { th: 'สปอตไลต์ Moving Head ปิด', ok: MOVERS.every((m) => idle[m].intensity < 0.05) },
      { th: 'จอ LED แสดงโลโก้ (พักหน้าจอ)', ok: scenes.idle.wall === 'logo' },
      { th: 'เสียงบรรยายปิด', ok: scenes.idle.mic === 'mute' },
    ]),
    mk(1, 'เซนเซอร์ตรวจพบผู้ชม: นิทรรศการต้อนรับ', [
      { th: 'สปอตไลต์ส่องที่หุ่นนักร้อง (ชิ้นงานจัดแสดง)', ok: onSpot(visit) },
      { th: 'ไฟ PAR สว่างขึ้น (50% ขึ้นไป) โทนอุ่น: ส้ม (Amber) หรือขาว', ok: PARS.every((p) => visit[p].intensity >= 0.48) && visitColors.every((c) => c === 'amber' || c === 'white') },
      { th: 'จอ LED แสดงข้อมูลนิทรรศการ', ok: scenes.visitor.wall === 'info' },
      { th: 'เสียงบรรยายเปิด และออกลำโพงได้โดยไม่หอน', ok: scenes.visitor.mic === 'live' && narrationWorks() },
    ]),
  ]
  return { checkpoints, score: checkpoints.filter((c) => c.pass).length, total: checkpoints.length }
}
