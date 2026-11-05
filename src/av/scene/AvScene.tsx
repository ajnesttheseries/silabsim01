import { CameraControls, Html, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GEO, type V3 } from '../engine/audio'
import { familyOf, PORTS, type DeviceId } from '../engine/patch'
import { beamDirection, beamHit, cueAt, FIXTURE_POS, SINGER_SPOT, type WallMode } from '../engine/show'
import { useLab } from '../../store/lab'
import { prefersReducedMotion } from '../../scene/interact'
import { Beacon } from '../../scene/GuideMarkers'
import { canvasTexture, FONT, labelTexture } from '../../scene/textures'
import { useAv } from '../store'
import { useAvGuideView } from '../ui/guide'
import { AMP_RACK, AV_CAMERAS, COND_TABLE, CONSOLE_POS, devicePos, FAMILY_HEX, FOH, LED_WALL, MIXER_POS, portPos, STAGE, TERM_BOX, TRUSS_Y } from './layout'

const selectDevice = (id: DeviceId) => (e: ThreeEvent<MouseEvent>) => {
  if (e.delta > 8) return
  const st = useAv.getState()
  if (st.mode !== 'select') return
  e.stopPropagation()
  st.select({ kind: 'device', id })
}

function useSelected(id: DeviceId) {
  return useAv((s) => s.selection?.kind === 'device' && s.selection.id === id)
}

/* ---------------- camera ---------------- */
function CameraRig() {
  const ref = useRef<CameraControls>(null)
  const camera = useAv((s) => s.camera)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  useEffect(() => {
    const c = ref.current
    if (!c) return
    c.setBoundary(new THREE.Box3(new THREE.Vector3(-12, -0.5, -4), new THREE.Vector3(12, 7, 18)))
    const onStart = () => {
      const st = useAv.getState()
      if (!st.progress.tutorial.cam) st.tutorialFlag('cam')
    }
    c.addEventListener('controlstart', onStart)
    return () => c.removeEventListener('controlstart', onStart)
  }, [])
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const p = AV_CAMERAS[camera.preset]
    const k = Math.min(2.2, Math.max(1, 1.45 / aspect))
    const pos = p.pos.map((v, i) => p.target[i] + (v - p.target[i]) * k) as V3
    void c.setLookAt(...pos, ...p.target, !prefersReducedMotion())
    // aspect deliberately left out: re-frame only when a preset is chosen
  }, [camera])
  return <CameraControls ref={ref} makeDefault minDistance={2} maxDistance={34} maxPolarAngle={Math.PI / 2 - 0.05} smoothTime={0.35} />
}

/* ---------------- venue ---------------- */
function Venue() {
  const sign = useMemo(
    () =>
      canvasTexture('av-sign', 2048, 300, (g, w, h) => {
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.shadowColor = '#e879f9'
        g.shadowBlur = 36
        g.fillStyle = '#fae8ff'
        g.font = `800 130px ${FONT}`
        g.fillText('AV & Lighting Lab — Live Stage', w / 2, h * 0.42)
        g.shadowBlur = 14
        g.font = `600 56px ${FONT}`
        g.fillStyle = '#f0abfc'
        g.fillText('ห้องปฏิบัติการระบบภาพ เสียง และแสงอัจฉริยะ', w / 2, h * 0.84)
      }),
    [],
  )
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 7]} receiveShadow>
        <planeGeometry args={[34, 30]} />
        <meshStandardMaterial color="#070b18" roughness={0.9} />
      </mesh>
      <mesh position={[0, 5, -4.2]}>
        <planeGeometry args={[34, 12]} />
        <meshStandardMaterial color="#0a0f22" />
      </mesh>
      <mesh position={[0, 8.6, -4.1]}>
        <planeGeometry args={[11, 1.6]} />
        <meshBasicMaterial map={sign} transparent toneMapped={false} />
      </mesh>
      {/* stage */}
      <mesh position={[(STAGE.x0 + STAGE.x1) / 2, STAGE.h / 2, (STAGE.z0 + STAGE.z1) / 2]} castShadow receiveShadow>
        <boxGeometry args={[STAGE.x1 - STAGE.x0, STAGE.h, STAGE.z1 - STAGE.z0]} />
        <meshStandardMaterial color="#2a2f45" roughness={0.7} />
      </mesh>
      <mesh position={[0, STAGE.h - 0.02, STAGE.z1 + 0.01]}>
        <boxGeometry args={[STAGE.x1 - STAGE.x0, 0.04, 0.02]} />
        <meshBasicMaterial color="#e879f9" toneMapped={false} />
      </mesh>
      {/* truss */}
      <mesh position={[0, TRUSS_Y, 0.4]}>
        <boxGeometry args={[16, 0.3, 0.3]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.3} wireframe />
      </mesh>
      <mesh position={[0, TRUSS_Y, 0.4]}>
        <boxGeometry args={[16, 0.06, 0.06]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
      </mesh>
      {[-8, 8].map((x) => (
        <mesh key={x} position={[x, TRUSS_Y / 2, 0.4]}>
          <boxGeometry args={[0.3, TRUSS_Y, 0.3]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.8} wireframe />
        </mesh>
      ))}
      <Audience />
    </group>
  )
}

function Audience() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const spots = useMemo(() => {
    const out: V3[] = []
    for (let row = 0; row < 4; row++) for (let i = 0; i < 9; i++) out.push([-7 + i * 1.75 + (row % 2) * 0.8, 0.85, 5.6 + row * 1.5])
    return out.filter((p) => !(Math.abs(p[0]) < 2 && p[2] > 11))
  }, [])
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    spots.forEach((p, i) => {
      o.position.set(...p)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }, [spots])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} raycast={() => null}>
      <capsuleGeometry args={[0.24, 1.1, 4, 8]} />
      <meshStandardMaterial color="#1e1b4b" roughness={1} />
    </instancedMesh>
  )
}

/* ---------------- light beams ---------------- */
function Beam({ from, to, color, intensity }: { from: V3; to: V3; color: THREE.Color; intensity: number }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const len = a.distanceTo(b)
    const mid = a.clone().add(b).multiplyScalar(0.5)
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b).normalize())
    return { pos: mid, quat, len }
  }, [from, to])
  if (intensity < 0.02) return null
  return (
    <group>
      <mesh position={pos} quaternion={quat} raycast={() => null}>
        <cylinderGeometry args={[0.08, 0.75, len, 20, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.16 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[to[0], to[1] + 0.02, to[2]]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[0.85, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.45 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

const PAR_AIM: Record<string, V3> = { par1: [-3.2, STAGE.h, 0.9], par2: [-1, STAGE.h, 0.9], par3: [1, STAGE.h, 0.9], par4: [3.2, STAGE.h, 0.9] }

function Par({ id }: { id: 'par1' | 'par2' | 'par3' | 'par4' }) {
  const out = useAv((s) => s.live.rig[id])
  const sel = useSelected(id)
  const pos = FIXTURE_POS[id]
  const aim = PAR_AIM[id]
  const color = useMemo(() => new THREE.Color(out?.r ?? 0, out?.g ?? 0, out?.b ?? 0).multiplyScalar(1 / Math.max(0.001, out?.intensity ?? 1)), [out])
  const lookQ = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(aim[0] - pos[0], aim[1] - pos[1], aim[2] - pos[2]).normalize()), [aim, pos])
  const k = out?.intensity ?? 0
  return (
    <group>
      <group position={pos} quaternion={lookQ} onClick={selectDevice(id)}>
        <mesh>
          <cylinderGeometry args={[0.22, 0.2, 0.42, 18]} />
          <meshStandardMaterial color="#111827" metalness={0.5} emissive={sel ? '#22d3ee' : '#000'} emissiveIntensity={sel ? 0.6 : 0} />
        </mesh>
        <mesh position={[0, -0.215, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.18, 18]} />
          <meshBasicMaterial color={k > 0.02 ? color : '#1f2937'} toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[pos[0], TRUSS_Y - 0.15, pos[2]]}>
        <boxGeometry args={[0.06, 0.3, 0.06]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>
      <Beam from={pos} to={aim} color={color} intensity={k} />
    </group>
  )
}

function Mover({ id }: { id: 'mover1' | 'mover2' }) {
  const out = useAv((s) => s.live.rig[id])
  const sel = useSelected(id)
  const pos = FIXTURE_POS[id]
  const yoke = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const dir = beamDirection(out?.pan ?? 0, out?.tilt ?? 0)
  const hit = beamHit(pos, dir, STAGE.h) ?? beamHit(pos, dir, 0) ?? [pos[0], 0, pos[2]]
  const color = useMemo(() => new THREE.Color(out?.r ?? 0, out?.g ?? 0, out?.b ?? 0).multiplyScalar(1 / Math.max(0.001, out?.intensity ?? 1)), [out])
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 6)
    if (yoke.current) yoke.current.rotation.y += (((out?.pan ?? 0) * Math.PI) / 180 - yoke.current.rotation.y) * k
    if (head.current) head.current.rotation.x += (((out?.tilt ?? 0) * Math.PI) / 180 - head.current.rotation.x) * k
  })
  return (
    <group>
      <group position={pos} onClick={selectDevice(id)}>
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.5, 0.18, 0.4]} />
          <meshStandardMaterial color="#1f2937" emissive={sel ? '#22d3ee' : '#000'} emissiveIntensity={sel ? 0.6 : 0} />
        </mesh>
        <group ref={yoke}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.5, 0.06, 0.12]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
          <group ref={head} position={[0, -0.18, 0]}>
            <mesh rotation={[0, 0, 0]}>
              <boxGeometry args={[0.3, 0.42, 0.3]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
            <mesh position={[0, -0.215, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.12, 16]} />
              <meshBasicMaterial color={(out?.intensity ?? 0) > 0.02 ? color : '#1f2937'} toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>
      <Beam from={pos} to={hit as V3} color={color} intensity={(out?.intensity ?? 0) * 1.3} />
    </group>
  )
}

/* ---------------- LED wall ---------------- */
function LedWall() {
  const { tex, draw } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 456
    const g = c.getContext('2d')!
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    const draw = (mode: WallMode, time: number) => {
      g.fillStyle = '#000'
      g.fillRect(0, 0, c.width, c.height)
      if (mode === 'logo') {
        const grad = g.createLinearGradient(0, 0, c.width, c.height)
        grad.addColorStop(0, '#1e1b4b')
        grad.addColorStop(1, '#581c87')
        g.fillStyle = grad
        g.fillRect(0, 0, c.width, c.height)
        g.fillStyle = '#f5d0fe'
        g.textAlign = 'center'
        g.font = `800 96px ${FONT}`
        g.fillText('SI LIVE 2026', c.width / 2, c.height / 2 + 10)
        g.font = `600 36px ${FONT}`
        g.fillText('Intelligent AV & Lighting', c.width / 2, c.height / 2 + 70)
      } else if (mode === 'visualizer') {
        for (let i = 0; i < 32; i++) {
          const h = (0.25 + 0.75 * Math.abs(Math.sin(time * 4 + i * 0.6) * Math.sin(time * 1.3 + i))) * c.height * 0.9
          g.fillStyle = `hsl(${(i * 11 + time * 60) % 360} 90% 60%)`
          g.fillRect(i * 32 + 4, c.height - h, 24, h)
        }
      } else if (mode === 'info') {
        g.fillStyle = '#1c1917'
        g.fillRect(0, 0, c.width, c.height)
        g.fillStyle = '#fbbf24'
        g.fillRect(40, 40, 8, c.height - 80)
        g.textAlign = 'left'
        g.fillStyle = '#fef3c7'
        g.font = `800 58px ${FONT}`
        g.fillText('พิพิธภัณฑ์ดนตรี', 80, 120)
        g.font = `600 34px ${FONT}`
        g.fillStyle = '#fde68a'
        g.fillText('นักร้องในตำนาน: เสียงที่ส่งต่อพลังให้ผู้คน', 80, 190)
        g.font = `500 28px ${FONT}`
        g.fillStyle = '#e7e5e4'
        g.fillText('ฟังเสียงบรรยาย และสังเกตแสงที่ส่องชิ้นงาน', 80, 260)
        g.fillText('ระบบเปิดเองเมื่อเซนเซอร์ตรวจพบผู้ชม 👋', 80, 310)
      } else if (mode === 'lyrics') {
        g.fillStyle = '#0f172a'
        g.fillRect(0, 0, c.width, c.height)
        g.fillStyle = '#e0f2fe'
        g.textAlign = 'center'
        g.font = `700 60px ${FONT}`
        const lines = ['ทุกแสงที่ส่องมา', 'คือพลังที่เราสร้างเอง']
        g.fillText(lines[Math.floor(time / 3) % 2], c.width / 2, c.height / 2 + 20)
      }
      t.needsUpdate = true
    }
    return { tex: t, draw }
  }, [])
  const acc = useRef(0)
  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current < 0.1) return
    acc.current = 0
    const s = useAv.getState()
    const exhibit = s.exhibitDemo && s.progress.challenge === 'exhibit' && !s.live.showPlaying
    const mode: WallMode = s.live.showPlaying ? cueAt(s.cues, s.live.showT).wall : exhibit ? s.scenes[s.visitor ? 'visitor' : 'idle'].wall : 'logo'
    draw(mode, s.live.showPlaying ? s.live.showT : performance.now() / 1000)
  })
  return (
    <group position={LED_WALL.pos}>
      <mesh position={[0, 0, -0.08]}>
        <boxGeometry args={[LED_WALL.w + 0.3, LED_WALL.h + 0.3, 0.12]} />
        <meshStandardMaterial color="#020617" />
      </mesh>
      <mesh>
        <planeGeometry args={[LED_WALL.w, LED_WALL.h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ---------------- performers & audio gear ---------------- */
function Singer() {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const s = useAv.getState().live
    const singing = s.rehearsing || (s.showPlaying && s.showT >= 6 && s.showT < 24)
    if (ref.current) ref.current.position.y = singing ? Math.abs(Math.sin(clock.elapsedTime * 4)) * 0.04 : 0
  })
  const [x, , z] = SINGER_SPOT
  return (
    <group ref={ref} position={[x, STAGE.h, z]}>
      <mesh position={[0, 0.85, 0]}>
        <capsuleGeometry args={[0.22, 0.9, 4, 10]} />
        <meshStandardMaterial color="#c026d3" />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.17, 16, 12]} />
        <meshStandardMaterial color="#fcd34d" />
      </mesh>
    </group>
  )
}

function MicStand() {
  const micOn = useAv((s) => s.mixer.micOnStand)
  const selD = useSelected('micDyn')
  const selC = useSelected('micCond')
  const m = GEO.mic
  const fb = useAv((s) => s.live.levels.feedback)
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 20) * 0.15)
  })
  const micMesh = (id: 'micDyn' | 'micCond', at: V3, sel: boolean) => (
    <group position={at} onClick={selectDevice(id)} rotation={[-0.35, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.025, 0.2, 12]} />
        <meshStandardMaterial color={id === 'micDyn' ? '#111827' : '#d4d4d8'} metalness={0.6} emissive={sel ? '#22d3ee' : '#000'} emissiveIntensity={sel ? 0.8 : 0} />
      </mesh>
      <mesh position={[0, 0, -0.12]}>
        <sphereGeometry args={[0.05, 12, 10]} />
        <meshStandardMaterial color={id === 'micDyn' ? '#9ca3af' : '#e5e7eb'} metalness={0.7} />
      </mesh>
    </group>
  )
  const tableAt = (id: 'micDyn' | 'micCond'): V3 => [COND_TABLE[0] + (id === 'micDyn' ? 0.5 : 0), COND_TABLE[1] + 0.55, COND_TABLE[2]]
  return (
    <group>
      <mesh position={[m[0], (STAGE.h + m[1]) / 2, m[2] + 0.05]}>
        <cylinderGeometry args={[0.015, 0.015, m[1] - STAGE.h, 8]} />
        <meshStandardMaterial color="#374151" metalness={0.8} />
      </mesh>
      <mesh position={[m[0], STAGE.h + 0.02, m[2] + 0.05]}>
        <cylinderGeometry args={[0.18, 0.18, 0.03, 16]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {micMesh(micOn, m, micOn === 'micDyn' ? selD : selC)}
      {micMesh(micOn === 'micDyn' ? 'micCond' : 'micDyn', tableAt(micOn === 'micDyn' ? 'micCond' : 'micDyn'), micOn === 'micDyn' ? selC : selD)}
      <mesh position={[COND_TABLE[0] + 0.25, COND_TABLE[1] + 0.25, COND_TABLE[2]]}>
        <boxGeometry args={[1.0, 0.5, 0.5]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {fb && (
        <mesh ref={ring} position={m} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <ringGeometry args={[0.25, 0.32, 32]} />
          <meshBasicMaterial color="#ef4444" toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

function Speaker({ id }: { id: 'spkL' | 'spkR' }) {
  const paPos = useAv((s) => s.mixer.paPos)
  const sel = useSelected(id)
  const p = GEO.pa[paPos][id === 'spkL' ? 'L' : 'R']
  const playing = useAv((s) => s.live.levels.paBoxes > 0 && s.live.levels.mainDbfs != null)
  const cone = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (cone.current) cone.current.position.z = 0.3 + (playing ? Math.sin(clock.elapsedTime * 60) * 0.008 : 0)
  })
  return (
    <group position={p} onClick={selectDevice(id)}>
      <mesh castShadow>
        <boxGeometry args={[0.7, 1.3, 0.6]} />
        <meshStandardMaterial color="#0b0f19" emissive={sel ? '#22d3ee' : '#000'} emissiveIntensity={sel ? 0.4 : 0} />
      </mesh>
      <mesh ref={cone} position={[0, -0.25, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.12, 0.06, 20]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0, 0.38, 0.31]}>
        <boxGeometry args={[0.36, 0.14, 0.02]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      {/* stand from the floor (front) or the stage deck (back) up to the box */}
      {(() => {
        const floor = paPos === 'front' ? 0 : STAGE.h
        const h = Math.max(0.1, p[1] - 0.65 - floor)
        return (
          <mesh position={[0, -0.65 - h / 2, 0]}>
            <cylinderGeometry args={[0.05, 0.05, h, 8]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
        )
      })()}
    </group>
  )
}

function Wedge() {
  const pos = useAv((s) => s.mixer.wedgePos)
  const sel = useSelected('wedge')
  const w = GEO.wedge[pos]
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...w.axis)), [w])
  return (
    <group position={w.pos} quaternion={q} onClick={selectDevice('wedge')}>
      <mesh>
        <boxGeometry args={[0.6, 0.35, 0.45]} />
        <meshStandardMaterial color="#111827" emissive={sel ? '#22d3ee' : '#000'} emissiveIntensity={sel ? 0.5 : 0} />
      </mesh>
      <mesh position={[0, 0, 0.23]}>
        <planeGeometry args={[0.5, 0.28]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
    </group>
  )
}

function AmpRack() {
  const sel = useSelected('amp')
  const on = useAv((s) => s.mixer.ampOn)
  const protect = useAv((s) => s.live.levels.ampProtect.length > 0)
  const signal = useAv((s) => s.live.levels.mainDbfs != null && s.live.levels.paBoxes > 0)
  return (
    <group position={AMP_RACK} onClick={selectDevice('amp')}>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.6, 1.2, 1.0]} />
        <meshStandardMaterial color="#0f172a" emissive={sel ? '#22d3ee' : '#000'} emissiveIntensity={sel ? 0.4 : 0} />
      </mesh>
      {[
        ['#22c55e', on, 0.95],
        ['#facc15', on && signal, 0.85],
        ['#ef4444', on && protect, 0.75],
      ].map(([c, lit, y], i) => (
        <mesh key={i} position={[-0.31, y as number, 0.35]}>
          <boxGeometry args={[0.02, 0.05, 0.05]} />
          <meshBasicMaterial color={lit ? (c as string) : '#1f2937'} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function FohDesk() {
  const selM = useSelected('mixer')
  const selC = useSelected('console')
  const mixer = useAv((s) => s.mixer)
  const faderZ = (db: number) => ((Math.max(-60, db) + 60) / 70) * 0.3 - 0.15
  return (
    <group>
      <mesh position={[FOH[0], 0.45, FOH[2]]}>
        <boxGeometry args={[3.2, 0.9, 1.2]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <group position={MIXER_POS} onClick={selectDevice('mixer')}>
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[1.4, 0.08, 0.7]} />
          <meshStandardMaterial color="#1e293b" emissive={selM ? '#22d3ee' : '#000'} emissiveIntensity={selM ? 0.4 : 0} />
        </mesh>
        {[mixer.ch1.fader, mixer.ch2.fader, mixer.master].map((db, i) => (
          <mesh key={i} position={[-0.4 + i * 0.4, 0.1, faderZ(db) + 0.1]}>
            <boxGeometry args={[0.08, 0.04, 0.05]} />
            <meshStandardMaterial color={i === 2 ? '#ef4444' : '#e5e7eb'} />
          </mesh>
        ))}
        <mesh position={[0.55, 0.09, -0.15]}>
          <boxGeometry args={[0.04, 0.03, 0.04]} />
          <meshBasicMaterial color={mixer.mixerOn ? '#22c55e' : '#1f2937'} toneMapped={false} />
        </mesh>
      </group>
      <group position={CONSOLE_POS} onClick={selectDevice('console')}>
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[1.1, 0.08, 0.6]} />
          <meshStandardMaterial color="#312e81" emissive={selC ? '#22d3ee' : '#000'} emissiveIntensity={selC ? 0.4 : 0} />
        </mesh>
        <mesh position={[0, 0.09, -0.1]}>
          <boxGeometry args={[0.8, 0.02, 0.2]} />
          <meshBasicMaterial color="#a5b4fc" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

function Terminator() {
  const sel = useSelected('term')
  return (
    <group position={TERM_BOX} onClick={selectDevice('term')}>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.4, 0.2, 0.3]} />
        <meshStandardMaterial color="#7c3aed" emissive={sel ? '#22d3ee' : '#000'} emissiveIntensity={sel ? 0.6 : 0} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <planeGeometry args={[0.8, 0.2]} />
        <meshBasicMaterial map={labelTexture('Terminator 120Ω', { w: 512, h: 128, bg: '#3b0764' })} transparent toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ---------------- ports & cables ---------------- */
function PortTarget({ id }: { id: string }) {
  const mixer = useAv((s) => s.mixer)
  const mode = useAv((s) => s.mode)
  const isStart = useAv((s) => s.cableStart === id)
  const used = useAv((s) => s.cables.some((c) => c.from === id || c.to === id))
  const [hover, setHover] = useState(false)
  const pos = portPos(id, mixer)
  const fam = familyOf(PORTS[id].kind)
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  return (
    <group position={pos}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          useAv.getState().setHoverPort(id)
        }}
        onPointerOut={() => {
          setHover(false)
          useAv.getState().setHoverPort(null)
        }}
        onClick={(e) => {
          if (e.delta > 8) return
          const st = useAv.getState()
          if (st.mode !== 'cable') return
          e.stopPropagation()
          st.connect(id)
        }}
      >
        <sphereGeometry args={[coarse ? 0.2 : 0.13, 10, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh raycast={() => null}>
        <cylinderGeometry args={[0.05, 0.05, 0.05, 12]} />
        <meshBasicMaterial color={isStart ? '#facc15' : used ? '#64748b' : FAMILY_HEX[fam]} toneMapped={false} />
      </mesh>
      {(hover || isStart) && mode === 'cable' && (
        <Html position={[0, 0.25, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-md border border-fuchsia-400/60 bg-slate-950/90 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-100">
            {PORTS[id].label}
          </div>
        </Html>
      )}
    </group>
  )
}

function cableCurve(a: V3, b: V3) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  // long runs between floor-level gear are laid on the floor; runs along the truss just sag
  const far = A.distanceTo(B) > 3 && (A.y < 3 || B.y < 3)
  const pts = far
    ? [A, new THREE.Vector3(A.x, Math.max(0.05, A.y - 0.6), A.z), new THREE.Vector3(A.x, 0.04, A.z + (B.z - A.z) * 0.1), new THREE.Vector3(B.x, 0.04, B.z - (B.z - A.z) * 0.1), new THREE.Vector3(B.x, Math.max(0.05, B.y - 0.6), B.z), B]
    : [A, A.clone().lerp(B, 0.5).add(new THREE.Vector3(0, -Math.min(0.6, 0.15 + A.distanceTo(B) * 0.08), 0)), B]
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal')
}

function Cables() {
  const cables = useAv((s) => s.cables)
  const mixer = useAv((s) => s.mixer)
  const selected = useAv((s) => (s.selection?.kind === 'cable' ? s.selection.id : null))
  return (
    <group>
      {cables.map((c) => (
        <CableMesh key={c.id} id={c.id} a={portPos(c.from, mixer)} b={portPos(c.to, mixer)} color={FAMILY_HEX[familyOf(PORTS[c.from].kind) === 'dmx' || familyOf(PORTS[c.to].kind) === 'dmx' ? 'dmx' : familyOf(PORTS[c.from].kind)]} selected={selected === c.id} />
      ))}
    </group>
  )
}

function CableMesh({ id, a, b, color, selected }: { id: string; a: V3; b: V3; color: string; selected: boolean }) {
  const key = `${a.join()}|${b.join()}`
  const geo = useMemo(() => new THREE.TubeGeometry(cableCurve(a, b), 48, 0.03, 6, false), [key])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh
      geometry={geo}
      onClick={(e) => {
        if (e.delta > 8) return
        const st = useAv.getState()
        if (st.mode !== 'select') return
        e.stopPropagation()
        st.select({ kind: 'cable', id })
      }}
    >
      <meshStandardMaterial color={color} emissive={selected ? '#ffffff' : color} emissiveIntensity={selected ? 0.8 : 0.15} />
    </mesh>
  )
}

function CablePreview() {
  const start = useAv((s) => s.cableStart)
  const hover = useAv((s) => s.hoverPort)
  const mixer = useAv((s) => s.mixer)
  if (!start || !hover || hover === start) return null
  return <CableMesh id="preview" a={portPos(start, mixer)} b={portPos(hover, mixer)} color="#facc15" selected={false} />
}

function GuideBeacons() {
  const g = useAvGuideView((s) => s.g)
  const mixer = useAv((s) => s.mixer)
  const start = useAv((s) => s.cableStart)
  const step = g?.current
  if (!step) return null
  if (step.kind === 'cable' && step.cable)
    return (
      <group>
        {start !== step.cable.from && <Beacon pos={portPos(step.cable.from, mixer)} scale={1.8} />}
        {start !== step.cable.to && <Beacon pos={portPos(step.cable.to, mixer)} scale={1.8} />}
      </group>
    )
  if ((step.kind === 'address' || step.kind === 'color') && step.fixture) return <Beacon pos={[FIXTURE_POS[step.fixture][0], FIXTURE_POS[step.fixture][1] + 0.3, FIXTURE_POS[step.fixture][2]]} scale={2.4} />
  if (step.kind === 'select' && step.device) {
    const p = devicePos(step.device, mixer)
    return <Beacon pos={[p[0], p[1] + 0.5, p[2]]} scale={2.4} />
  }
  if (step.kind === 'move') {
    const p = GEO.wedge.front.pos
    return <Beacon pos={[p[0], p[1] + 0.3, p[2]]} scale={2} color="#34d399" />
  }
  return null
}

/* ---------------- scene ---------------- */
function Content({ quality }: { quality: 'low' | 'mid' | 'high' }) {
  return (
    <>
      <color attach="background" args={['#03050d']} />
      <fog attach="fog" args={['#03050d', 45, 95]} />
      {/* house / work lights so the venue is readable before any DMX is set */}
      <hemisphereLight args={['#c7d2fe', '#1e1b4b', 1.1]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 14, 16]} intensity={1.4} />
      <directionalLight position={[-6, 8, -2]} intensity={0.5} color="#c4b5fd" />
      <pointLight position={[0, 4, 13]} intensity={14} distance={10} color="#a5b4fc" />
      <pointLight position={[7, 3, 2]} intensity={8} distance={7} color="#e0e7ff" />
      <Venue />
      <LedWall />
      {(['par1', 'par2', 'par3', 'par4'] as const).map((p) => (
        <Par key={p} id={p} />
      ))}
      <Mover id="mover1" />
      <Mover id="mover2" />
      <Singer />
      <MicStand />
      <Speaker id="spkL" />
      <Speaker id="spkR" />
      <Wedge />
      <AmpRack />
      <FohDesk />
      <Terminator />
      {Object.keys(PORTS).map((p) => (
        <PortTarget key={p} id={p} />
      ))}
      <Cables />
      <CablePreview />
      <GuideBeacons />
      <CameraRig />
      {quality !== 'low' && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={quality === 'high' ? 1.1 : 0.8} luminanceThreshold={0.6} luminanceSmoothing={0.25} />
        </EffectComposer>
      )}
    </>
  )
}

export default function AvScene({ onReady }: { onReady?: () => void }) {
  const quality = useLab((s) => s.quality)
  const autoQuality = useLab((s) => s.autoQuality)
  const setAutoQuality = useLab((s) => s.setAutoQuality)
  const q = quality === 'auto' ? autoQuality : quality
  return (
    <Canvas
      dpr={q === 'low' ? [1, 1] : q === 'mid' ? [1, 1.5] : [1, 2]}
      camera={{ position: AV_CAMERAS.overview.pos, fov: 45, near: 0.1, far: 120 }}
      gl={{ antialias: q !== 'low', powerPreference: 'high-performance' }}
      onCreated={() => onReady?.()}
      onPointerMissed={() => {
        const st = useAv.getState()
        if (st.mode === 'select') st.select(null)
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
