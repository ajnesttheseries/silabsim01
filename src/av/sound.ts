/**
 * Stage audio, synthesised with Web Audio (no files): a band loop, a "singer" voice that goes
 * through the virtual mixer (so students hear clipping), and the feedback howl.
 * Output is limited (compressor + low gains) to keep it comfortable for a classroom.
 */
let ctx: AudioContext | null = null
let nodes: {
  out: GainNode
  voice: GainNode
  shaper: WaveShaperNode
  howl: GainNode
  howlOsc: OscillatorNode
  music: GainNode
  osc: OscillatorNode
  vib: OscillatorNode
} | null = null
let seq: ReturnType<typeof setInterval> | null = null
let step = 0
let enabled = true

function curve(drive: number) {
  const n = 1024
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    c[i] = drive <= 1 ? x : Math.max(-1, Math.min(1, x * drive)) // hard clip when overdriven
  }
  return c
}

function ensure() {
  if (nodes || typeof window === 'undefined') return nodes
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!C) return null
  ctx = new C()
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.ratio.value = 8
  const out = ctx.createGain()
  out.gain.value = 0.9
  out.connect(comp).connect(ctx.destination)

  // voice: sawtooth + vibrato → two formant band-passes ("aa") → level → clipper
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.value = 220
  const vib = ctx.createOscillator()
  vib.frequency.value = 5.5
  const vibGain = ctx.createGain()
  vibGain.gain.value = 4
  vib.connect(vibGain).connect(osc.frequency)
  const f1 = ctx.createBiquadFilter()
  f1.type = 'bandpass'
  f1.frequency.value = 750
  f1.Q.value = 6
  const f2 = ctx.createBiquadFilter()
  f2.type = 'bandpass'
  f2.frequency.value = 1150
  f2.Q.value = 8
  const voice = ctx.createGain()
  voice.gain.value = 0
  const shaper = ctx.createWaveShaper()
  shaper.curve = curve(1)
  osc.connect(f1).connect(voice)
  osc.connect(f2).connect(voice)
  voice.connect(shaper).connect(out)

  const howlOsc = ctx.createOscillator()
  howlOsc.frequency.value = 2600
  const howl = ctx.createGain()
  howl.gain.value = 0
  howlOsc.connect(howl).connect(out)

  const music = ctx.createGain()
  music.gain.value = 0
  music.connect(out)

  osc.start()
  vib.start()
  howlOsc.start()
  nodes = { out, voice, shaper, howl, howlOsc, music, osc, vib }
  return nodes
}

function hit(freq: number, dur: number, type: OscillatorType, vol: number, sweep = 0) {
  if (!ctx || !nodes) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (sweep) o.frequency.exponentialRampToValueAtTime(sweep, t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(nodes.music)
  o.start(t)
  o.stop(t + dur + 0.02)
}

const BASS = [55, 55, 65.4, 49]
function tick() {
  // 120 bpm, 8th notes
  const s = step++ % 16
  if (s % 4 === 0) hit(140, 0.25, 'sine', 0.9, 45) // kick
  if (s % 2 === 1) hit(6000, 0.04, 'square', 0.05) // hat
  if (s % 8 === 4) hit(220, 0.12, 'triangle', 0.25, 120) // snare-ish
  if (s % 2 === 0) hit(BASS[Math.floor(s / 4)], 0.22, 'sawtooth', 0.18)
}

export const avSound = {
  /** must be called from a user gesture before anything is audible */
  unlock() {
    const n = ensure()
    if (ctx?.state === 'suspended') void ctx.resume()
    return !!n
  },
  setEnabled(on: boolean) {
    enabled = on
    if (!on) this.update({ band: false, voice: null, foh: null, clip: false, feedback: 0 })
  },
  /**
   * voice: singer SPL at the mic (null = silent); foh: SPL the audience hears (null = PA silent)
   * clip: preamp/main clipping; feedback: 0–1 howl amount
   */
  update(s: { band: boolean; voice: number | null; foh: number | null; clip: boolean; feedback: number }) {
    if (!ctx || !nodes) return
    const t = ctx.currentTime
    const audible = enabled && s.foh != null
    // map audience SPL to a safe playback level (≈0.03 – 0.3)
    const lvl = audible ? Math.min(0.3, 0.12 * Math.pow(10, (s.foh! - 98) / 20)) : 0
    nodes.voice.gain.setTargetAtTime(audible && s.voice != null ? lvl * Math.pow(10, (s.voice - 104) / 20) : 0, t, 0.03)
    nodes.osc.frequency.setTargetAtTime(s.voice != null && s.voice > 100 ? 262 : 220, t, 0.2)
    nodes.shaper.curve = curve(s.clip ? 6 : 1)
    nodes.howl.gain.setTargetAtTime(enabled ? Math.min(0.06, s.feedback * 0.06) : 0, t, s.feedback > 0 ? 0.25 : 0.05)
    nodes.music.gain.setTargetAtTime(enabled && s.band ? Math.max(0.04, lvl * 0.6) : 0, t, 0.05)
    if (s.band && enabled && !seq) seq = setInterval(tick, 250)
    if ((!s.band || !enabled) && seq) {
      clearInterval(seq)
      seq = null
    }
  },
  /** speaker "thump" from switching the amp on before the mixer */
  pop() {
    if (!enabled) return
    this.unlock()
    if (!ctx || !nodes) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.setValueAtTime(70, t)
    o.frequency.exponentialRampToValueAtTime(30, t + 0.2)
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    o.connect(g).connect(nodes.out)
    o.start(t)
    o.stop(t + 0.3)
  },
  stop() {
    this.update({ band: false, voice: null, foh: null, clip: false, feedback: 0 })
  },
}
