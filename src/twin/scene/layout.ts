/** World layout of the Digital Twin lab (metres). */
import type { DeviceId, SensorId, SlotId } from '../engine/robot'
import type { TwinCamera } from '../store'

export type V3 = [number, number, number]

/** feet of the physical robot */
export const ROBOT_POS: V3 = [-2.1, 0.12, 0]
/** centre of the hologram table top */
export const HOLO_POS: V3 = [2.1, 0.78, 0]
export const HOLO_SCALE = 0.62
export const TRAY_POS: V3 = [-0.1, 0.84, 1.7]
export const GATEWAY_POS: V3 = [0.95, 0.84, 1.7]
export const DASH_POS: V3 = [0, 2.35, -2.6]
export const DASH_SIZE = { w: 3.6, h: 1.7 }

/** sensor fitting points on the robot, relative to its feet (robot faces +z; its right side is −x) */
export const SLOT_LOCAL: Record<SlotId, V3> = {
  head: [0, 1.63, 0.15],
  shoulderR: [-0.29, 1.37, 0.1],
  hip: [0, 0.86, 0.14],
  kneeR: [-0.11, 0.48, 0.1],
  battery: [0, 1.03, 0.15],
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const slotPos = (s: SlotId): V3 => add(ROBOT_POS, SLOT_LOCAL[s])

export const SENSOR_HEX: Record<SensorId, string> = { temp: '#f97316', vib: '#a855f7', angle: '#22d3ee', power: '#facc15' }
export const SENSOR_ORDER: SensorId[] = ['temp', 'vib', 'angle', 'power']
export const traySensorPos = (s: SensorId): V3 => [TRAY_POS[0] - 0.48 + SENSOR_ORDER.indexOf(s) * 0.32, TRAY_POS[1] + 0.06, TRAY_POS[2]]

export function devicePos(d: DeviceId): V3 {
  switch (d) {
    case 'gateway':
      return [GATEWAY_POS[0], GATEWAY_POS[1] + 0.12, GATEWAY_POS[2]]
    case 'twin':
      return [HOLO_POS[0], HOLO_POS[1] + 1.1, HOLO_POS[2]]
    case 'dashboard':
      return [DASH_POS[0], DASH_POS[1] + DASH_SIZE.h / 2, DASH_POS[2] + 0.1]
    default:
      return slotPos(d)
  }
}

export const TWIN_CAMERAS: Record<TwinCamera, { pos: V3; target: V3; th: string }> = {
  overview: { pos: [0, 2.6, 6.4], target: [0, 1.05, 0.2], th: 'ภาพรวม' },
  // robot framed upper-left, so the floating guide card (bottom centre) does not cover its knees
  robot: { pos: [-3.2, 1.05, 3.3], target: [-1.85, 0.6, 0], th: 'หุ่นจริง' },
  twin: { pos: [3.05, 1.75, 2.3], target: [2.1, 1.15, 0], th: 'แฝดดิจิทัล' },
  tray: { pos: [0.35, 2.05, 3.9], target: [0.3, 0.75, 1.6], th: 'ถาดเซนเซอร์' },
}
