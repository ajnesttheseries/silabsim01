/** Procedural low-poly models of the breadboard parts. Positions are world space (pins from layout). */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RESISTOR_BANDS, type LedColor, type ResistorValue } from '../../engine/circuit/catalog'
import type { LedState } from '../../engine/firmware'
import type { V3 } from '../layout'
import { grilleTexture, ldrTexture } from '../textures'

export interface PartLook {
  ghost?: 'ok' | 'bad'
  highlight?: boolean
  selected?: boolean
}

const BAND_HEX: Record<string, string> = { black: '#111111', brown: '#7c3f12', red: '#d01818', orange: '#f07c00', gold: '#d4a017' }
export const LED_HEX: Record<LedColor, string> = { red: '#ff2a2a', green: '#22ff66', blue: '#3a7bff' }

export function GhostMat({ look, color, ...rest }: { look: PartLook; color: string } & Partial<THREE.MeshStandardMaterialParameters>) {
  if (look.ghost)
    return <meshStandardMaterial color={look.ghost === 'ok' ? '#34d399' : '#f87171'} transparent opacity={0.55} depthWrite={false} />
  return (
    <meshStandardMaterial
      color={color}
      emissive={look.highlight ? '#ff3b3b' : look.selected ? '#22d3ee' : '#000000'}
      emissiveIntensity={look.highlight ? 0.8 : look.selected ? 0.45 : 0}
      {...rest}
    />
  )
}

/** A lead from a hole up to a point above it, then across to the body. */
export function Lead({ from, to, r = 0.012, color = '#c9ced6' }: { from: V3; to: V3; r?: number; color?: string }) {
  const geo = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const mid = new THREE.Vector3(a.x, b.y, a.z)
    const path = new THREE.CurvePath<THREE.Vector3>()
    path.add(new THREE.LineCurve3(a, mid))
    path.add(new THREE.LineCurve3(mid, b))
    return new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, 8, r, 5, false)
  }, [from, to, r])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} metalness={0.8} roughness={0.3} />
    </mesh>
  )
}

const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
const up = (p: V3, h: number): V3 => [p[0], p[1] + h, p[2]]

export function LedModel({ pins, color, state, look }: { pins: { A: V3; K: V3 }; color: LedColor; state?: LedState; look: PartLook }) {
  const body = up(mid(pins.A, pins.K), 0.36)
  const domeMat = useRef<THREE.MeshStandardMaterial>(null)
  const smoke = useRef<THREE.Group>(null)
  const halo = useRef<THREE.Mesh>(null)
  const hex = LED_HEX[color]
  useFrame(({ clock }) => {
    const m = domeMat.current
    if (!m || look.ghost) return
    const on = state?.on && !state.burnt
    let k = on ? 0.6 + 2.4 * Math.min(1.3, state!.brightness) : 0
    if (state?.overcurrent) k = 5 + Math.sin(clock.elapsedTime * 40) * 2.5
    m.emissiveIntensity = k
    // additive halo keeps a lit LED readable even when bloom is off (low quality)
    if (halo.current) {
      halo.current.visible = !!on
      const b = state?.overcurrent ? 1.6 : Math.min(1.2, state?.brightness ?? 0)
      halo.current.scale.setScalar(0.14 + 0.16 * b)
      ;(halo.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.35 * Math.min(1, b)
    }
    m.color.set(state?.burnt ? '#3a3030' : hex)
    if (smoke.current) {
      smoke.current.visible = !!state?.burnt
      smoke.current.children.forEach((c, i) => {
        const t = (clock.elapsedTime * 0.5 + i / 3) % 1
        c.position.set(Math.sin(t * 6 + i) * 0.04, 0.12 + t * 0.5, 0)
        c.scale.setScalar(0.04 + t * 0.08)
        ;((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - t)
      })
    }
  })
  return (
    <group>
      <Lead from={pins.A} to={up(body, -0.11)} />
      <Lead from={pins.K} to={up(body, -0.11)} />
      {/* anode is the longer leg: small kink marker */}
      <mesh position={up(pins.A, 0.17)}>
        <boxGeometry args={[0.03, 0.03, 0.03]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.8} />
      </mesh>
      <group position={body}>
        <mesh position={[0, -0.06, 0]}>
          <cylinderGeometry args={[0.105, 0.115, 0.03, 18]} />
          <GhostMat look={look} color={hex} transparent opacity={0.9} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.095, 0.095, 0.13, 18]} />
          {look.ghost ? <GhostMat look={look} color={hex} /> : <meshStandardMaterial ref={domeMat} color={hex} emissive={hex} emissiveIntensity={0} transparent opacity={0.88} roughness={0.15} toneMapped={false} />}
        </mesh>
        <mesh position={[0, 0.065, 0]}>
          <sphereGeometry args={[0.095, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          {look.ghost ? <GhostMat look={look} color={hex} /> : <meshStandardMaterial color={hex} emissive={hex} emissiveIntensity={state?.on && !state.burnt ? 1.5 + 2 * state.brightness : 0} transparent opacity={0.85} roughness={0.1} toneMapped={false} />}
        </mesh>
        {(look.highlight || look.selected) && !look.ghost && <SelectRing r={0.16} color={look.highlight ? '#ff4d4d' : '#22d3ee'} />}
        {!look.ghost && (
          <mesh ref={halo} position={[0, 0.04, 0]} visible={false} raycast={() => null}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshBasicMaterial color={hex} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        )}
        <group ref={smoke} visible={false}>
          {[0, 1, 2].map((i) => (
            <mesh key={i}>
              <sphereGeometry args={[1, 8, 6]} />
              <meshBasicMaterial color="#9ca3af" transparent opacity={0.3} depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

export function SelectRing({ r, color }: { r: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 5) * 0.08)
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
      <ringGeometry args={[r, r + 0.03, 32]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.9} />
    </mesh>
  )
}

export function ResistorModel({ pins, value, look }: { pins: { '1': V3; '2': V3 }; value: ResistorValue; look: PartLook }) {
  const a = pins['1']
  const b = pins['2']
  const c = up(mid(a, b), 0.14)
  const len = Math.hypot(b[0] - a[0], b[2] - a[2])
  const angle = Math.atan2(b[2] - a[2], b[0] - a[0])
  const bands = RESISTOR_BANDS[value]
  const bodyLen = Math.min(0.34, len * 0.66)
  return (
    <group>
      <Lead from={a} to={[c[0] - (Math.cos(angle) * bodyLen) / 2, c[1], c[2] - (Math.sin(angle) * bodyLen) / 2]} />
      <Lead from={b} to={[c[0] + (Math.cos(angle) * bodyLen) / 2, c[1], c[2] + (Math.sin(angle) * bodyLen) / 2]} />
      <group position={c} rotation={[0, -angle, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.055, bodyLen - 0.1, 6, 14]} />
          <GhostMat look={look} color="#d8c49a" roughness={0.6} />
        </mesh>
        {!look.ghost &&
          bands.map((col, i) => (
            <mesh key={i} position={[-bodyLen * 0.3 + i * bodyLen * (i === 3 ? 0.21 : 0.16), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.058, 0.058, 0.022, 14]} />
              <meshStandardMaterial color={BAND_HEX[col]} metalness={col === 'gold' ? 0.8 : 0} roughness={0.4} />
            </mesh>
          ))}
        {(look.highlight || look.selected) && !look.ghost && <SelectRing r={0.22} color={look.highlight ? '#ff4d4d' : '#22d3ee'} />}
      </group>
    </group>
  )
}

export function LdrModel({ pins, look }: { pins: { '1': V3; '2': V3 }; look: PartLook }) {
  const c = up(mid(pins['1'], pins['2']), 0.26)
  const tex = ldrTexture()
  return (
    <group>
      <Lead from={pins['1']} to={up(c, -0.02)} />
      <Lead from={pins['2']} to={up(c, -0.02)} />
      <group position={c}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.12, 0.05, 24]} />
          <GhostMat look={look} color="#d6c08a" />
        </mesh>
        {!look.ghost && (
          <mesh position={[0, 0.027, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.115, 24]} />
            <meshStandardMaterial map={tex} roughness={0.4} />
          </mesh>
        )}
        {(look.highlight || look.selected) && !look.ghost && <SelectRing r={0.18} color={look.highlight ? '#ff4d4d' : '#22d3ee'} />}
      </group>
    </group>
  )
}

export function DhtModel({ pins, look }: { pins: { VCC: V3; DATA: V3; GND: V3 }; look: PartLook }) {
  const c = up(pins.DATA, 0.42)
  const tex = grilleTexture()
  const ang = Math.atan2(pins.GND[2] - pins.VCC[2], pins.GND[0] - pins.VCC[0])
  return (
    <group>
      {(['VCC', 'DATA', 'GND'] as const).map((k) => (
        <Lead key={k} from={pins[k]} to={up(pins[k], 0.16)} color="#e2e8f0" />
      ))}
      <group position={c} rotation={[0, -ang, 0]}>
        <mesh position={[0, -0.24, 0]}>
          <boxGeometry args={[0.46, 0.06, 0.1]} />
          <GhostMat look={look} color="#1d4ed8" />
        </mesh>
        <mesh>
          <boxGeometry args={[0.4, 0.46, 0.15]} />
          <GhostMat look={look} color="#f1f5f9" roughness={0.5} />
        </mesh>
        {!look.ghost && (
          <mesh position={[0, 0, 0.077]}>
            <planeGeometry args={[0.38, 0.44]} />
            <meshStandardMaterial map={tex} />
          </mesh>
        )}
        {(look.highlight || look.selected) && !look.ghost && <SelectRing r={0.32} color={look.highlight ? '#ff4d4d' : '#22d3ee'} />}
      </group>
    </group>
  )
}

export function BuzzerModel({ pins, on, look }: { pins: { P: V3; N: V3 }; on?: boolean; look: PartLook }) {
  const c = up(mid(pins.P, pins.N), 0.2)
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = on ? Math.sin(clock.elapsedTime * 90) * 0.006 : 0
  })
  return (
    <group>
      <Lead from={pins.P} to={up(c, -0.08)} />
      <Lead from={pins.N} to={up(c, -0.08)} />
      <group position={c}>
        <group ref={ref}>
          <mesh>
            <cylinderGeometry args={[0.16, 0.16, 0.16, 24]} />
            <GhostMat look={look} color="#1f2937" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.081, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.02, 0.05, 16]} />
            <meshStandardMaterial color="#000" />
          </mesh>
          {!look.ghost && (
            <mesh position={[-0.1, 0.082, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.04, 0.012]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          )}
        </group>
        {on && <SoundRings />}
        {(look.highlight || look.selected) && !look.ghost && <SelectRing r={0.22} color={look.highlight ? '#ff4d4d' : '#22d3ee'} />}
      </group>
    </group>
  )
}

export function SoundRings() {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    g.current?.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 1.4 + i / 3) % 1
      c.scale.setScalar(0.2 + t * 0.5)
      ;((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t)
    })
  })
  return (
    <group ref={g} position={[0, 0.15, 0]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1, 32]} />
          <meshBasicMaterial color="#fbbf24" transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
