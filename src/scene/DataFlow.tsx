/** Animated "data path": environment → sensor → signal pin → board → monitor. */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { footprint } from '../engine/circuit/catalog'
import { useLab } from '../store/lab'
import { boardPinPos, CHIP_POS, holePos, modulePinPos, SPOTS, type V3 } from './layout'

interface FlowPath {
  key: string
  color: string
  points: V3[]
}

const MONITOR_SCREEN: V3 = [SPOTS.monitor.pos[0], 1.6, SPOTS.monitor.pos[2] + 0.2]
const LAMP_HEAD: V3 = [-0.2, 3.0, -0.3]
const HEATER: V3 = [SPOTS.heater.pos[0] - 0.4, 1.0, SPOTS.heater.pos[2] + 0.5]

function Particles({ path }: { path: FlowPath }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(path.points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.3), [path])
  const ref = useRef<THREE.Group>(null)
  const line = useMemo(() => new THREE.TubeGeometry(curve, 80, 0.008, 4, false), [curve])
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 0.22 + i / 6) % 1
      c.position.copy(curve.getPointAt(t))
    })
  })
  return (
    <group>
      <mesh geometry={line} raycast={() => null}>
        <meshBasicMaterial color={path.color} transparent opacity={0.25} toneMapped={false} />
      </mesh>
      <group ref={ref}>
        {[...Array(6)].map((_, i) => (
          <mesh key={i} raycast={() => null}>
            <sphereGeometry args={[0.05, 10, 8]} />
            <meshBasicMaterial color={path.color} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function DataFlow() {
  const enabled = useLab((s) => s.dataFlow)
  const powered = useLab((s) => s.simView.powered)
  const report = useLab((s) => s.report)
  const comps = useLab((s) => s.circuit.components)

  const paths = useMemo(() => {
    const out: FlowPath[] = []
    const lift = (p: V3, h: number): V3 => [p[0], p[1] + h, p[2]]
    for (const c of comps) {
      const m = report.modules[c.id]
      if (c.type === 'dht' && m?.ok && m.gpio) {
        const fp = footprint(c)
        const s = fp ? holePos(fp.DATA)! : undefined
        if (s) out.push({ key: c.id, color: '#fb923c', points: [HEATER, lift(s, 0.9), lift(s, 0.45), lift(boardPinPos(`GPIO${m.gpio.gpio}`)!, 0.3), CHIP_POS, lift(CHIP_POS, 1.2), MONITOR_SCREEN] })
      }
      if (c.type === 'soil' && m?.ok && m.gpio) {
        const s = modulePinPos('soil', 'AOUT')!
        out.push({ key: c.id, color: '#4ade80', points: [[SPOTS.plant.pos[0], 0.85, SPOTS.plant.pos[2]], lift(s, 0.1), lift(s, 0.6), lift(boardPinPos(`GPIO${m.gpio.gpio}`)!, 0.4), CHIP_POS, lift(CHIP_POS, 1.2), MONITOR_SCREEN] })
      }
      if (c.type === 'pir' && m?.ok && m.gpio) {
        const s = modulePinPos('pir', 'OUT')!
        out.push({ key: c.id, color: '#c084fc', points: [[SPOTS.pir.pos[0] + 0.6, 1.3, SPOTS.pir.pos[2] + 1.0], lift(s, 0.1), lift(s, 0.6), lift(boardPinPos(`GPIO${m.gpio.gpio}`)!, 0.4), CHIP_POS, lift(CHIP_POS, 1.2), MONITOR_SCREEN] })
      }
    }
    for (const d of report.ldrs) {
      if (d.status !== 'ok' || !d.gpio) continue
      const c = comps.find((x) => x.id === d.compId)
      const fp = c && footprint(c)
      if (!fp) continue
      const s = holePos(fp['1'])!
      out.push({ key: d.compId, color: '#fde047', points: [LAMP_HEAD, lift(s, 0.8), lift(s, 0.3), lift(boardPinPos(`GPIO${d.gpio.gpio}`)!, 0.3), CHIP_POS, lift(CHIP_POS, 1.2), MONITOR_SCREEN] })
    }
    return out
  }, [comps, report])

  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!enabled || !powered || reduce) return null
  return (
    <group>
      {paths.map((p) => (
        <Particles key={p.key} path={p} />
      ))}
    </group>
  )
}
