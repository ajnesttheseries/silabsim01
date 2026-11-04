/** World layout of the concert stage (metres; shares geometry with the audio/lighting engine). */
import { GEO, type MixerState, type V3 } from '../engine/audio'
import { PORTS, type DeviceId } from '../engine/patch'
import { FIXTURE_POS } from '../engine/show'

export const FAMILY_HEX = { xlr: '#38bdf8', speakon: '#fb923c', dmx: '#c084fc' } as const
export const STAGE = { x0: -7, x1: 7, z0: -3.6, z1: 3.2, h: 1 }
export const TRUSS_Y = 6.25
export const FOH: V3 = [0, 0, 13]
export const AMP_RACK: V3 = [7.7, 0, 1.6]
export const TERM_BOX: V3 = [6.6, STAGE.h, -2.6]
export const COND_TABLE: V3 = [-5.6, STAGE.h, 1.4]
export const MIXER_POS: V3 = [-0.7, 0.95, 13]
export const CONSOLE_POS: V3 = [0.9, 0.95, 13]
export const LED_WALL = { pos: [0, 3.6, -3.35] as V3, w: 9, h: 4 }

/** Where each microphone currently is (the stand one is in front of the singer). */
export function micPos(id: 'micDyn' | 'micCond', m: Pick<MixerState, 'micOnStand'>): V3 {
  return m.micOnStand === id ? GEO.mic : id === 'micCond' ? [COND_TABLE[0], COND_TABLE[1] + 0.55, COND_TABLE[2]] : [COND_TABLE[0] + 0.5, COND_TABLE[1] + 0.55, COND_TABLE[2]]
}

export function devicePos(id: DeviceId, m: Pick<MixerState, 'micOnStand' | 'paPos' | 'wedgePos'>): V3 {
  switch (id) {
    case 'micDyn':
    case 'micCond':
      return micPos(id, m)
    case 'spkL':
      return GEO.pa[m.paPos].L
    case 'spkR':
      return GEO.pa[m.paPos].R
    case 'wedge':
      return GEO.wedge[m.wedgePos].pos
    case 'mixer':
      return MIXER_POS
    case 'console':
      return CONSOLE_POS
    case 'amp':
      return [AMP_RACK[0], 0.9, AMP_RACK[2]]
    case 'term':
      return TERM_BOX
    default:
      return FIXTURE_POS[id]
  }
}

/** Connector position (world) for a port, given the current placement of movable gear. */
export function portPos(portId: string, m: Pick<MixerState, 'micOnStand' | 'paPos' | 'wedgePos'>): V3 {
  const p = PORTS[portId]
  const base = devicePos(p.device, m)
  const key = portId.split('.')[1]
  const off = (x: number, y: number, z: number): V3 => [base[0] + x, base[1] + y, base[2] + z]
  switch (p.device) {
    case 'micDyn':
    case 'micCond':
      return m.micOnStand === p.device ? [GEO.mic[0] + 0.12, STAGE.h + 0.08, GEO.mic[2] + 0.12] : off(0, -0.5, 0.15)
    case 'mixer': {
      const order = ['ch1', 'ch2', 'mainL', 'mainR', 'mon']
      return off(-0.5 + order.indexOf(key) * 0.25, 0.08, -0.32)
    }
    case 'console':
      return off(0, 0.08, -0.3)
    case 'amp': {
      const order = ['inA', 'inB', 'outA', 'outB']
      return [AMP_RACK[0] - 0.33, 0.55 + (order.indexOf(key) % 2) * 0.2, AMP_RACK[2] - 0.2 + Math.floor(order.indexOf(key) / 2) * 0.4]
    }
    case 'spkL':
    case 'spkR':
      return off(key === 'in' ? -0.15 : 0.15, -0.55, -0.38)
    case 'wedge':
      return off(0, 0.05, m.wedgePos === 'front' ? 0.35 : -0.35)
    case 'term':
      return off(0, 0.15, 0)
    default:
      // fixtures on the truss: IN on the left, THRU on the right
      return off(key === 'in' ? -0.22 : 0.22, 0.28, 0.2)
  }
}

export type AvCameraPreset = 'overview' | 'truss' | 'stage' | 'foh' | 'rack'
export const AV_CAMERAS: Record<AvCameraPreset, { pos: V3; target: V3; th: string }> = {
  overview: { pos: [0, 8.5, 24], target: [0, 2.6, 2], th: 'ภาพรวม' },
  truss: { pos: [0, 5.2, 9.5], target: [0, 5.6, 0.4], th: 'ไฟบนทรัส' },
  stage: { pos: [3.6, 3.4, 8.6], target: [0, 1.7, 1], th: 'เวที' },
  foh: { pos: [0, 3.0, 17.2], target: [0, 0.9, 13], th: 'โต๊ะ FOH' },
  rack: { pos: [4.6, 2.6, 5.2], target: [7.4, 0.9, 1.6], th: 'แร็คแอมป์' },
}
