/** Sound effects synthesised with the Web Audio API (no audio files). */
let ctx: AudioContext | null = null
let muted = false
let buzzerOsc: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null = null

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    ctx = new C()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.12) {
  const c = ac()
  if (!c || muted) return
  const t0 = c.currentTime + start
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(c.destination)
  o.start(t0)
  o.stop(t0 + dur + 0.05)
}

export const sfx = {
  click: () => tone(880, 0, 0.06, 'triangle', 0.08),
  select: () => {
    tone(660, 0, 0.07, 'triangle', 0.08)
    tone(990, 0.05, 0.08, 'triangle', 0.07)
  },
  plug: () => {
    tone(420, 0, 0.05, 'square', 0.05)
    tone(1250, 0.04, 0.06, 'triangle', 0.07)
  },
  place: () => tone(300, 0, 0.09, 'triangle', 0.1),
  remove: () => tone(220, 0, 0.12, 'sawtooth', 0.05),
  powerOn: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.18, 'sine', 0.1)),
  powerOff: () => [784, 523, 392].forEach((f, i) => tone(f, i * 0.07, 0.15, 'sine', 0.08)),
  error: () => {
    tone(180, 0, 0.18, 'sawtooth', 0.07)
    tone(140, 0.16, 0.22, 'sawtooth', 0.07)
  },
  warn: () => tone(330, 0, 0.15, 'square', 0.05),
  success: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.22, 'triangle', 0.09)),
  correct: () => {
    tone(784, 0, 0.1, 'triangle', 0.09)
    tone(1175, 0.09, 0.16, 'triangle', 0.09)
  },
}

/** The circuit's buzzer: a pulsed tone while it is on. */
export function setBuzzer(on: boolean) {
  const c = ac()
  if (!c) return
  if (on && !muted && !buzzerOsc) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    const lfo = c.createOscillator()
    const lfoGain = c.createGain()
    osc.type = 'square'
    osc.frequency.value = 1900
    gain.gain.value = 0.025
    lfo.frequency.value = 4
    lfoGain.gain.value = 0.025
    lfo.connect(lfoGain).connect(gain.gain)
    osc.connect(gain).connect(c.destination)
    osc.start()
    lfo.start()
    buzzerOsc = { osc, gain, lfo }
  } else if ((!on || muted) && buzzerOsc) {
    buzzerOsc.osc.stop()
    buzzerOsc.lfo.stop()
    buzzerOsc.gain.disconnect()
    buzzerOsc = null
  }
}

export function setMuted(m: boolean) {
  muted = m
  if (m) setBuzzer(false)
}
