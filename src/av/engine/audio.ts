/**
 * Live-sound model (teaching level). Levels follow the usual chain:
 *   SPL at mic → mic sensitivity (dBu) → preamp gain → dBFS (0 dBFS = +18 dBu, clip point)
 *   → channel fader → master → amplifier/speaker → SPL in the room (inverse-square law)
 * Feedback: the loop gain mic → speaker → back into the mic, using distance, speaker
 * directivity, the cardioid pickup pattern and a worst-case room/EQ resonance peak.
 * When the loop gain reaches 0 dB the system howls.
 */
import type { PatchReport } from './patch'

export type V3 = [number, number, number]

export const MIC_SPEC = {
  micDyn: { sens: -52, needsPhantom: false, th: 'ไดนามิก' },
  micCond: { sens: -38, needsPhantom: true, th: 'คอนเดนเซอร์' },
} as const
export type MicId = keyof typeof MIC_SPEC

export const DBFS_REF_DBU = 18 // 0 dBFS = +18 dBu
export const K_PA = 130 // SPL @1 m per PA box at 0 dBFS
export const K_WEDGE = 122 // SPL @1 m of the active wedge at 0 dBFS send
export const RESONANCE_DB = 10 // worst-case peak (room modes + speaker response)
export const TARGET = { fohSpl: 98, monSpl: 102, metroMin: -18, metroMax: -3 }

/* ---------------- stage geometry (metres) ---------------- */
export const GEO = {
  mic: [0, 1.6, 1.2] as V3,
  micAxis: [0, 0, -1] as V3, // points at the singer
  singer: [0, 1.7, 0.8] as V3,
  foh: [0, 1.7, 13] as V3,
  pa: {
    front: { L: [-5.5, 2.2, 3.6] as V3, R: [5.5, 2.2, 3.6] as V3 },
    back: { L: [-2.5, 2.4, -1.5] as V3, R: [2.5, 2.4, -1.5] as V3 },
  },
  paAxis: [0, 0, 1] as V3,
  wedge: {
    front: { pos: [0, 1.25, 2.4] as V3, axis: norm([0, 0.45, -1.6]) },
    behind: { pos: [0, 1.25, 0.0] as V3, axis: [0, 0, 1] as V3 },
  },
}
export type PaPos = keyof typeof GEO.pa
export type WedgePos = keyof typeof GEO.wedge

function norm(v: V3): V3 {
  const l = Math.hypot(...v)
  return [v[0] / l, v[1] / l, v[2] / l]
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const dist = (a: V3, b: V3) => Math.hypot(...sub(a, b))
/** Inverse-square law: −6 dB per doubling of distance (reference 1 m). */
export const distanceLoss = (d: number) => -20 * Math.log10(Math.max(0.3, d))

/** Speaker radiates mostly forward. */
export function speakerDirectivity(axis: V3, from: V3, to: V3): number {
  const c = dot(axis, norm(sub(to, from)))
  return c >= 0.5 ? 0 : c >= 0 ? -6 : -15
}
/** Cardioid pickup: 20·log10(0.5 + 0.5·cosθ), floor −25 dB at the rear. */
export function cardioid(axis: V3, mic: V3, source: V3): number {
  const c = dot(axis, norm(sub(source, mic)))
  return Math.max(-25, 20 * Math.log10(Math.max(1e-3, 0.5 + 0.5 * c)))
}

const powerSum = (dbs: number[]) => (dbs.length ? 10 * Math.log10(dbs.reduce((s, x) => s + Math.pow(10, x / 10), 0)) : -Infinity)

/* ---------------- mixer state ---------------- */

export interface Channel {
  gain: number // 0–60 dB
  phantom: boolean
  mute: boolean
  fader: number // −60…+10 dB
  mon: number // monitor send −60…+10 dB (pre-fader)
}
export interface MixerState {
  ch1: Channel
  ch2: Channel
  master: number
  mixerOn: boolean
  ampOn: boolean
  /** which microphone the singer is using on the stand */
  micOnStand: MicId
  paPos: PaPos
  wedgePos: WedgePos
}

export const defaultMixer = (): MixerState => ({
  ch1: { gain: 20, phantom: false, mute: false, fader: 0, mon: -60 },
  ch2: { gain: 20, phantom: false, mute: false, fader: 0, mon: -60 },
  master: -12,
  mixerOn: false,
  ampOn: false,
  micOnStand: 'micDyn',
  paPos: 'front',
  wedgePos: 'behind',
})

/* ---------------- singer ---------------- */

/** Rehearsal loop (16 s): verse 93–99 dB SPL at the mic, chorus 101–107 dB. */
export function singerSpl(t: number): { spl: number; section: 'verse' | 'chorus' } {
  const tt = ((t % 16) + 16) % 16
  const section = tt < 8 ? 'verse' : 'chorus'
  const base = section === 'verse' ? 96 : 104
  return { spl: base + 3 * (2 * Math.abs(Math.sin(Math.PI * 2.5 * tt)) - 1), section }
}

/* ---------------- levels ---------------- */

export interface Levels {
  /** the stand microphone reaches a mixer channel and produces signal */
  signal: boolean
  silentReason: string | null
  channel: 'ch1' | 'ch2' | null
  /** pre-fader channel level (dBFS), null when no signal */
  preDbfs: number | null
  mainDbfs: number | null
  clipPre: boolean
  clipMain: boolean
  /** number of PA boxes playing the main mix */
  paBoxes: number
  fohSpl: number | null
  monSpl: number | null
  /** total loop gain (dB); ≥ 0 means feedback */
  loopGain: number
  feedback: boolean
  /** individual paths for teaching ("which speaker causes it") */
  loopParts: Array<{ who: 'spkL' | 'spkR' | 'wedge'; db: number }>
  ampProtect: Array<'A' | 'B'>
}

export function computeLevels(m: MixerState, patch: PatchReport, splMic: number | null): Levels {
  const mic = m.micOnStand
  const spec = MIC_SPEC[mic]
  const channel = patch.micChannel[mic]
  const ch = channel ? m[channel] : null
  const ampProtect = (['A', 'B'] as const).filter((c) => patch.impedance[c] < 4)
  const base: Levels = {
    signal: false,
    silentReason: null,
    channel,
    preDbfs: null,
    mainDbfs: null,
    clipPre: false,
    clipMain: false,
    paBoxes: 0,
    fohSpl: null,
    monSpl: null,
    loopGain: -Infinity,
    feedback: false,
    loopParts: [],
    ampProtect,
  }
  if (!m.mixerOn) return { ...base, silentReason: 'มิกเซอร์ยังไม่เปิด' }
  if (!channel || !ch) return { ...base, silentReason: `ไมค์${spec.th}บนขาตั้งยังไม่ได้ต่อเข้ามิกเซอร์` }
  if (spec.needsPhantom && !ch.phantom) return { ...base, silentReason: 'ไมค์คอนเดนเซอร์ต้องเปิด Phantom +48V จึงจะมีสัญญาณ' }

  // G: dB from SPL at the mic to channel dBFS (pre-fader)
  const toDbfs = -94 + spec.sens + ch.gain - DBFS_REF_DBU
  const preDbfs = splMic == null ? null : splMic + toDbfs
  const live = !ch.mute
  const mainOffset = ch.fader + m.master
  const mainDbfs = preDbfs == null || !live ? null : preDbfs + mainOffset

  // PA boxes playing MAIN (amp on, input from MAIN, not in protect)
  const boxes: Array<{ who: 'spkL' | 'spkR'; pos: V3 }> = []
  if (m.ampOn)
    for (const spk of ['spkL', 'spkR'] as const) {
      const f = patch.speakerFeed[spk]
      if (!f || ampProtect.includes(f.ch)) continue
      if (f.src !== 'mainL' && f.src !== 'mainR') continue
      boxes.push({ who: spk, pos: GEO.pa[m.paPos][spk === 'spkL' ? 'L' : 'R'] })
    }

  // channel mute also silences its monitor send
  const wedgeOn = patch.wedgeSrc === 'mon' && live
  const wedge = GEO.wedge[m.wedgePos]

  // loop gain paths (independent of how loud the singer is)
  const parts: Levels['loopParts'] = []
  if (live)
    for (const b of boxes) {
      const g = toDbfs + mainOffset + K_PA // SPL@1m minus SPL at mic
      parts.push({
        who: b.who,
        db: g + distanceLoss(dist(b.pos, GEO.mic)) + speakerDirectivity(GEO.paAxis, b.pos, GEO.mic) + cardioid(GEO.micAxis, GEO.mic, b.pos) + RESONANCE_DB,
      })
    }
  if (wedgeOn) {
    const g = toDbfs + ch.mon + K_WEDGE
    parts.push({
      who: 'wedge',
      db: g + distanceLoss(dist(wedge.pos, GEO.mic)) + speakerDirectivity(wedge.axis, wedge.pos, GEO.mic) + cardioid(GEO.micAxis, GEO.mic, wedge.pos) + RESONANCE_DB,
    })
  }
  const loopGain = powerSum(parts.map((x) => x.db))

  const fohSpl =
    mainDbfs == null || !boxes.length ? null : powerSum(boxes.map((b) => K_PA + mainDbfs + distanceLoss(dist(b.pos, GEO.foh)) + speakerDirectivity(GEO.paAxis, b.pos, GEO.foh)))
  const monSpl = wedgeOn && preDbfs != null ? K_WEDGE + preDbfs + ch.mon + distanceLoss(dist(wedge.pos, GEO.singer)) : null

  let silentReason: string | null = null
  if (!live) silentReason = 'ช่องไมค์ถูก Mute อยู่'
  else if (!m.ampOn) silentReason = 'เพาเวอร์แอมป์ยังไม่เปิด'
  else if (!boxes.length) silentReason = ampProtect.length ? 'แอมป์เข้าโหมดป้องกัน (โหลดต่ำเกิน)' : 'ลำโพงหลักยังไม่ได้รับสัญญาณ MAIN ผ่านแอมป์'

  return {
    ...base,
    signal: true,
    silentReason,
    preDbfs,
    mainDbfs,
    clipPre: preDbfs != null && preDbfs > 0,
    clipMain: mainDbfs != null && mainDbfs > 0,
    paBoxes: boxes.length,
    fohSpl,
    monSpl,
    loopGain,
    feedback: loopGain >= 0,
    loopParts: parts,
  }
}

/** Speed of sound for delay-tower alignment: 343 m/s → 2.9 ms per metre. */
export const delayMs = (metres: number) => (metres / 343) * 1000
