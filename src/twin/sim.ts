import { useEffect } from 'react'
import { initTruth, stepTruth, type Fault, type Truth } from './engine/signals'
import { alertsOf, TruthHistory, twinReading } from './engine/twin'
import { useTwin } from './store'

const STEP = 0.05

/** Live simulation state shared with the 3D scene, which animates every frame. */
export const simRef: { history: TruthHistory; truth: Truth; t: number } = {
  history: new TruthHistory(STEP),
  truth: initTruth(),
  t: 0,
}

/** Runs the physical robot, the data link and the twin; publishes ~10×/s. */
export function useTwinSim(active: boolean) {
  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    let lastPub = 0
    let epoch = useTwin.getState().robotEpoch
    let fault: Fault = useTwin.getState().liveFault
    let stopped = false
    const restart = () => {
      simRef.history = new TruthHistory(STEP)
      simRef.truth = initTruth()
      simRef.history.push(simRef.truth)
      stopped = false
    }
    restart()

    const loop = (now: number) => {
      const dt = Math.min(1, (now - last) / 1000)
      last = now
      acc += dt
      const s = useTwin.getState()
      if (s.robotEpoch !== epoch) {
        epoch = s.robotEpoch
        fault = 'none'
        restart()
      }
      if (s.liveFault !== fault) {
        fault = s.liveFault
        const t = simRef.truth
        simRef.truth = { ...t, fault, faultAt: fault === 'none' ? null : t.t, soc: fault === 'lowbatt' ? Math.min(t.soc, 26) : t.soc }
        stopped = false
      }
      let steps = 0
      while (acc >= STEP && steps < 60) {
        acc -= STEP
        steps++
        simRef.truth = stepTruth(simRef.truth, STEP, { hold: s.hold, stopped })
        simRef.history.push(simRef.truth)
      }
      simRef.t = simRef.truth.t + Math.min(acc, STEP)
      if (now - lastPub > 100) {
        lastPub = now
        const cfg = { mounts: s.mounts, rates: s.rates, encoderOffset: s.encoderOffset, tempCal: s.tempCal }
        const { reading, latency } = twinReading(simRef.history, simRef.truth.t, cfg)
        // alert rules are part of mission 5; before that an uncalibrated reading is just "implausible", not an alarm
        const alerts = s.progress.current >= 5 ? alertsOf(reading, s.rules) : []
        if (alerts.length && !stopped) stopped = true // safe stop
        s.publish({ truth: simRef.truth, reading, latency, alerts, stopped })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])
}
