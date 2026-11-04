import { useEffect } from 'react'
import { setBuzzer } from '../services/sound'
import { sim, useLab } from '../store/lab'

const STEP = 0.1 // simulation step (s)
const PUBLISH_MS = 100

/** Runs the simulation in fixed steps (scaled by the speed setting) independent of the 3D frame rate. */
export function useSimLoop(active: boolean) {
  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    let lastPub = 0
    const loop = (now: number) => {
      // allow up to 1 s per frame so slow/throttled devices keep the chosen sim speed
      const dtReal = Math.min(1, (now - last) / 1000)
      last = now
      const { paused, speed, publish } = useLab.getState()
      if (!paused) {
        acc += dtReal * speed
        let n = 0
        while (acc >= STEP && n < 60) {
          sim.step(STEP)
          acc -= STEP
          n++
        }
        if (n >= 60) acc = 0 // drop backlog instead of spiralling on very slow frames
      }
      if (now - lastPub > PUBLISH_MS) {
        lastPub = now
        publish()
        setBuzzer(!paused && sim.actuators.buzzer)
      }
      raf = requestAnimationFrame(loop)
    }
    // requestAnimationFrame pauses in hidden tabs, so the simulation pauses with it
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      setBuzzer(false)
    }
  }, [active])
}
