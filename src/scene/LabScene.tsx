import { CameraControls, Html, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { CATALOG, type ComponentType, type LedColor, type ResistorValue } from '../engine/circuit/catalog'
import { useLab } from '../store/lab'
import { DataFlow } from './DataFlow'
import { GuideMarkers } from './GuideMarkers'
import { prefersReducedMotion, useInteract } from './interact'
import { CAMERAS } from './layout'
import { Breadboard, BoardModel } from './models/boards'
import { DeskFan, Heater, Lamp, Magnifier, Monitor, MultimeterDeco, Plant, PowerSupply, SolderingIron, Walker, WindowCurtain } from './models/modules'
import { PlacedParts } from './PlacedParts'
import { Room } from './Room'
import { Shelf } from './Shelf'

function CameraRig() {
  const ref = useRef<CameraControls>(null)
  const camera = useLab((s) => s.camera)
  const dragging = useInteract((s) => s.dragging)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    useInteract.getState().set({ controls: c })
    c.setBoundary(new THREE.Box3(new THREE.Vector3(-9, -0.5, -5), new THREE.Vector3(9, 4, 5)))
    const onStart = () => {
      const st = useLab.getState()
      if (!st.progress.tutorial.cam) st.tutorialFlag('cam')
    }
    c.addEventListener('controlstart', onStart)
    return () => c.removeEventListener('controlstart', onStart)
  }, [])
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const p = CAMERAS[camera.preset]
    // presets are framed for a landscape view; back off on narrow (portrait) viewports
    const k = Math.min(2.2, Math.max(1, 1.45 / aspect))
    const pos = p.pos.map((v, i) => p.target[i] + (v - p.target[i]) * k) as [number, number, number]
    void c.setLookAt(...pos, ...p.target, !prefersReducedMotion())
    // aspect deliberately left out: re-frame only when a preset is chosen, not on every resize
  }, [camera])
  useEffect(() => {
    if (ref.current) ref.current.enabled = !dragging
  }, [dragging])
  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={1.6}
      maxDistance={19}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.12}
      smoothTime={0.35}
      draggingSmoothTime={0.12}
    />
  )
}

/** Global pointer handling for drag-to-place from the shelf and drag-to-move parts. */
function DragController() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const el = gl.domElement
    const move = (e: PointerEvent) => {
      const ui = useInteract.getState()
      if (!ui.armed || ui.dragging) return
      if (Math.hypot(e.clientX - ui.armed.x, e.clientY - ui.armed.y) < 10) return
      const st = useLab.getState()
      if (ui.armed.kind === 'shelf') {
        const item = ui.armed.id as ComponentType
        const entry = CATALOG[item]
        if (!entry?.onBreadboard) {
          ui.set({ armed: null })
          if (ui.controls) ui.controls.enabled = true
          return
        }
        st.select({ kind: 'shelf', item })
        st.startPlacing({ type: item, variant: item === 'led' ? ('red' as LedColor) : item === 'resistor' ? (220 as ResistorValue) : undefined })
      } else {
        const comp = st.circuit.components.find((c) => c.id === ui.armed!.id)
        if (!comp || !comp.anchor) {
          ui.set({ armed: null })
          if (ui.controls) ui.controls.enabled = true
          return
        }
        st.startPlacing({ type: comp.type, variant: comp.variant, moveId: comp.id })
      }
      ui.set({ dragging: true, ghostAnchor: null })
    }
    const up = () => {
      const ui = useInteract.getState()
      if (ui.dragging) {
        const st = useLab.getState()
        const placed = ui.ghostAnchor ? st.placeAt(ui.ghostAnchor) : false
        if (!placed) st.startPlacing(null)
      }
      if (ui.controls) ui.controls.enabled = true
      ui.set({ armed: null, dragging: false, ghostAnchor: null })
    }
    el.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl])
  return null
}

function HoverLabel() {
  const label = useInteract((s) => s.hoverLabel)
  if (!label) return null
  return (
    <Html position={label.pos} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
      <div className="whitespace-nowrap rounded-md border border-cyan-400/60 bg-slate-950/90 px-2 py-1 text-xs font-semibold text-cyan-100 shadow-lg">{label.text}</div>
    </Html>
  )
}

function SceneContent({ quality }: { quality: 'low' | 'mid' | 'high' }) {
  const shadows = quality === 'high'
  return (
    <>
      <color attach="background" args={['#050b1f']} />
      <fog attach="fog" args={['#050b1f', 18, 40]} />
      <hemisphereLight args={['#9cc8ff', '#0b1226', 0.55]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[-4, 10, 6]}
        intensity={1.5}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0004}
      />
      <pointLight position={[-6, 4, -4]} color="#22d3ee" intensity={8} distance={10} />
      <pointLight position={[6, 4, -4]} color="#6366f1" intensity={8} distance={10} />
      <Room />
      <Shelf />
      <Breadboard />
      <BoardModel />
      <PlacedParts />
      <Heater />
      <Lamp />
      <DeskFan />
      <Plant />
      <Monitor />
      <PowerSupply />
      <MultimeterDeco />
      <SolderingIron />
      <Magnifier />
      <WindowCurtain />
      <Walker />
      <DataFlow />
      <GuideMarkers />
      <HoverLabel />
      <CameraRig />
      <DragController />
      {quality !== 'low' && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={quality === 'high' ? 0.9 : 0.7} luminanceThreshold={0.85} luminanceSmoothing={0.2} />
        </EffectComposer>
      )}
    </>
  )
}

export default function LabScene({ onReady }: { onReady?: () => void }) {
  const quality = useLab((s) => s.quality)
  const autoQuality = useLab((s) => s.autoQuality)
  const setAutoQuality = useLab((s) => s.setAutoQuality)
  const q = quality === 'auto' ? autoQuality : quality
  const dpr: [number, number] = q === 'low' ? [1, 1] : q === 'mid' ? [1, 1.5] : [1, 2]
  return (
    <Canvas
      shadows={q === 'high'}
      dpr={dpr}
      camera={{ position: CAMERAS.overview.pos, fov: 45, near: 0.1, far: 80 }}
      gl={{ antialias: q !== 'low', powerPreference: 'high-performance' }}
      onCreated={() => onReady?.()}
      onPointerMissed={() => {
        const st = useLab.getState()
        if (st.mode === 'select' && !st.placing) st.select(null)
        useInteract.getState().set({ hoverLabel: null })
      }}
      style={{ touchAction: 'none' }}
    >
      <PerformanceMonitor
        onDecline={() => quality === 'auto' && setAutoQuality(autoQuality === 'high' ? 'mid' : 'low')}
        onIncline={() => quality === 'auto' && autoQuality === 'low' && setAutoQuality('mid')}
        flipflops={3}
        onFallback={() => quality === 'auto' && setAutoQuality('low')}
      />
      <SceneContent quality={q} />
    </Canvas>
  )
}
