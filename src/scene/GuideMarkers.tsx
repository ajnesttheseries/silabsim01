/** 3D pointers for guided mode: arrows over the next target, ghost part and ghost wire. */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { footprint } from '../engine/circuit/catalog'
import { useLab } from '../store/lab'
import { useGuideView } from '../ui/guide'
import { prefersReducedMotion } from './interact'
import { holePos, nodePos, USB_PORT, type V3 } from './layout'
import { WIRE_HEX, wireCurve } from './models/boards'
import { OnBoardPart } from './PlacedParts'

export function Beacon({ pos, color = '#facc15', scale = 1 }: { pos: V3; color?: string; scale?: number }) {
  const arrow = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const still = useMemo(prefersReducedMotion, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (arrow.current && !still) arrow.current.position.y = 0.42 * scale + Math.sin(t * 5) * 0.06 * scale
    if (ring.current) {
      const k = still ? 0.5 : (t * 1.2) % 1
      ring.current.scale.setScalar(0.6 + k * 1.4)
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k)
    }
  })
  return (
    <group position={pos}>
      <group ref={arrow} position={[0, 0.42 * scale, 0]}>
        <mesh rotation={[Math.PI, 0, 0]} raycast={() => null}>
          <coneGeometry args={[0.07 * scale, 0.16 * scale, 16]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.14 * scale, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.022 * scale, 0.022 * scale, 0.16 * scale, 8]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} raycast={() => null}>
        <ringGeometry args={[0.06, 0.085, 24]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

function GhostWire({ a, b, color }: { a: V3; b: V3; color: string }) {
  const key = `${a.join(',')}|${b.join(',')}`
  const geo = useMemo(() => new THREE.TubeGeometry(wireCurve(a, b), 40, 0.016, 5, false), [key])
  useEffect(() => () => geo.dispose(), [geo])
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = 0.25 + 0.2 * Math.sin(clock.elapsedTime * 4)
  })
  return (
    <mesh geometry={geo} raycast={() => null}>
      <meshBasicMaterial ref={mat} color={color} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export function GuideMarkers() {
  const g = useGuideView((s) => s.g)
  const comps = useLab((s) => s.circuit.components)
  const wireStart = useLab((s) => s.wireStart)
  const step = g?.current
  if (!step) return null

  if (step.kind === 'usb') return <Beacon pos={[USB_PORT[0], USB_PORT[1] + 0.1, USB_PORT[2]]} scale={1.6} />

  if (step.kind === 'place' && step.comp) {
    const fp = footprint(step.comp)
    const first = fp && holePos(Object.values(fp)[0])
    return (
      <group>
        <OnBoardPart comp={{ ...step.comp, id: 'guide-ghost' }} look={{ ghost: 'ok' }} />
        {fp && Object.values(fp).map((h) => <Beacon key={h} pos={holePos(h)!} scale={0.8} color="#34d399" />)}
        {!fp && first && <Beacon pos={first} />}
      </group>
    )
  }

  if (step.kind === 'wire' && step.wire && g.wireNodes) {
    const [na, nb] = g.wireNodes
    const a = nodePos(na, comps)
    const b = nodePos(nb, comps)
    if (!a || !b) return null
    // once the student has started a wire on one end, point only at the other end
    const showA = wireStart !== na
    const showB = wireStart !== nb
    return (
      <group>
        <GhostWire a={a} b={b} color={WIRE_HEX[step.wire.color]} />
        {showA && <Beacon pos={a} />}
        {showB && <Beacon pos={b} />}
      </group>
    )
  }
  return null
}
