import { CameraControls, Html, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { Beacon } from '../../scene/GuideMarkers'
import { prefersReducedMotion } from '../../scene/interact'
import { canvasTexture, FONT, labelTexture } from '../../scene/textures'
import { useLab } from '../../store/lab'
import { mountReport, SENSORS, SLOT_TH, type DeviceId, type SensorId, type SlotId, type TwinPart } from '../engine/robot'
import { armAngle } from '../engine/signals'
import { implausibleTemp, measureOne } from '../engine/twin'
import { linkLoad, linkStatus } from '../engine/daq'
import { simRef } from '../sim'
import { useTwin } from '../store'
import { useTwinGuideView } from '../ui/guide'
import { DASH_POS, DASH_SIZE, devicePos, GATEWAY_POS, HOLO_POS, HOLO_SCALE, ROBOT_POS, SENSOR_HEX, SENSOR_ORDER, SLOT_LOCAL, slotPos, TRAY_POS, traySensorPos, TWIN_CAMERAS, type V3 } from './layout'

const D2R = Math.PI / 180
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const coarse = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches

const selectDevice = (id: DeviceId) => (e: ThreeEvent<MouseEvent>) => {
  if (e.delta > 8) return
  e.stopPropagation()
  const st = useTwin.getState()
  if (st.picked && (id === 'head' || id === 'shoulderR' || id === 'hip' || id === 'kneeR' || id === 'battery')) st.mount(id)
  else st.select({ kind: 'device', id })
}
const useSelected = (id: DeviceId) => useTwin((s) => s.selection?.kind === 'device' && s.selection.id === id)

/* ---------------- camera ---------------- */
function CameraRig() {
  const ref = useRef<CameraControls>(null)
  const camera = useTwin((s) => s.camera)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  useEffect(() => {
    ref.current?.setBoundary(new THREE.Box3(new THREE.Vector3(-6, 0.1, -2.4), new THREE.Vector3(6, 5, 9)))
  }, [])
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const p = TWIN_CAMERAS[camera.preset]
    const k = Math.min(2.2, Math.max(1, 1.45 / aspect))
    const pos = p.pos.map((v, i) => p.target[i] + (v - p.target[i]) * k) as V3
    void c.setLookAt(...pos, ...p.target, !prefersReducedMotion())
  }, [camera])
  return <CameraControls ref={ref} makeDefault minDistance={1.2} maxDistance={14} maxPolarAngle={Math.PI / 2 - 0.05} smoothTime={0.35} />
}

/* ---------------- room ---------------- */
function Room() {
  const sign = useMemo(
    () =>
      canvasTexture('twin-sign', 2048, 300, (g, w, h) => {
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.shadowColor = '#2dd4bf'
        g.shadowBlur = 32
        g.fillStyle = '#ccfbf1'
        g.font = `800 120px ${FONT}`
        g.fillText('Digital Twin Lab — NOVA-1', w / 2, h * 0.42)
        g.shadowBlur = 12
        g.font = `600 54px ${FONT}`
        g.fillStyle = '#99f6e4'
        g.fillText('ห้องปฏิบัติการแฝดดิจิทัล · ห้องเด็กเล่นโรงพยาบาล', w / 2, h * 0.84)
      }),
    [],
  )
  const mats: Array<[number, number, string]> = [
    [-2.1, 0.9, '#f9a8d4'],
    [-1.1, 0.9, '#93c5fd'],
    [-2.1, -0.1, '#fde68a'],
    [-1.1, -0.1, '#86efac'],
  ]
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]} receiveShadow>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial color="#0b1f2a" roughness={0.9} />
      </mesh>
      {mats.map(([x, z, c]) => (
        <mesh key={`${x}${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, z]}>
          <planeGeometry args={[0.98, 0.98]} />
          <meshStandardMaterial color={c} roughness={1} transparent opacity={0.55} />
        </mesh>
      ))}
      <mesh position={[0, 2.5, -2.7]}>
        <planeGeometry args={[16, 5]} />
        <meshStandardMaterial color="#0f2733" />
      </mesh>
      <mesh position={[0, 4.15, -2.65]}>
        <planeGeometry args={[6.4, 0.94]} />
        <meshBasicMaterial map={sign} transparent toneMapped={false} />
      </mesh>
      {/* toy blocks */}
      {(
        [
          [-3.4, 0.12, 0.9, '#ef4444'],
          [-3.15, 0.12, 1.15, '#3b82f6'],
          [-3.3, 0.36, 1.0, '#facc15'],
        ] as Array<[number, number, number, string]>
      ).map(([x, y, z, c], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, i * 0.4, 0]} raycast={() => null}>
          <boxGeometry args={[0.24, 0.24, 0.24]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
      {/* robot platform */}
      <mesh position={[ROBOT_POS[0], 0.06, ROBOT_POS[2]]} raycast={() => null}>
        <cylinderGeometry args={[0.6, 0.66, 0.12, 40]} />
        <meshStandardMaterial color="#1e3a46" />
      </mesh>
    </group>
  )
}

/* ---------------- robot body (shared by the real robot and the hologram) ---------------- */
type Mat = (part: TwinPart, key: string) => ReactNode

function Capsule({ r, len, y, x = 0, mat }: { r: number; len: number; y: number; x?: number; mat: ReactNode }) {
  return (
    <mesh position={[x, y, 0]}>
      <capsuleGeometry args={[r, len, 6, 12]} />
      {mat}
    </mesh>
  )
}

/** Arm hanging from a shoulder pivot (angle applied by the parent). */
function Arm({ mat, side }: { mat: Mat; side: 'R' | 'L' }) {
  return (
    <group>
      <Capsule r={0.055} len={0.2} y={-0.16} mat={mat('arms', `ua${side}`)} />
      <mesh position={[0, -0.3, 0]}>
        <sphereGeometry args={[0.058, 14, 10]} />
        {mat('arms', `el${side}`)}
      </mesh>
      <Capsule r={0.05} len={0.18} y={-0.43} mat={mat('arms', `fa${side}`)} />
      <mesh position={[0, -0.58, 0]}>
        <sphereGeometry args={[0.065, 14, 10]} />
        {mat('arms', `ha${side}`)}
      </mesh>
    </group>
  )
}

function Leg({ mat, x, side }: { mat: Mat; x: number; side: 'R' | 'L' }) {
  return (
    <group>
      <Capsule x={x} r={0.066} len={0.24} y={0.66} mat={mat('legs', `th${side}`)} />
      <mesh position={[x, 0.48, 0]}>
        <sphereGeometry args={[0.076, 16, 12]} />
        {mat('legs', `kn${side}`)}
      </mesh>
      <Capsule x={x} r={0.06} len={0.24} y={0.29} mat={mat('legs', `sh${side}`)} />
      <mesh position={[x, 0.035, 0.03]}>
        <boxGeometry args={[0.13, 0.07, 0.24]} />
        {mat('legs', `ft${side}`)}
      </mesh>
    </group>
  )
}

function Torso({ mat }: { mat: Mat }) {
  return (
    <group>
      <mesh position={[0, 1.14, 0]}>
        <boxGeometry args={[0.44, 0.5, 0.26]} />
        {mat('torso', 'chest')}
      </mesh>
      <mesh position={[0, 1.43, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.08, 12]} />
        {mat('torso', 'neck')}
      </mesh>
      {[-0.29, 0.29].map((x) => (
        <mesh key={x} position={[x, 1.37, 0]}>
          <sphereGeometry args={[0.08, 16, 12]} />
          {mat('torso', `sho${x}`)}
        </mesh>
      ))}
    </group>
  )
}

function Head({ mat, eyes }: { mat: Mat; eyes: string }) {
  return (
    <group position={[0, 1.6, 0]}>
      <mesh scale={[1, 0.85, 0.9]}>
        <sphereGeometry args={[0.17, 24, 18]} />
        {mat('head', 'skull')}
      </mesh>
      <mesh position={[0, 0.02, 0.14]}>
        <boxGeometry args={[0.24, 0.09, 0.03]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {[-0.055, 0.055].map((x) => (
        <mesh key={x} position={[x, 0.02, 0.158]}>
          <circleGeometry args={[0.022, 16]} />
          <meshBasicMaterial color={eyes} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.1, 6]} />
        {mat('head', 'ant')}
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <sphereGeometry args={[0.025, 10, 8]} />
        <meshBasicMaterial color="#fb923c" toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ---------------- physical robot ---------------- */
function RealRobot() {
  const root = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const pelvis = useRef<THREE.Group>(null)
  const kneeMat = useRef<THREE.MeshStandardMaterial>(null)
  const batt = useRef<THREE.Mesh>(null)
  const battMat = useRef<THREE.MeshBasicMaterial>(null)
  const sel = useTwin((s) => (s.selection?.kind === 'device' ? s.selection.id : null))
  const glow = (id: DeviceId) => (sel === id ? { emissive: '#2dd4bf', emissiveIntensity: 0.55 } : {})
  const white = (key: string, extra: object = {}) => <meshStandardMaterial key={key} color="#e5e7eb" roughness={0.45} metalness={0.15} {...extra} />
  const mat: Mat = (part, key) => {
    if (key.startsWith('kn')) return key === 'knR' ? <meshStandardMaterial key={key} ref={kneeMat} color="#334155" roughness={0.5} {...glow('kneeR')} /> : <meshStandardMaterial key={key} color="#334155" />
    if (key.startsWith('sho') || key === 'neck' || key.startsWith('el')) return <meshStandardMaterial key={key} color="#334155" roughness={0.5} {...(key === 'sho-0.29' ? glow('shoulderR') : {})} />
    if (key.startsWith('ft') || key.startsWith('ha')) return <meshStandardMaterial key={key} color="#14b8a6" roughness={0.5} />
    if (part === 'head') return white(key, glow('head'))
    if (key === 'chest') return white(key, glow('battery'))
    return white(key)
  }
  useFrame(() => {
    const t = simRef.t
    const tr = simRef.truth
    const target = tr.moving ? armAngle(t) : 0
    const k = 0.25
    if (armR.current) armR.current.rotation.z += (-target * D2R - armR.current.rotation.z) * k
    if (armL.current) armL.current.rotation.z += (target * D2R - armL.current.rotation.z) * k
    if (root.current) root.current.position.y = ROBOT_POS[1] + (tr.moving ? Math.abs(Math.sin(2 * Math.PI * t)) * 0.018 : 0)
    if (pelvis.current) pelvis.current.position.x = tr.bearingAmp > 0.3 && tr.moving ? (Math.random() - 0.5) * 0.006 * tr.bearingAmp : 0
    const heat = clamp01((tr.temp - 45) / 40)
    if (kneeMat.current && sel !== 'kneeR') {
      kneeMat.current.emissive.setRGB(heat, heat * 0.15, 0)
      kneeMat.current.emissiveIntensity = heat * 1.4
    }
    if (batt.current) batt.current.scale.x = Math.max(0.02, tr.soc / 100)
    if (battMat.current) battMat.current.color.setHSL((tr.soc / 100) * 0.33, 0.85, 0.5)
  })
  return (
    <group ref={root} position={ROBOT_POS}>
      <group ref={pelvis}>
        <mesh position={[0, 0.86, 0]}>
          <boxGeometry args={[0.34, 0.16, 0.22]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.5} {...glow('hip')} />
        </mesh>
        <mesh position={[0, 0.86, 0.112]}>
          <cylinderGeometry args={[0.05, 0.05, 0.02, 16]} />
          <meshStandardMaterial color="#64748b" metalness={0.6} />
        </mesh>
      </group>
      <Leg mat={mat} x={-0.11} side="R" />
      <Leg mat={mat} x={0.11} side="L" />
      <Torso mat={mat} />
      {/* battery gauge on the chest */}
      <mesh position={[0, 1.03, 0.132]}>
        <planeGeometry args={[0.24, 0.07]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
      <mesh ref={batt} position={[0, 1.03, 0.134]}>
        <planeGeometry args={[0.22, 0.05]} />
        <meshBasicMaterial ref={battMat} color="#22c55e" toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.24, 0.132]}>
        <circleGeometry args={[0.05, 20]} />
        <meshBasicMaterial color="#2dd4bf" toneMapped={false} />
      </mesh>
      <group ref={armR} position={[-0.29, 1.37, 0]}>
        <Arm mat={mat} side="R" />
      </group>
      <group ref={armL} position={[0.29, 1.37, 0]}>
        <Arm mat={mat} side="L" />
      </group>
      <Head mat={mat} eyes="#5eead4" />
    </group>
  )
}

/* ---------------- fitting points and mounted sensors ---------------- */
function Slots() {
  const picked = useTwin((s) => s.picked)
  const mounts = useTwin((s) => s.mounts)
  const big = coarse()
  return (
    <group>
      {(Object.keys(SLOT_LOCAL) as SlotId[]).map((slot) => {
        const p = slotPos(slot)
        const mounted = SENSOR_ORDER.find((s) => mounts[s] === slot)
        return (
          <group key={slot} position={p}>
            <mesh onClick={selectDevice(slot)}>
              <sphereGeometry args={[big ? 0.12 : 0.085, 12, 10]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {picked && !mounted && (
              <mesh raycast={() => null}>
                <sphereGeometry args={[0.035, 12, 10]} />
                <meshBasicMaterial color="#facc15" transparent opacity={0.85} toneMapped={false} />
              </mesh>
            )}
            {mounted && (
              <mesh raycast={() => null} position={[0, 0, 0.02]}>
                <boxGeometry args={[0.07, 0.05, 0.04]} />
                <meshStandardMaterial color={SENSOR_HEX[mounted]} emissive={SENSOR_HEX[mounted]} emissiveIntensity={0.6} />
              </mesh>
            )}
            {picked && (
              <Html position={[0, 0.09, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
                <div className="whitespace-nowrap rounded-md border border-teal-300/60 bg-slate-950/85 px-1.5 py-0.5 text-[10px] font-semibold text-teal-100">{SLOT_TH[slot]}</div>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}

/* ---------------- sensor tray, gateway ---------------- */
function Tray() {
  const picked = useTwin((s) => s.picked)
  const mounts = useTwin((s) => s.mounts)
  return (
    <group>
      <mesh position={[TRAY_POS[0], TRAY_POS[1] / 2, TRAY_POS[2]]} raycast={() => null}>
        <boxGeometry args={[2.3, TRAY_POS[1], 0.7]} />
        <meshStandardMaterial color="#1f3b47" />
      </mesh>
      <mesh position={[TRAY_POS[0] - 0.02, TRAY_POS[1] + 0.005, TRAY_POS[2]]} raycast={() => null}>
        <boxGeometry args={[1.4, 0.01, 0.5]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {SENSOR_ORDER.map((s) => {
        const p = traySensorPos(s)
        const here = !mounts[s]
        const isPicked = picked === s
        return (
          <group key={s} position={[p[0], p[1] + (isPicked ? 0.08 : 0), p[2]]}>
            {here && (
              <mesh
                onClick={(e) => {
                  if (e.delta > 8) return
                  e.stopPropagation()
                  const st = useTwin.getState()
                  st.pick(st.picked === s ? null : s)
                }}
              >
                <boxGeometry args={[0.2, 0.1, 0.16]} />
                <meshStandardMaterial color={SENSOR_HEX[s]} emissive={SENSOR_HEX[s]} emissiveIntensity={isPicked ? 0.9 : 0.25} />
              </mesh>
            )}
            <mesh position={[0, 0.12, 0]} raycast={() => null}>
              <planeGeometry args={[0.3, 0.075]} />
              <meshBasicMaterial map={labelTexture(SENSORS[s].nameTh.replace('เซนเซอร์', ''), { w: 512, h: 128, bg: '#0f172a', fg: SENSOR_HEX[s] })} transparent toneMapped={false} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function Gateway() {
  const sel = useSelected('gateway')
  const led = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    const s = useTwin.getState()
    const on = SENSOR_ORDER.some((x) => s.mounts[x])
    const over = s.link.level === 'overload'
    if (led.current) led.current.color.set(!on ? '#1f2937' : over ? (Math.sin(clock.elapsedTime * 12) > 0 ? '#ef4444' : '#450a0a') : Math.sin(clock.elapsedTime * 20) > 0 ? '#22c55e' : '#064e3b')
  })
  return (
    <group position={GATEWAY_POS} onClick={selectDevice('gateway')}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[0.36, 0.14, 0.26]} />
        <meshStandardMaterial color="#0f172a" emissive={sel ? '#2dd4bf' : '#000'} emissiveIntensity={sel ? 0.5 : 0} />
      </mesh>
      <mesh position={[0.12, 0.24, -0.06]}>
        <cylinderGeometry args={[0.01, 0.01, 0.22, 6]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[-0.1, 0.1, 0.132]}>
        <circleGeometry args={[0.018, 12]} />
        <meshBasicMaterial ref={led} color="#1f2937" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.27, 0]} raycast={() => null}>
        <planeGeometry args={[0.5, 0.11]} />
        <meshBasicMaterial map={labelTexture('DAQ Gateway', { w: 512, h: 112, bg: '#134e4a' })} transparent toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ---------------- data flow: robot → gateway → twin ---------------- */
function DataFlow() {
  const mounts = useTwin((s) => s.mounts)
  const live = SENSOR_ORDER.filter((s) => mounts[s])
  const curves = useMemo(() => {
    const out: Partial<Record<SensorId, THREE.CatmullRomCurve3>> = {}
    for (const s of live) {
      const a = new THREE.Vector3(...slotPos(mounts[s]!))
      const g = new THREE.Vector3(GATEWAY_POS[0], GATEWAY_POS[1] + 0.2, GATEWAY_POS[2])
      const h = new THREE.Vector3(HOLO_POS[0], HOLO_POS[1] + 0.5, HOLO_POS[2])
      out[s] = new THREE.CatmullRomCurve3([a, a.clone().lerp(g, 0.5).add(new THREE.Vector3(0, 0.5, 0)), g, g.clone().lerp(h, 0.5).add(new THREE.Vector3(0, 0.6, 0)), h])
    }
    return out
  }, [live.join(), ...live.map((s) => mounts[s])])
  const refs = useRef<Record<string, THREE.Mesh | null>>({})
  useFrame(({ clock }) => {
    const lat = useTwin.getState().link.latency
    const speed = 0.35 / Math.max(1, lat * 2)
    for (const s of live) {
      const c = curves[s]
      if (!c) continue
      for (let i = 0; i < 3; i++) {
        const m = refs.current[`${s}${i}`]
        if (!m) continue
        const u = (clock.elapsedTime * speed + i / 3 + SENSOR_ORDER.indexOf(s) * 0.11) % 1
        m.position.copy(c.getPointAt(u))
      }
    }
  })
  if (prefersReducedMotion()) return null
  return (
    <group>
      {live.flatMap((s) =>
        [0, 1, 2].map((i) => (
          <mesh key={`${s}${i}`} ref={(m) => void (refs.current[`${s}${i}`] = m)} raycast={() => null}>
            <sphereGeometry args={[0.022, 8, 6]} />
            <meshBasicMaterial color={SENSOR_HEX[s]} toneMapped={false} />
          </mesh>
        )),
      )}
    </group>
  )
}

/* ---------------- hologram twin ---------------- */
const PART_FROM: Record<TwinPart, V3> = { torso: [0, 0, -1.2], arms: [1.3, 0.4, 0], pelvis: [0, -0.9, 0.6], legs: [0, -1.4, 0], head: [0, 1.4, 0] }
const easeOutBack = (k: number) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2)

function holoColor(part: TwinPart, s: ReturnType<typeof useTwin.getState>) {
  const r = s.live.reading
  const c = new THREE.Color('#22d3ee')
  if (part === 'legs' && r.temp !== null) {
    if (implausibleTemp(r.temp)) c.set('#e879f9') // magenta = data the twin cannot trust
    else c.setHSL(0.52 - 0.52 * clamp01((r.temp - 40) / 40), 0.95, 0.55)
  }
  if (part === 'pelvis' && r.vib !== null) c.setHSL(0.52 - 0.52 * clamp01((r.vib - 0.1) / 0.7), 0.95, 0.55)
  if (part === 'torso' && r.soc !== null) c.setHSL(0.33 * clamp01(r.soc / 60) + 0.19 * clamp01((r.soc - 60) / 40), 0.9, 0.55)
  if (s.live.alerts.includes('temp') && part === 'legs') c.set('#ef4444')
  if (s.live.alerts.includes('vib') && part === 'pelvis') c.set('#ef4444')
  if (s.live.alerts.includes('soc') && part === 'torso') c.set('#ef4444')
  return c
}

function HoloTwin() {
  const mounts = useTwin((s) => s.mounts)
  const parts = useMemo(() => mountReport(mounts).parts, [mounts])
  const groups = useRef<Partial<Record<TwinPart, THREE.Group | null>>>({})
  const mats = useRef<Partial<Record<TwinPart, THREE.MeshBasicMaterial[]>>>({})
  const appear = useRef<Partial<Record<TwinPart, number | null>>>({})
  const armR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const flash = useRef<THREE.Mesh>(null)
  const flashAt = useRef(-10)
  const still = useMemo(prefersReducedMotion, [])
  const all: TwinPart[] = ['torso', 'arms', 'pelvis', 'legs', 'head']

  const mat: Mat = (part, key) => (
    <meshBasicMaterial
      key={key}
      ref={(m) => {
        if (!m) return
        const list = (mats.current[part] ??= [])
        if (!list.includes(m)) list.push(m)
      }}
      color="#22d3ee"
      transparent
      opacity={0.42}
      blending={THREE.AdditiveBlending}
      depthWrite={false}
      toneMapped={false}
    />
  )
  const ghost: Mat = (_, key) => <meshBasicMaterial key={key} color="#0e7490" wireframe transparent opacity={0.16} depthWrite={false} />

  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    const s = useTwin.getState()
    for (const p of all) {
      const on = parts.includes(p)
      if (on && appear.current[p] == null) {
        appear.current[p] = still ? now - 10 : now
        if (p === 'head') flashAt.current = now
      }
      if (!on) appear.current[p] = null
      const g = groups.current[p]
      if (!g) continue
      g.visible = on
      if (!on) continue
      const k = clamp01((now - (appear.current[p] ?? now)) / 0.9)
      const e = easeOutBack(k)
      const from = PART_FROM[p]
      g.position.set(from[0] * (1 - e), from[1] * (1 - e), from[2] * (1 - e))
      g.rotation.y = (1 - e) * 2.4
      g.scale.setScalar(0.35 + 0.65 * Math.min(1, e))
      const col = holoColor(p, s)
      const flicker = k < 1 ? 0.6 + Math.random() * 0.4 : 1
      for (const m of mats.current[p] ?? []) {
        m.color.copy(col)
        m.opacity = 0.42 * flicker
      }
    }
    // twin arm angle: what the twin received (sample-and-hold + link delay + calibration)
    if (parts.includes('arms')) {
      const cfg = { mounts: s.mounts, rates: s.rates, encoderOffset: s.encoderOffset, tempCal: s.tempCal }
      const lat = linkStatus(linkLoad(s.rates, s.mounts)).latency
      const fs = Math.max(0.1, s.rates.angle)
      const tq = Math.floor((simRef.t - lat) * fs) / fs
      const tr = simRef.history.at(tq)
      const a = tr ? (measureOne('angle', tr, cfg, tq) ?? 0) : 0
      if (armR.current) armR.current.rotation.z = -a * D2R
      if (armL.current) armL.current.rotation.z = a * D2R
    }
    if (flash.current) {
      const k = clamp01((now - flashAt.current) / 1.2)
      flash.current.visible = k < 1
      flash.current.scale.setScalar(0.4 + k * 2.2)
      ;(flash.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k)
    }
  })

  return (
    <group position={HOLO_POS}>
      {/* projector table */}
      <mesh position={[0, -0.4, 0]} onClick={selectDevice('twin')}>
        <cylinderGeometry args={[0.72, 0.8, 0.76, 40]} />
        <meshStandardMaterial color="#10232d" />
      </mesh>
      <mesh position={[0, -0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[0.55, 0.68, 48]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.55, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.5, 0.62, 1.1, 40, 1, true]} />
        <meshBasicMaterial color="#0891b2" transparent opacity={0.07} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh ref={flash} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} visible={false}>
        <ringGeometry args={[0.3, 0.36, 48]} />
        <meshBasicMaterial color="#a5f3fc" transparent toneMapped={false} />
      </mesh>
      <group scale={HOLO_SCALE} onClick={selectDevice('twin')}>
        {/* wireframe "frame" waiting for data */}
        <group>
          <mesh position={[0, 0.86, 0]}>
            <boxGeometry args={[0.34, 0.16, 0.22]} />
            {ghost('pelvis', 'gp')}
          </mesh>
          <Leg mat={ghost} x={-0.11} side="R" />
          <Leg mat={ghost} x={0.11} side="L" />
          <Torso mat={ghost} />
          <group position={[-0.29, 1.37, 0]}>
            <Arm mat={ghost} side="R" />
          </group>
          <group position={[0.29, 1.37, 0]}>
            <Arm mat={ghost} side="L" />
          </group>
          <mesh position={[0, 1.6, 0]} scale={[1, 0.85, 0.9]}>
            <sphereGeometry args={[0.17, 12, 10]} />
            {ghost('head', 'gh')}
          </mesh>
        </group>
        <group ref={(g) => void (groups.current.pelvis = g)}>
          <mesh position={[0, 0.86, 0]}>
            <boxGeometry args={[0.34, 0.16, 0.22]} />
            {mat('pelvis', 'p')}
          </mesh>
        </group>
        <group ref={(g) => void (groups.current.legs = g)}>
          <Leg mat={mat} x={-0.11} side="R" />
          <Leg mat={mat} x={0.11} side="L" />
        </group>
        <group ref={(g) => void (groups.current.torso = g)}>
          <Torso mat={mat} />
        </group>
        <group ref={(g) => void (groups.current.arms = g)}>
          <group ref={armR} position={[-0.29, 1.37, 0]}>
            <Arm mat={mat} side="R" />
          </group>
          <group ref={armL} position={[0.29, 1.37, 0]}>
            <Arm mat={mat} side="L" />
          </group>
        </group>
        <group ref={(g) => void (groups.current.head = g)}>
          <Head mat={mat} eyes="#ecfeff" />
        </group>
      </group>
    </group>
  )
}

/* ---------------- dashboard screen ---------------- */
function Dashboard() {
  const sel = useSelected('dashboard')
  const { tex, draw } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 484
    const g = c.getContext('2d')!
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    const draw = () => {
      const s = useTwin.getState()
      const r = s.live.reading
      g.fillStyle = '#04121a'
      g.fillRect(0, 0, c.width, c.height)
      g.fillStyle = '#5eead4'
      g.font = `800 40px ${FONT}`
      g.textAlign = 'left'
      g.fillText('NOVA-1 · Digital Twin Dashboard', 32, 58)
      const tiles: Array<[string, string, string]> = [
        ['มุมแขนขวา', r.angle === null ? '—' : `${r.angle.toFixed(0)}°`, '#22d3ee'],
        [implausibleTemp(r.temp) ? 'มอเตอร์เข่า (ค่าเพี้ยน!)' : 'มอเตอร์เข่า', r.temp === null ? '—' : `${r.temp.toFixed(0)} °C`, implausibleTemp(r.temp) ? '#e879f9' : '#f97316'],
        ['ลูกปืนสะโพก', r.vib === null ? (s.mounts.vib ? 'วัดไม่ได้' : '—') : `${r.vib.toFixed(2)} g`, '#a855f7'],
        ['แบตเตอรี่', r.soc === null ? '—' : `${r.soc.toFixed(0)}%`, '#facc15'],
        ['ดีเลย์', `${s.live.latency.toFixed(2)} วิ`, s.live.latency > 0.2 ? '#ef4444' : '#86efac'],
        ['ช่องสัญญาณ', `${Math.round(s.link.util * 100)}%`, s.link.util > 0.8 ? '#ef4444' : '#86efac'],
      ]
      tiles.forEach(([k, v, col], i) => {
        const x = 32 + (i % 3) * 325
        const y = 92 + Math.floor(i / 3) * 150
        g.fillStyle = '#0b2530'
        g.fillRect(x, y, 305, 130)
        g.fillStyle = '#94a3b8'
        g.font = `600 28px ${FONT}`
        g.fillText(k, x + 18, y + 40)
        g.fillStyle = col
        g.font = `800 50px ${FONT}`
        g.fillText(v, x + 18, y + 104)
      })
      const alerts = s.live.alerts
      g.fillStyle = alerts.length ? '#7f1d1d' : '#064e3b'
      g.fillRect(32, 400, 960, 64)
      g.fillStyle = '#fff'
      g.font = `700 32px ${FONT}`
      g.fillText(alerts.length ? `⚠️ เตือน: ${alerts.map((a) => ({ temp: 'มอเตอร์ร้อน', vib: 'ลูกปืนสั่น', soc: 'แบตใกล้หมด' })[a]).join(' · ')}${s.live.stopped ? ' → หยุดหุ่นแล้ว' : ''}` : '✅ ทุกระบบปกติ', 52, 444)
      t.needsUpdate = true
    }
    return { tex: t, draw }
  }, [])
  const acc = useRef(0)
  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current < 0.2) return
    acc.current = 0
    draw()
  })
  return (
    <group position={DASH_POS} onClick={selectDevice('dashboard')}>
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[DASH_SIZE.w + 0.14, DASH_SIZE.h + 0.14, 0.08]} />
        <meshStandardMaterial color="#020617" emissive={sel ? '#2dd4bf' : '#000'} emissiveIntensity={sel ? 0.5 : 0} />
      </mesh>
      <mesh>
        <planeGeometry args={[DASH_SIZE.w, DASH_SIZE.h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ---------------- guided-mode arrows ---------------- */
function GuideBeacons() {
  const g = useTwinGuideView((s) => s.g)
  const picked = useTwin((s) => s.picked)
  const step = g?.current
  if (!step) return null
  const up = (p: V3, dy = 0.12): V3 => [p[0], p[1] + dy, p[2]]
  if (step.kind === 'select' && step.device) return <Beacon pos={up(devicePos(step.device), step.device === 'twin' ? 0.2 : 0.1)} scale={1.4} />
  if (step.kind === 'mount' && step.sensor && step.slot) return picked === step.sensor ? <Beacon pos={up(slotPos(step.slot), 0.04)} scale={0.9} /> : <Beacon pos={up(traySensorPos(step.sensor), 0.02)} scale={0.8} />
  if (step.kind === 'rate' || step.kind === 'link') return <Beacon pos={up(devicePos('gateway'), 0.25)} scale={1.4} />
  if (step.kind === 'pose' || step.kind === 'zero') return <Beacon pos={up(slotPos('shoulderR'), 0.1)} scale={1.2} />
  if (step.kind === 'tempcal') return <Beacon pos={up(slotPos('kneeR'), 0.08)} scale={1.2} />
  if (step.kind === 'rule' || step.kind === 'test') return <Beacon pos={[DASH_POS[0], DASH_POS[1] + DASH_SIZE.h / 2 + 0.05, DASH_POS[2] + 0.2]} scale={1.8} />
  return null
}

/* ---------------- scene ---------------- */
function Content({ quality }: { quality: 'low' | 'mid' | 'high' }) {
  return (
    <>
      <color attach="background" args={['#04121a']} />
      <fog attach="fog" args={['#04121a', 12, 28]} />
      <hemisphereLight args={['#ccfbf1', '#0f2733', 1.15]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 6, 5]} intensity={1.5} />
      <pointLight position={[-2.1, 2.6, 1.6]} intensity={6} distance={6} color="#f0fdfa" />
      <pointLight position={[2.1, 2.2, 1.2]} intensity={3} distance={5} color="#67e8f9" />
      <Room />
      <RealRobot />
      <Slots />
      <Tray />
      <Gateway />
      <DataFlow />
      <HoloTwin />
      <Dashboard />
      <GuideBeacons />
      <CameraRig />
      {quality !== 'low' && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={quality === 'high' ? 1.0 : 0.7} luminanceThreshold={0.55} luminanceSmoothing={0.25} />
        </EffectComposer>
      )}
    </>
  )
}

export default function TwinScene({ onReady }: { onReady?: () => void }) {
  const quality = useLab((s) => s.quality)
  const autoQuality = useLab((s) => s.autoQuality)
  const setAutoQuality = useLab((s) => s.setAutoQuality)
  const q = quality === 'auto' ? autoQuality : quality
  return (
    <Canvas
      dpr={q === 'low' ? [1, 1] : q === 'mid' ? [1, 1.5] : [1, 2]}
      camera={{ position: TWIN_CAMERAS.overview.pos, fov: 45, near: 0.05, far: 60 }}
      gl={{ antialias: q !== 'low', powerPreference: 'high-performance' }}
      onCreated={() => onReady?.()}
      onPointerMissed={() => {
        const st = useTwin.getState()
        if (!st.picked) st.select(null)
      }}
      style={{ touchAction: 'none' }}
    >
      <PerformanceMonitor
        onDecline={() => quality === 'auto' && setAutoQuality(autoQuality === 'high' ? 'mid' : 'low')}
        onIncline={() => quality === 'auto' && autoQuality === 'low' && setAutoQuality('mid')}
        flipflops={3}
        onFallback={() => quality === 'auto' && setAutoQuality('low')}
      />
      <Content quality={q} />
    </Canvas>
  )
}
