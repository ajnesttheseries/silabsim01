/** Off-board modules with wireable header pins, plus environment props. */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CATALOG, pinNode, type PlacedComponent } from '../../engine/circuit/catalog'
import { fmtClock } from '../../engine/firmware'
import { sim, useLab } from '../../store/lab'
import { prefersReducedMotion } from '../interact'
import { modulePinPos, SPOTS, type V3 } from '../layout'
import { canvasTexture, MONO, pinLabelTexture, pirTexture, FONT } from '../textures'
import { HeaderPin, PinTarget } from './boards'
import { SelectRing } from './parts'

function useSelectComp(id: string) {
  return (e: { delta: number; stopPropagation(): void }) => {
    if (e.delta > 8) return
    const st = useLab.getState()
    if (st.mode !== 'select' || st.placing) return
    e.stopPropagation()
    st.select({ kind: 'comp', id })
  }
}

function ModulePins({ comp }: { comp: PlacedComponent }) {
  const defs = CATALOG[comp.type].pinDefs ?? []
  return (
    <>
      {defs.map((p) => {
        const pos = modulePinPos(comp.type, p.id)
        if (!pos) return null
        return (
          <group key={p.id}>
            <HeaderPin pos={[pos[0], pos[1] - 0.03, pos[2]]} />
            <PinTarget node={pinNode(comp.id, p.id)} pos={pos} label={`${CATALOG[comp.type].nameTh}: ${p.label}`} size={0.08} />
          </group>
        )
      })}
    </>
  )
}

/* ---------- Load driver module ---------- */
export function DriverModule({ comp, look }: { comp: PlacedComponent; look: { highlight?: boolean; selected?: boolean } }) {
  const spot = SPOTS.driver
  const lbl = pinLabelTexture(['VCC', 'GND', 'IN'], '#991b1b')
  const lbl2 = pinLabelTexture(['OUT+', 'OUT−'], '#1e3a8a')
  const led = useRef<THREE.MeshStandardMaterial>(null)
  const onClick = useSelectComp(comp.id)
  useFrame(() => {
    const fan = sim.report.fans[0]
    const on = sim.powered && !!fan?.gpio && !!sim.gpioOut[fan.gpio.gpio!]
    if (led.current) led.current.emissiveIntensity = on ? 3.5 : 0
  })
  return (
    <group>
      <group position={spot.pos} rotation={[0, spot.rotY, 0]} onClick={onClick}>
        <mesh position={[0, 0.06, 0]} castShadow>
          <boxGeometry args={[1.0, 0.05, 0.95]} />
          <meshStandardMaterial color="#b91c1c" emissive={look.highlight ? '#ff3b3b' : look.selected ? '#22d3ee' : '#000'} emissiveIntensity={look.highlight || look.selected ? 0.5 : 0} />
        </mesh>
        <mesh position={[0, 0.14, 0]} castShadow>
          <boxGeometry args={[0.32, 0.12, 0.28]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        <mesh position={[0, 0.16, 0.34]} castShadow>
          <boxGeometry args={[0.6, 0.18, 0.22]} />
          <meshStandardMaterial color="#2563eb" />
        </mesh>
        <mesh position={[0, 0.089, -0.18]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.8, 0.2]} />
          <meshBasicMaterial map={lbl} />
        </mesh>
        <mesh position={[0, 0.252, 0.34]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.58, 0.14]} />
          <meshBasicMaterial map={lbl2} />
        </mesh>
        <mesh position={[0.36, 0.1, 0.05]}>
          <boxGeometry args={[0.06, 0.04, 0.06]} />
          <meshStandardMaterial ref={led} color="#22c55e" emissive="#22c55e" emissiveIntensity={0} toneMapped={false} />
        </mesh>
        {(look.highlight || look.selected) && (
          <group position={[0, 0.25, 0]}>
            <SelectRing r={0.65} color={look.highlight ? '#ff4d4d' : '#22d3ee'} />
          </group>
        )}
      </group>
      <ModulePins comp={comp} />
    </group>
  )
}

/* ---------- Spinning fan (used for the DC fan and the desk fan) ---------- */
function Blades({ speed, r }: { speed: () => number; r: number }) {
  const ref = useRef<THREE.Group>(null)
  const reduce = useMemo(prefersReducedMotion, [])
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z -= speed() * dt * (reduce ? 4 : 22)
  })
  return (
    <group ref={ref}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} rotation={[0, 0.35, (i / 5) * Math.PI * 2]} position={[0, 0, 0]}>
          <boxGeometry args={[r * 0.36, r * 0.92, 0.015]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.4} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r * 0.18, r * 0.18, 0.08, 16]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    </group>
  )
}

export function SmallFan({ comp, look }: { comp: PlacedComponent; look: { highlight?: boolean; selected?: boolean } }) {
  const spot = SPOTS.fan
  const onClick = useSelectComp(comp.id)
  return (
    <group>
      <group position={spot.pos} rotation={[0, spot.rotY, 0]} onClick={onClick}>
        <mesh position={[0, 0.05, 0.25]} castShadow>
          <boxGeometry args={[0.7, 0.1, 0.8]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <group position={[0, 0.48, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.78, 0.78, 0.18]} />
            <meshStandardMaterial color="#111827" emissive={look.highlight ? '#ff3b3b' : look.selected ? '#22d3ee' : '#000'} emissiveIntensity={look.highlight || look.selected ? 0.5 : 0} />
          </mesh>
          <mesh position={[0, 0, 0.0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.2, 24, 1, true]} />
            <meshStandardMaterial color="#0b1220" side={THREE.DoubleSide} />
          </mesh>
          <group position={[0, 0, 0.05]} rotation={[0, 0, 0]}>
            <Blades r={0.62} speed={() => sim.actuators.fanSpeed} />
          </group>
        </group>
        {(look.highlight || look.selected) && (
          <group position={[0, 0.25, 0.2]}>
            <SelectRing r={0.55} color={look.highlight ? '#ff4d4d' : '#22d3ee'} />
          </group>
        )}
      </group>
      <ModulePins comp={comp} />
    </group>
  )
}

export function DeskFan() {
  const spot = SPOTS.deskFan
  const sel = () => {
    const st = useLab.getState()
    if (st.mode === 'select' && !st.placing) st.select({ kind: 'scene', item: 'fanDesk' })
  }
  return (
    <group position={spot.pos} rotation={[0, spot.rotY, 0]} onClick={(e) => { if (e.delta > 8) return; e.stopPropagation(); sel() }}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.6, 0.1, 24]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 1.5, 10]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <group position={[0, 1.65, 0.1]}>
        <mesh>
          <torusGeometry args={[0.62, 0.03, 8, 40]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} />
        </mesh>
        {[...Array(8)].map((_, i) => (
          <mesh key={i} rotation={[0, 0, (i / 8) * Math.PI]}>
            <boxGeometry args={[1.22, 0.012, 0.012]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.6} />
          </mesh>
        ))}
        <group position={[0, 0, -0.06]}>
          <Blades r={1.05} speed={() => (sim.controls.fanManual ? 1 : 0)} />
        </group>
        <mesh position={[0, 0, -0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.2, 0.3, 16]} />
          <meshStandardMaterial color="#e2e8f0" />
        </mesh>
      </group>
    </group>
  )
}

/* ---------- Plant + soil sensor ---------- */
export function Plant() {
  const spot = SPOTS.plant
  const soilMat = useRef<THREE.MeshStandardMaterial>(null)
  const leaves = useRef<THREE.Group>(null)
  const dry = useMemo(() => new THREE.Color('#a47a4f'), [])
  const wet = useMemo(() => new THREE.Color('#2f2117'), [])
  useFrame(() => {
    const s = sim.env.soil / 100
    soilMat.current?.color.copy(dry).lerp(wet, Math.min(1, s * 1.4))
    if (leaves.current) {
      const droop = Math.max(0, 0.25 - s) * 2.2
      leaves.current.children.forEach((c, i) => (c.rotation.z = (i % 2 ? 1 : -1) * (0.5 + droop)))
    }
  })
  return (
    <group
      position={spot.pos}
      onClick={(e) => {
        if (e.delta > 8) return
        const st = useLab.getState()
        if (st.mode !== 'select' || st.placing) return
        e.stopPropagation()
        st.select({ kind: 'scene', item: 'plant' })
      }}
    >
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.4, 0.84, 24]} />
        <meshStandardMaterial color="#c2410c" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.82, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 24]} />
        <meshStandardMaterial ref={soilMat} color="#6b4a2f" roughness={1} />
      </mesh>
      <mesh position={[0.05, 1.25, 0.08]}>
        <cylinderGeometry args={[0.03, 0.04, 0.9, 6]} />
        <meshStandardMaterial color="#3f6212" />
      </mesh>
      <group ref={leaves} position={[0.05, 1.3, 0.08]}>
        {[...Array(7)].map((_, i) => (
          <group key={i} rotation={[0, (i / 7) * Math.PI * 2, 0]} position={[0, (i % 3) * 0.18, 0]}>
            <mesh position={[0.28, 0.05, 0]} scale={[0.32, 0.06, 0.14]}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color={i % 2 ? '#16a34a' : '#22c55e'} roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
      <WateringCan />
    </group>
  )
}

function WateringCan() {
  const ref = useRef<THREE.Group>(null)
  const drops = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const pouring = sim.env.pendingWater > 1
    const g = ref.current
    if (!g) return
    g.visible = pouring
    if (!pouring) return
    g.rotation.z = 0.7
    drops.current?.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 2 + i / 5) % 1
      c.position.set(-0.35 - t * 0.05, -t * 0.7, 0)
    })
  })
  return (
    <group ref={ref} position={[0.6, 1.6, 0]} visible={false}>
      <mesh>
        <cylinderGeometry args={[0.2, 0.24, 0.4, 16]} />
        <meshStandardMaterial color="#0ea5e9" metalness={0.3} />
      </mesh>
      <mesh position={[-0.3, 0.05, 0]} rotation={[0, 0, 1.1]}>
        <cylinderGeometry args={[0.03, 0.05, 0.4, 8]} />
        <meshStandardMaterial color="#0ea5e9" />
      </mesh>
      <group ref={drops} position={[-0.2, -0.05, 0]} rotation={[0, 0, -0.7]}>
        {[...Array(5)].map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.03, 6, 4]} />
            <meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function SoilSensor({ comp, look }: { comp: PlacedComponent; look: { highlight?: boolean; selected?: boolean } }) {
  const p = SPOTS.soil.pos
  const onClick = useSelectComp(comp.id)
  return (
    <group>
      <group position={[p[0], 0, p[2] - 0.25]} onClick={onClick}>
        <mesh position={[0, 1.15, 0]} castShadow>
          <boxGeometry args={[0.34, 0.95, 0.03]} />
          <meshStandardMaterial color="#111827" emissive={look.highlight ? '#ff3b3b' : look.selected ? '#22d3ee' : '#000'} emissiveIntensity={look.highlight || look.selected ? 0.6 : 0} />
        </mesh>
        <mesh position={[0, 1.38, 0.018]}>
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial map={pinLabelTexture(['SOIL'], '#0f172a')} />
        </mesh>
        <mesh position={[0, 1.55, 0]}>
          <boxGeometry args={[0.38, 0.06, 0.06]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        {(look.highlight || look.selected) && (
          <group position={[0, 1.0, 0]}>
            <SelectRing r={0.3} color={look.highlight ? '#ff4d4d' : '#22d3ee'} />
          </group>
        )}
      </group>
      <ModulePins comp={comp} />
    </group>
  )
}

/* ---------- PIR ---------- */
export function PirModule({ comp, look }: { comp: PlacedComponent; look: { highlight?: boolean; selected?: boolean } }) {
  const spot = SPOTS.pir
  const tex = pirTexture()
  const onClick = useSelectComp(comp.id)
  const ind = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => {
    if (ind.current) ind.current.emissiveIntensity = sim.readings.motion && sim.powered ? 3 : 0
  })
  return (
    <group>
      <group position={spot.pos} rotation={[0, spot.rotY, 0]} onClick={onClick}>
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.12, 0.5, 0.12]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.7, 0.08, 0.7]} />
          <meshStandardMaterial color="#15803d" emissive={look.highlight ? '#ff3b3b' : look.selected ? '#22d3ee' : '#000'} emissiveIntensity={look.highlight || look.selected ? 0.5 : 0} />
        </mesh>
        <mesh position={[0, 0.6, -0.05]} rotation={[0, 0, 0]}>
          <sphereGeometry args={[0.28, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial map={tex} roughness={0.3} transparent opacity={0.95} />
        </mesh>
        <mesh position={[0.28, 0.6, -0.28]}>
          <boxGeometry args={[0.05, 0.03, 0.05]} />
          <meshStandardMaterial ref={ind} color="#ef4444" emissive="#ef4444" emissiveIntensity={0} toneMapped={false} />
        </mesh>
        {(look.highlight || look.selected) && (
          <group position={[0, 0.4, 0]}>
            <SelectRing r={0.5} color={look.highlight ? '#ff4d4d' : '#22d3ee'} />
          </group>
        )}
      </group>
      <ModulePins comp={comp} />
    </group>
  )
}

/** A simple figure that walks past the PIR when "เดินผ่านเซนเซอร์" is pressed. */
export function Walker() {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const left = sim.env.motionUntil - sim.env.time
    g.visible = left > 0
    if (left <= 0) return
    const t = 1 - left / 2.5
    g.position.set(0.6 + t * 4.8, 0, -0.8 + Math.sin(t * Math.PI) * 0.2)
    g.children.forEach((c, i) => i > 1 && (c.rotation.x = Math.sin(t * 30 + i) * 0.5))
  })
  return (
    <group ref={ref} visible={false}>
      <mesh position={[0, 1.1, 0]}>
        <capsuleGeometry args={[0.22, 0.6, 4, 10]} />
        <meshStandardMaterial color="#a78bfa" transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.2, 14, 10]} />
        <meshStandardMaterial color="#fcd34d" transparent opacity={0.85} />
      </mesh>
      <mesh position={[-0.1, 0.4, 0]}>
        <capsuleGeometry args={[0.07, 0.5, 4, 6]} />
        <meshStandardMaterial color="#7c3aed" transparent opacity={0.75} />
      </mesh>
      <mesh position={[0.1, 0.4, 0]}>
        <capsuleGeometry args={[0.07, 0.5, 4, 6]} />
        <meshStandardMaterial color="#7c3aed" transparent opacity={0.75} />
      </mesh>
    </group>
  )
}

/* ---------- Heater ---------- */
export function Heater() {
  const spot = SPOTS.heater
  const coil = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7f1d1d', emissive: '#ff5a1f', emissiveIntensity: 0, toneMapped: false }), [])
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const k = sim.controls.heater / 100
    coil.emissiveIntensity = k * 3
    if (light.current) light.current.intensity = k * 6
  })
  return (
    <group
      position={spot.pos}
      rotation={[0, spot.rotY, 0]}
      onClick={(e) => {
        if (e.delta > 8) return
        const st = useLab.getState()
        if (st.mode !== 'select' || st.placing) return
        e.stopPropagation()
        st.select({ kind: 'scene', item: 'heater' })
      }}
    >
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[1.3, 1.4, 0.55]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.2} roughness={0.5} />
      </mesh>
      {[...Array(6)].map((_, i) => (
        <mesh key={i} position={[-0.45 + i * 0.18, 0.78, 0.28]} material={coil}>
          <boxGeometry args={[0.07, 1.0, 0.02]} />
        </mesh>
      ))}
      <pointLight ref={light} position={[0, 0.8, 0.8]} color="#ff7a3c" intensity={0} distance={4} />
      <mesh position={[0.5, 1.35, 0.28]}>
        <cylinderGeometry args={[0.07, 0.07, 0.05, 16]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
    </group>
  )
}

/* ---------- Desk lamp ---------- */
export function Lamp() {
  const spot = SPOTS.lamp
  const head = useRef<THREE.MeshStandardMaterial>(null)
  const spotL = useRef<THREE.SpotLight>(null)
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0.6, 0, 3.6)
    return o
  }, [])
  useFrame(() => {
    const k = sim.controls.lamp / 100
    if (head.current) head.current.emissiveIntensity = 0.2 + k * 4
    if (spotL.current) spotL.current.intensity = k * 60
  })
  const headPos: V3 = [0.6, 3.1, 2.6]
  return (
    <group
      position={spot.pos}
      onClick={(e) => {
        if (e.delta > 8) return
        const st = useLab.getState()
        if (st.mode !== 'select' || st.placing) return
        e.stopPropagation()
        st.select({ kind: 'scene', item: 'lamp' })
      }}
    >
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.5, 0.12, 24]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.2, 0.2]} rotation={[0.18, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 2.4, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} />
      </mesh>
      <mesh position={[0.3, 2.75, 1.45]} rotation={[1.15, 0, -0.25]}>
        <cylinderGeometry args={[0.04, 0.04, 2.6, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} />
      </mesh>
      <group position={headPos} rotation={[0.5, 0, 0]}>
        <mesh>
          <coneGeometry args={[0.38, 0.5, 24, 1, true]} />
          <meshStandardMaterial color="#0ea5e9" side={THREE.DoubleSide} metalness={0.4} />
        </mesh>
        <mesh position={[0, -0.18, 0]}>
          <sphereGeometry args={[0.16, 16, 10]} />
          <meshStandardMaterial ref={head} color="#fff7d6" emissive="#fff1b8" emissiveIntensity={0.2} toneMapped={false} />
        </mesh>
      </group>
      <primitive object={target} />
      <spotLight ref={spotL} position={headPos} target={target} angle={0.75} penumbra={0.6} distance={9} color="#fff3d1" intensity={0} />
    </group>
  )
}

/* ---------- Window + curtain ---------- */
export function WindowCurtain() {
  const left = useRef<THREE.Mesh>(null)
  const right = useRef<THREE.Mesh>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const glass = useRef<THREE.MeshStandardMaterial>(null)
  useFrame((_, dt) => {
    const open = sim.controls.curtainOpen
    for (const [m, sgn] of [
      [left.current, -1],
      [right.current, 1],
    ] as const) {
      if (!m) continue
      const targetScale = open ? 0.25 : 1
      m.scale.x += (targetScale - m.scale.x) * Math.min(1, dt * 4)
      m.position.z = sgn * (1.6 - m.scale.x * 0.8)
    }
    if (sun.current) sun.current.intensity += ((open ? 1.6 : 0.05) - sun.current.intensity) * Math.min(1, dt * 3)
    if (glass.current) glass.current.emissiveIntensity = open ? 1.2 : 0.1
  })
  return (
    <group
      position={[11.9, 3.2, -1]}
      onClick={(e) => {
        if (e.delta > 8) return
        const st = useLab.getState()
        if (st.mode !== 'select' || st.placing) return
        e.stopPropagation()
        st.select({ kind: 'scene', item: 'curtain' })
      }}
    >
      <mesh rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[3.4, 2.6]} />
        <meshStandardMaterial ref={glass} color="#7dd3fc" emissive="#bae6fd" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      <mesh ref={left} position={[-0.1, 0, -0.8]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[1.7, 2.9, 0.06]} />
        <meshStandardMaterial color="#1e40af" roughness={0.9} />
      </mesh>
      <mesh ref={right} position={[-0.1, 0, 0.8]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[1.7, 2.9, 0.06]} />
        <meshStandardMaterial color="#1e40af" roughness={0.9} />
      </mesh>
      <directionalLight ref={sun} position={[-0.5, 1, 0]} intensity={1.6} color="#fff6e0" />
    </group>
  )
}

/* ---------- Monitor with Serial output ---------- */
export function Monitor() {
  const spot = SPOTS.monitor
  const { tex, draw } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 640
    const g = c.getContext('2d')!
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    const draw = () => {
      g.fillStyle = '#020617'
      g.fillRect(0, 0, c.width, c.height)
      g.fillStyle = '#0f2a4a'
      g.fillRect(0, 0, c.width, 56)
      g.fillStyle = '#7dd3fc'
      g.font = `700 30px ${FONT}`
      g.fillText('Serial Monitor — 115200 baud', 24, 38)
      g.fillStyle = sim.powered ? '#22c55e' : '#ef4444'
      g.beginPath()
      g.arc(c.width - 40, 28, 12, 0, Math.PI * 2)
      g.fill()
      g.font = `500 21px ${MONO}`
      const lines = sim.serial.slice(-13)
      lines.forEach((l, i) => {
        g.fillStyle = l.includes('!!') ? '#f87171' : l.includes('NaN') ? '#fbbf24' : '#a7f3d0'
        g.fillText(l.length > 82 ? l.slice(0, 81) + '…' : l, 20, 92 + i * 30)
      })
      if (!sim.powered) {
        g.fillStyle = '#64748b'
        g.font = `600 34px ${FONT}`
        g.fillText(sim.circuit.usbConnected ? 'บอร์ดยังไม่ได้จ่ายไฟ (Power OFF)' : 'ยังไม่ได้เสียบสาย USB', 24, c.height - 40)
      } else {
        g.fillStyle = '#475569'
        g.font = `500 22px ${MONO}`
        g.fillText(`uptime ${fmtClock(sim.env.time - sim.bootTime)}`, c.width - 220, c.height - 24)
      }
      t.needsUpdate = true
    }
    return { tex: t, draw }
  }, [])
  const acc = useRef(0)
  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current > 0.25) {
      acc.current = 0
      draw()
    }
  })
  return (
    <group
      position={spot.pos}
      rotation={[0, spot.rotY, 0]}
      onClick={(e) => {
        if (e.delta > 8) return
        const st = useLab.getState()
        if (st.mode !== 'select' || st.placing) return
        e.stopPropagation()
        st.select({ kind: 'scene', item: 'monitor' })
      }}
    >
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[1.0, 0.1, 0.6]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.6, -0.05]}>
        <boxGeometry args={[0.14, 1.1, 0.1]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <boxGeometry args={[3.1, 1.95, 0.12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.55, 0.062]}>
        <planeGeometry args={[2.95, 1.84]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ---------- Decorative bench equipment ---------- */
export function PowerSupply() {
  const spot = SPOTS.psu
  const tex = canvasTexture('psu', 256, 96, (g, w, h) => {
    g.fillStyle = '#0b0f14'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#ef4444'
    g.font = `700 56px ${MONO}`
    g.fillText('05.00', 10, 62)
    g.fillStyle = '#22c55e'
    g.font = `700 26px ${MONO}`
    g.fillText('V  0.12A', 150, 88)
  })
  return (
    <group position={spot.pos} rotation={[0, spot.rotY, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.6, 0.9, 1.2]} />
        <meshStandardMaterial color="#334155" metalness={0.4} />
      </mesh>
      <mesh position={[-0.25, 0.55, 0.61]}>
        <planeGeometry args={[0.8, 0.3]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {[0.35, 0.55].map((x, i) => (
        <mesh key={x} position={[x, 0.25, 0.62]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.08, 12]} />
          <meshStandardMaterial color={i ? '#111' : '#dc2626'} />
        </mesh>
      ))}
    </group>
  )
}

export function MultimeterDeco() {
  const spot = SPOTS.multimeter
  const reading = useRef<THREE.Mesh>(null)
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 96
    const t = new THREE.CanvasTexture(c)
    return { c, t }
  }, [])
  useFrame(() => {
    const m = useLab.getState().measure
    const txt = m ? (m.volts == null ? '-.--' : m.volts.toFixed(2)) : '0.00'
    const g = tex.c.getContext('2d')!
    g.fillStyle = '#b7c9a8'
    g.fillRect(0, 0, 256, 96)
    g.fillStyle = '#111'
    g.font = `700 64px ${MONO}`
    g.fillText(txt, 20, 70)
    g.font = `700 28px ${MONO}`
    g.fillText('V', 210, 70)
    tex.t.needsUpdate = true
  })
  return (
    <group
      position={spot.pos}
      rotation={[-0.25, spot.rotY, 0]}
      onClick={(e) => {
        if (e.delta > 8) return
        const st = useLab.getState()
        if (st.placing) return
        e.stopPropagation()
        st.select({ kind: 'shelf', item: 'multimeter' })
      }}
    >
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.8, 0.22, 1.35]} />
        <meshStandardMaterial color="#facc15" />
      </mesh>
      <mesh ref={reading} position={[0, 0.235, -0.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.62, 0.26]} />
        <meshBasicMaterial map={tex.t} />
      </mesh>
      <mesh position={[0, 0.25, 0.2]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.05, 20]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
    </group>
  )
}

export function SolderingIron() {
  const spot = SPOTS.iron
  return (
    <group position={spot.pos} rotation={[0, spot.rotY, 0]}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.35, 0.4, 0.1, 20]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0, 0.4, 0]} rotation={[0, 0, 0.9]}>
        <torusGeometry args={[0.12, 0.02, 6, 18, Math.PI * 4]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.8} />
      </mesh>
      <mesh position={[0.35, 0.45, 0]} rotation={[0, 0, 0.9]}>
        <cylinderGeometry args={[0.06, 0.05, 0.7, 10]} />
        <meshStandardMaterial color="#0ea5e9" />
      </mesh>
      <mesh position={[0.05, 0.2, 0]} rotation={[0, 0, 0.9]}>
        <cylinderGeometry args={[0.01, 0.025, 0.35, 8]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.9} />
      </mesh>
    </group>
  )
}

export function Magnifier() {
  const spot = SPOTS.magnifier
  return (
    <group position={spot.pos} rotation={[0, spot.rotY, 0]}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.4, 0.45, 0.12, 20]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 1.7, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} />
      </mesh>
      <group position={[0.4, 1.75, 0.2]} rotation={[1.0, 0, 0]}>
        <mesh>
          <torusGeometry args={[0.42, 0.06, 10, 36]} />
          <meshStandardMaterial color="#e2e8f0" emissive="#e0f2fe" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
        <mesh>
          <circleGeometry args={[0.38, 30]} />
          <meshStandardMaterial color="#bae6fd" transparent opacity={0.25} metalness={0.2} roughness={0} />
        </mesh>
      </group>
    </group>
  )
}
