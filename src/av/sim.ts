import { useEffect } from 'react'
import { createRng } from '../engine/rng'
import { useLab } from '../store/lab'
import { computeLevels, singerSpl, TARGET } from './engine/audio'
import { cueAt, cueToConsole, NARRATION_SPL, rigOutput, SHOW_LENGTH, showSingerSpl } from './engine/show'
import { avSound } from './sound'
import { useAv } from './store'

const STEP = 0.05
const WINDOW = 8 // seconds an objective must hold

/** Runs the stage: singer/show timeline, mixer levels, meters, DMX output and sound. */
export function useAvSim(active: boolean) {
  useEffect(() => {
    if (!active) return
    const rng = createRng(7)
    let raf = 0
    let last = performance.now()
    let acc = 0
    let lastPub = 0
    let meter = -60
    let fb = 0
    let t = useAv.getState().live.t
    let showT = useAv.getState().live.showT
    let wasShow = false
    let samples: Array<{ t: number; pre: number | null; clip: boolean; foh: number | null; mon: number | null; feedback: boolean }> = []

    const loop = (now: number) => {
      const dt = Math.min(1, (now - last) / 1000)
      last = now
      acc += dt
      const s = useAv.getState()
      let live = s.live
      if (live.showPlaying && !wasShow) showT = live.showT // a new show run starts from the store's time (0)
      wasShow = live.showPlaying
      while (acc >= STEP) {
        acc -= STEP
        if (live.rehearsing) t += STEP
        if (live.showPlaying) {
          showT += STEP
          if (showT >= SHOW_LENGTH) {
            showT = SHOW_LENGTH
            live = { ...live, showPlaying: false }
            useAv.setState({ live })
          }
        }
      }
      const show = live.showPlaying
      // interactive exhibit demo: the motion sensor picks the scene
      const exhibit = !show && !live.rehearsing && s.exhibitDemo && s.progress.challenge === 'exhibit'
      const cue = show ? cueAt(s.cues, showT) : exhibit ? s.scenes[s.visitor ? 'visitor' : 'idle'] : null
      const spl = live.rehearsing ? singerSpl(t).spl : show ? showSingerSpl(showT) : exhibit && s.visitor ? NARRATION_SPL : null
      const standCh = s.patch.micChannel[s.mixer.micOnStand]
      const mixer = cue && standCh ? { ...s.mixer, [standCh]: { ...s.mixer[standCh], mute: cue.mic === 'mute' } } : s.mixer
      const levels = computeLevels(mixer, s.patch, spl)
      const values = cue ? cueToConsole(cue, showT) : s.console
      const rig = rigOutput(values, s.addresses, s.patch, rng.next())
      meter = Math.max(levels.preDbfs ?? -60, meter - 25 * dt)
      fb = levels.feedback ? Math.min(1, fb + dt * 1.2) : Math.max(0, fb - dt * 3)

      // objective windows (rehearsal only)
      if (live.rehearsing) {
        samples.push({ t, pre: levels.preDbfs, clip: levels.clipPre || levels.clipMain, foh: levels.fohSpl, mon: levels.monSpl, feedback: levels.feedback })
        samples = samples.filter((x) => x.t > t - WINDOW)
        if (samples.length && samples[0].t <= t - WINDOW + 0.2) {
          const pres = samples.map((x) => x.pre ?? -99)
          const gainOk = !samples.some((x) => x.clip) && Math.max(...pres) <= TARGET.metroMax && Math.max(...pres) >= TARGET.metroMin
          const loudOk =
            !samples.some((x) => x.feedback || x.clip) && Math.max(...samples.map((x) => x.foh ?? 0)) >= TARGET.fohSpl && Math.max(...samples.map((x) => x.mon ?? 0)) >= TARGET.monSpl
          const p = s.progress
          if ((gainOk && !p.gainOk) || (loudOk && !p.loudOk)) s.setStats({ gainOk: p.gainOk || gainOk, loudOk: p.loudOk || loudOk })
        }
      } else samples = []

      if (now - lastPub > 100) {
        lastPub = now
        s.publish({ ...live, t, showT, levels, rig, meter })
        avSound.setEnabled(useLab.getState().soundOn)
        avSound.update({ band: live.rehearsing || show, voice: levels.mainDbfs == null ? null : spl, foh: levels.fohSpl, clip: levels.clipPre || levels.clipMain, feedback: levels.feedback ? fb : 0 })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      avSound.stop()
    }
  }, [active])
}
