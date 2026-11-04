import { describe, expect, it } from 'vitest'
import { cardioid, computeLevels, defaultMixer, delayMs, distanceLoss, GEO, singerSpl, TARGET, type MixerState } from './audio'
import { buildUniverse, checkAddresses, colorName, CONSOLE_PATCH, defaultAddresses, defaultConsole, fixtureOutput } from './dmx'
import { analyzePatch, orientCable, type Cable } from './patch'
import { aimValues, beamDirection, beamHit, FIXTURE_POS, rigOutput, runShowTest, SINGER_SPOT, SOLUTION_CUES } from './show'
import { AUDIO_CABLES, DMX_CABLES, MONITOR_CABLES, SOLUTION_ADDRESSES } from './solutions'

const on = (m: Partial<MixerState> = {}): MixerState => ({ ...defaultMixer(), mixerOn: true, ampOn: true, ...m })
const ch1 = (m: MixerState, c: Partial<MixerState['ch1']>): MixerState => ({ ...m, ch1: { ...m.ch1, ...c } })

describe('patching', () => {
  it('orients cables from OUT to IN and refuses impossible plugs', () => {
    expect(orientCable('mixer.ch1', 'micDyn.out')).toEqual({ ok: true, from: 'micDyn.out', to: 'mixer.ch1' })
    expect(orientCable('micDyn.out', 'mixer.mainL').ok).toBe(false) // out → out
    expect(orientCable('amp.outA', 'mixer.ch1').ok).toBe(false) // speakon vs XLR
    expect(orientCable('console.out', 'mixer.ch1').ok).toBe(true) // DMX fits an XLR socket…
    const r = analyzePatch([{ id: 'x', from: 'console.out', to: 'mixer.ch1' }])
    expect(r.issues.some((i) => i.code === 'dmx-audio-mix')).toBe(true) // …but is flagged
  })
  it('follows the DMX daisy chain and detects the terminator', () => {
    const r = analyzePatch(DMX_CABLES)
    expect(r.dmxChain).toEqual(['par1', 'par2', 'par3', 'par4', 'mover1', 'mover2'])
    expect(r.dmxTerminated).toBe(true)
    const noTerm = analyzePatch(DMX_CABLES.slice(0, -1))
    expect(noTerm.dmxTerminated).toBe(false)
    expect(noTerm.issues.some((i) => i.code === 'dmx-no-term')).toBe(true)
    const broken = analyzePatch(DMX_CABLES.filter((c) => c.id !== 'd3'))
    expect(broken.dmxReceiving.par4).toBe(false)
    expect(broken.issues.some((i) => i.code === 'dmx-missing')).toBe(true)
  })
  it('flags a mic plugged straight into the amplifier', () => {
    const r = analyzePatch([{ id: 'x', from: 'micDyn.out', to: 'amp.inA' }])
    expect(r.issues.some((i) => i.code === 'mic-to-line')).toBe(true)
  })
  it('computes parallel speaker impedance and amp protection', () => {
    const two: Cable[] = [
      { id: '1', from: 'amp.outA', to: 'spkL.in' },
      { id: '2', from: 'spkL.link', to: 'spkR.in' },
    ]
    expect(analyzePatch(two).impedance.A).toBe(4)
    expect(analyzePatch(two).issues.some((i) => i.code === 'amp-low-impedance')).toBe(false)
    expect(analyzePatch(AUDIO_CABLES).impedance).toEqual({ A: 8, B: 8 })
  })
})

describe('DMX', () => {
  it('a fixture reads the channels at its own address', () => {
    const v = defaultConsole()
    v.par2 = [255, 255, 255, 0] // console sends yellow to channels 5–8
    const u = buildUniverse(v)
    expect(u.slice(4, 8)).toEqual([255, 255, 255, 0])
    const right = fixtureOutput('par2', 5, u, true, true)
    expect(colorName(right.r, right.g, right.b)).toBe('yellow')
    const wrong = fixtureOutput('par2', 1, u, true, true) // factory address 1 → reads PAR1's channels
    expect(wrong.intensity).toBe(0)
  })
  it('additive colour mixing names', () => {
    expect(colorName(1, 0, 1)).toBe('magenta')
    expect(colorName(0, 1, 1)).toBe('cyan')
    expect(colorName(1, 1, 1)).toBe('white')
    expect(colorName(0.02, 0, 0)).toBe('black')
  })
  it('address checks: factory defaults overlap and mismatch, the console patch is clean', () => {
    const bad = checkAddresses(defaultAddresses())
    expect(bad.some((i) => i.code === 'addr-overlap')).toBe(true)
    expect(bad.some((i) => i.code === 'addr-mismatch')).toBe(true)
    expect(checkAddresses({ ...CONSOLE_PATCH })).toEqual([expect.objectContaining({ code: 'addr-ok' })])
    expect(checkAddresses({ ...CONSOLE_PATCH, mover2: 510 }).some((i) => i.code === 'addr-range')).toBe(true)
  })
  it('aiming a mover at the singer makes the beam land on the singer', () => {
    const a = aimValues(FIXTURE_POS.mover1, SINGER_SPOT)
    const dir = beamDirection(((a.pan - 128) / 128) * 90, (a.tilt / 255) * 90)
    const hit = beamHit(FIXTURE_POS.mover1, dir)!
    expect(Math.hypot(hit[0] - SINGER_SPOT[0], hit[2] - SINGER_SPOT[2])).toBeLessThan(0.3)
  })
})

describe('audio model', () => {
  const patch = analyzePatch(AUDIO_CABLES)
  const patchMon = analyzePatch([...AUDIO_CABLES, ...MONITOR_CABLES])
  it('inverse-square law, cardioid rejection and delay', () => {
    expect(distanceLoss(2) - distanceLoss(1)).toBeCloseTo(-6.02, 1)
    expect(cardioid(GEO.micAxis, GEO.mic, [0, 1.6, 0.2])).toBeCloseTo(0, 1) // on axis
    expect(cardioid(GEO.micAxis, GEO.mic, [0, 1.6, 2.2])).toBe(-25) // rear
    expect(delayMs(34.3)).toBeCloseTo(100, 0)
  })
  it('gain staging: a sensible gain keeps chorus peaks between −18 and −3 dBFS, too much clips', () => {
    const peak = Math.max(...Array.from({ length: 160 }, (_, i) => singerSpl(i / 10).spl))
    expect(peak).toBeCloseTo(107, 0)
    const good = computeLevels(ch1(on(), { gain: 44 }), patch, peak)
    expect(good.preDbfs!).toBeGreaterThan(TARGET.metroMin)
    expect(good.preDbfs!).toBeLessThan(TARGET.metroMax)
    expect(good.clipPre).toBe(false)
    expect(computeLevels(ch1(on(), { gain: 60 }), patch, peak).clipPre).toBe(true)
    // lowering the fader does not fix a clipping preamp
    expect(computeLevels(ch1(on(), { gain: 60, fader: -30 }), patch, peak).clipPre).toBe(true)
  })
  it('condenser mic needs phantom power; nothing is heard with the mixer or amp off', () => {
    const condPatch = analyzePatch([{ id: 'c', from: 'micCond.out', to: 'mixer.ch1' }, ...AUDIO_CABLES.slice(1)])
    expect(computeLevels(on({ micOnStand: 'micCond' }), condPatch, 100).signal).toBe(false)
    expect(computeLevels(ch1(on({ micOnStand: 'micCond' }), { phantom: true }), condPatch, 100).signal).toBe(true)
    expect(computeLevels(on({ mixerOn: false }), patch, 100).signal).toBe(false)
    expect(computeLevels(on({ ampOn: false }), patch, 100).paBoxes).toBe(0)
  })
  it('PA in front of the mic reaches the audience target without feedback; PA behind the singer howls', () => {
    const m = ch1(on({ master: 2 }), { gain: 44 })
    const front = computeLevels(m, patch, 107)
    expect(front.fohSpl!).toBeGreaterThanOrEqual(TARGET.fohSpl)
    expect(front.feedback).toBe(false)
    // behind the band: farther from the audience, so it needs even more level — and it howls
    const back = computeLevels({ ...m, paPos: 'back', master: 6 }, patch, 107)
    expect(back.fohSpl!).toBeGreaterThanOrEqual(TARGET.fohSpl)
    expect(back.feedback).toBe(true)
  })
  it('wedge aimed at the back of the cardioid mic is safe; a wedge behind the singer howls at a useful level', () => {
    const base = ch1(on({ master: 2 }), { gain: 44, mon: 0 })
    const front = computeLevels({ ...base, wedgePos: 'front' }, patchMon, 107)
    expect(front.monSpl!).toBeGreaterThanOrEqual(TARGET.monSpl)
    expect(front.feedback).toBe(false)
    const behind = computeLevels({ ...base, wedgePos: 'behind', ch1: { ...base.ch1, mon: -6 } }, patchMon, 107)
    expect(behind.monSpl!).toBeGreaterThanOrEqual(TARGET.monSpl)
    expect(behind.feedback).toBe(true)
  })
})

describe('show test', () => {
  const patch = analyzePatch([...DMX_CABLES, ...AUDIO_CABLES])
  const mixer = ch1(on({ master: 0 }), { gain: 44 })
  it('the reference cue list passes all checkpoints', () => {
    const r = runShowTest(SOLUTION_CUES(), SOLUTION_ADDRESSES(), patch, mixer)
    expect(r.checkpoints.filter((c) => !c.pass).flatMap((c) => c.checks.filter((x) => !x.ok).map((x) => x.th))).toEqual([])
    expect(r.score).toBe(4)
  })
  it('fails when fixtures keep factory addresses or the DMX line is broken', () => {
    // all PARs at address 1 mirror PAR1 (looks fine when they share a colour), but the
    // movers read PAR channels instead of pan/tilt/dimmer, so the spotlight never appears
    const factory = runShowTest(SOLUTION_CUES(), defaultAddresses(), patch, mixer)
    expect(factory.score).toBeLessThan(4)
    expect(factory.checkpoints[1].checks[0].ok).toBe(false)
    const noDmx = analyzePatch(AUDIO_CABLES)
    expect(runShowTest(SOLUTION_CUES(), SOLUTION_ADDRESSES(), noDmx, mixer).score).toBeLessThan(3)
  })
  it('rig output follows cue colours through DMX', () => {
    const rig = rigOutput({ ...defaultConsole(), par1: [255, 255, 0, 255] }, SOLUTION_ADDRESSES(), patch)
    expect(colorName(rig.par1.r, rig.par1.g, rig.par1.b)).toBe('magenta')
  })
})
