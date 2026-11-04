/** Reference patches for hints, guided mode and tests. */
import { CONSOLE_PATCH } from './dmx'
import type { Cable } from './patch'

const c = (id: string, from: string, to: string): Cable => ({ id, from, to })

export const DMX_CABLES: Cable[] = [
  c('d1', 'console.out', 'par1.in'),
  c('d2', 'par1.thru', 'par2.in'),
  c('d3', 'par2.thru', 'par3.in'),
  c('d4', 'par3.thru', 'par4.in'),
  c('d5', 'par4.thru', 'mover1.in'),
  c('d6', 'mover1.thru', 'mover2.in'),
  c('d7', 'mover2.thru', 'term.in'),
]

export const AUDIO_CABLES: Cable[] = [
  c('a1', 'micDyn.out', 'mixer.ch1'),
  c('a2', 'mixer.mainL', 'amp.inA'),
  c('a3', 'mixer.mainR', 'amp.inB'),
  c('a4', 'amp.outA', 'spkL.in'),
  c('a5', 'amp.outB', 'spkR.in'),
]

export const MONITOR_CABLES: Cable[] = [c('m1', 'mixer.mon', 'wedge.in')]

export const SOLUTION_ADDRESSES = (): Record<string, number> => ({ ...CONSOLE_PATCH })
