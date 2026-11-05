import { describe, expect, it } from 'vitest'
import { aliasHz, bearingBand, DEFAULT_RATES, DEFAULT_TEMP_CAL, encoderAngle, encoderErrorDeg, encoderOk, encoderRaw, ENC_ZERO_RAW, linkLoad, linkStatus, rateChecks, SOLUTION_RATES, TEMP_DATASHEET, tempCalOk, vibPeaks } from './daq'
import { twinGuide, twinGuideSteps, TWIN_MISSIONS, twinObjectives, type TwinCtx } from './missions'
import { emptyMounts, mountReport, SOLUTION_MOUNTS } from './robot'
import { initTruth, stepTruth, TEMP_DAMAGE } from './signals'
import { DEFAULT_RULES, runScenario, runTwinTest, SOLUTION_RULES, TEST_SCENARIOS, type TwinCfg } from './twin'

const solved = (p: Partial<TwinCfg> = {}): TwinCfg => ({ mounts: SOLUTION_MOUNTS(), rates: SOLUTION_RATES(), encoderOffset: ENC_ZERO_RAW, tempCal: { ...TEMP_DATASHEET }, ...p })

describe('sensor mounting', () => {
  it('builds a hologram part for each correctly placed sensor, the head when all four are live', () => {
    expect(mountReport(emptyMounts()).parts).toEqual([])
    const r = mountReport(SOLUTION_MOUNTS())
    expect(r.complete).toBe(true)
    expect(r.parts.sort()).toEqual(['arms', 'head', 'legs', 'pelvis', 'torso'])
  })
  it('explains why a sensor in the wrong place misleads the twin', () => {
    const r = mountReport({ ...SOLUTION_MOUNTS(), temp: 'head' })
    const t = r.sensors.find((s) => s.sensor === 'temp')!
    expect(t.state).toBe('wrong')
    expect(t.message).toContain('อุณหภูมิห้อง')
    expect(r.complete).toBe(false)
    expect(r.parts).not.toContain('legs')
  })
})

describe('sampling and the data link', () => {
  it('folds the 180 Hz bearing tone to a fake 20 Hz at 200 samples/s (Nyquist)', () => {
    expect(aliasHz(180, 200)).toBeCloseTo(20)
    expect(aliasHz(180, 500)).toBeCloseTo(180)
    expect(vibPeaks(100, 1).find((p) => p.trueHz === 180)!.aliased).toBe(true)
    expect(bearingBand(200, 1)).toBeNull()
    expect(bearingBand(500, 1)).toBeCloseTo(Math.SQRT1_2)
  })
  it('computes link load as rate × bytes × 8 and flags overload', () => {
    const m = SOLUTION_MOUNTS()
    expect(linkLoad(SOLUTION_RATES(), m)).toBeCloseTo(25.136, 2) // (1×2 + 500×6 + 50×2 + 10×4) × 8 / 1000
    expect(linkStatus(linkLoad(SOLUTION_RATES(), m)).level).toBe('ok')
    const over = linkStatus(linkLoad({ ...SOLUTION_RATES(), vib: 1000 }, m))
    expect(over.level).toBe('overload')
    expect(over.latency).toBeGreaterThan(1)
    expect(linkLoad(SOLUTION_RATES(), emptyMounts())).toBe(0) // unmounted sensors send nothing
  })
  it('default rates are too slow for vibration and arm motion', () => {
    const r = rateChecks(DEFAULT_RATES())
    expect(r.vib).toBe(false)
    expect(r.angle).toBe(false)
    expect(Object.values(rateChecks(SOLUTION_RATES())).every(Boolean)).toBe(true)
  })
})

describe('calibration', () => {
  it('zeroing the encoder at the ready pose removes the 45° offset', () => {
    expect(encoderErrorDeg(0)).toBeCloseTo(45)
    const rawAtZero = encoderRaw(0)
    expect(encoderOk(rawAtZero)).toBe(true)
    expect(encoderAngle(encoderRaw(60), rawAtZero)).toBeCloseTo(60, 0)
    // zeroing while the arm is raised to 50° leaves a 50° error
    expect(encoderErrorDeg(encoderRaw(50))).toBeCloseTo(50, 0)
  })
  it('the datasheet conversion matches the real temperature; the default does not', () => {
    expect(tempCalOk(TEMP_DATASHEET)).toBe(true)
    expect(tempCalOk(DEFAULT_TEMP_CAL())).toBe(false)
    expect(tempCalOk({ offsetMv: 500, mvPerC: 9 })).toBe(false)
  })
})

describe('physical robot', () => {
  it('an overheating knee passes the damage point if nobody stops the robot', () => {
    let s = initTruth({ temp: 38, fault: 'overheat', faultAt: 5 })
    for (let i = 0; i < 600; i++) s = stepTruth(s, 0.05, { hold: false, stopped: false })
    expect(s.temp).toBeGreaterThan(TEMP_DAMAGE)
    let n = initTruth()
    for (let i = 0; i < 1200; i++) n = stepTruth(n, 0.05, { hold: false, stopped: false })
    expect(n.temp).toBeLessThan(43)
    expect(n.soc).toBeGreaterThan(65)
  })
})

describe('challenge: twin monitoring test', () => {
  it('the reference setup passes all four scenarios', () => {
    const r = runTwinTest(solved(), SOLUTION_RULES())
    expect(r.checkpoints.filter((c) => !c.pass).map((c) => `${c.id}: ${c.note}`)).toEqual([])
    expect(r.score).toBe(4)
  })
  it('default thresholds never warn, so every fault is missed', () => {
    const r = runTwinTest(solved(), DEFAULT_RULES())
    expect(r.checkpoints[0].pass).toBe(true) // no false alarm on a normal day
    expect(r.score).toBe(1)
  })
  it('a threshold below normal operation raises a false alarm', () => {
    expect(runScenario(TEST_SCENARIOS[0], solved(), { ...SOLUTION_RULES(), tempMax: 38 }).pass).toBe(false)
  })
  it('data quality matters: slow vibration sampling, a misplaced sensor or no calibration break the test', () => {
    expect(runScenario(TEST_SCENARIOS[2], solved({ rates: { ...SOLUTION_RATES(), vib: 200 } }), SOLUTION_RULES()).pass).toBe(false)
    expect(runScenario(TEST_SCENARIOS[1], solved({ mounts: { ...SOLUTION_MOUNTS(), temp: 'head' } }), SOLUTION_RULES()).pass).toBe(false)
    expect(runTwinTest(solved({ tempCal: DEFAULT_TEMP_CAL() }), SOLUTION_RULES()).score).toBeLessThan(4)
  })
  it('a threshold too close to the damage point plus link delay is too late', () => {
    const late = runScenario(TEST_SCENARIOS[1], solved({ rates: { ...SOLUTION_RATES(), vib: 1000 } }), { ...SOLUTION_RULES(), tempMax: 84 })
    expect(late.pass).toBe(false)
  })
})

describe('missions and guide', () => {
  const ctx = (p: Partial<TwinCtx> = {}): TwinCtx => ({
    tutorial: { seenIntro: true },
    found: [],
    miniQuizCorrect: 0,
    mount: mountReport(emptyMounts()),
    picked: null,
    rates: DEFAULT_RATES(),
    link: linkStatus(0),
    hold: false,
    encoderOffset: 0,
    tempCal: DEFAULT_TEMP_CAL(),
    rules: DEFAULT_RULES(),
    testCheckpoints: [],
    testScore: null,
    finalDone: false,
    ...p,
  })
  it('mission 2 passes once all sensors are placed correctly', () => {
    expect(Object.values(twinObjectives(TWIN_MISSIONS[2], ctx())).some(Boolean)).toBe(false)
    expect(Object.values(twinObjectives(TWIN_MISSIONS[2], ctx({ mount: mountReport(SOLUTION_MOUNTS()) }))).every(Boolean)).toBe(true)
  })
  it('the guide walks the mount steps in order and warns about a misplaced sensor', () => {
    const g = twinGuide(2, ctx({ mount: mountReport({ ...emptyMounts(), temp: 'head' }) }))
    expect(g.current?.id).toBe('mount-temp')
    expect(g.note).toContain('อุณหภูมิห้อง')
    expect(twinGuide(2, ctx({ mount: mountReport(SOLUTION_MOUNTS()) })).current).toBeNull()
  })
  it('every mission has guided steps', () => {
    for (const m of TWIN_MISSIONS) expect(twinGuideSteps(m.id).length).toBeGreaterThan(0)
  })
})
