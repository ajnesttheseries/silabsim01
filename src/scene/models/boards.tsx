/** Breadboard, microcontroller board, pin targets and wires. */
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BB_COLS, BB_ROWS, stripOf, allHoles } from '../../engine/circuit/breadboard'
import { BOARD_PINS } from '../../engine/circuit/board'
import type { Wire } from '../../engine/circuit/netlist'
import { useLab } from '../../store/lab'
import { useInteract } from '../interact'
import { BB, BB_DEPTH, BB_WIDTH, BOARD, boardPinPos, colX, holePos, nearestAnchor, nearestHole, rowZ, USB_PORT, type V3 } from '../layout'
import { boardTexture, canvasTexture, MONO } from '../textures'

export const WIRE_HEX: Record<Wire['color'], string> = {
  red: '#ef4444',
  black: '#1f2937',
  yellow: '#facc15',
  green: '#22c55e',
  blue: '#3b82f6',
  orange: '#fb923c',
  white: '#e5e7eb',
}

/* ---------------- Breadboard ---------------- */

function breadboardTexture() {
  const px = 520
  const cw = Math.round(BB_WIDTH * px)
  const ch = Math.round(BB_DEPTH * px)
  const x0 = BB.cx - BB_WIDTH / 2
  const z0 = BB.cz - BB_DEPTH / 2
  const u = (x: number) => (x - x0) * px
  const v = (z: number) => (z - z0) * px
  return canvasTexture('breadboard', cw, ch, (g) => {
    g.fillStyle = '#f4f1ea'
    g.fillRect(0, 0, cw, ch)
    // centre channel
    g.fillStyle = '#d9d4c7'
    g.fillRect(0, v(BB.cz) - 0.25 * BB.pitch * px, cw, 0.5 * BB.pitch * px)
    // rail lines
    const line = (z: number, col: string) => {
      g.fillStyle = col
      g.fillRect(u(colX(1)) - 20, v(z) - 4, u(colX(BB_COLS)) - u(colX(1)) + 40, 8)
    }
    line(rowZ('tp') - 0.55 * BB.pitch, '#dc2626')
    line(rowZ('tn') + 0.55 * BB.pitch, '#2563eb')
    line(rowZ('bn') - 0.55 * BB.pitch, '#2563eb')
    line(rowZ('bp') + 0.55 * BB.pitch, '#dc2626')
    g.font = `700 ${0.42 * BB.pitch * px}px ${MONO}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = '#dc2626'
    g.fillText('+', u(colX(1)) - 0.85 * BB.pitch * px, v(rowZ('tp')))
    g.fillText('+', u(colX(1)) - 0.85 * BB.pitch * px, v(rowZ('bp')))
    g.fillStyle = '#2563eb'
    g.fillText('−', u(colX(1)) - 0.85 * BB.pitch * px, v(rowZ('tn')))
    g.fillText('−', u(colX(1)) - 0.85 * BB.pitch * px, v(rowZ('bn')))
    // holes
    const hs = 0.36 * BB.pitch * px
    g.fillStyle = '#3b3b3b'
    for (const h of allHoles()) {
      const p = holePos(h)!
      g.fillRect(u(p[0]) - hs / 2, v(p[2]) - hs / 2, hs, hs)
    }
    // row letters + column numbers
    g.fillStyle = '#6b7280'
    g.font = `600 ${0.36 * BB.pitch * px}px ${MONO}`
    for (const r of BB_ROWS) g.fillText(r.toUpperCase(), u(colX(1)) - 0.85 * BB.pitch * px, v(rowZ(r)))
    for (let c = 1; c <= BB_COLS; c++) {
      if (c === 1 || c % 5 === 0) {
        g.fillText(String(c), u(colX(c)), v(rowZ('a')) - 0.62 * BB.pitch * px)
        g.fillText(String(c), u(colX(c)), v(rowZ('j')) + 0.62 * BB.pitch * px)
      }
    }
  })
}

export function Breadboard() {
  const tex = useMemo(breadboardTexture, [])
  const mode = useLab((s) => s.mode)
  const placing = useLab((s) => s.placing)
  const hoverNode = useLab((s) => s.hoverNode)
  const highlightNodes = useLab((s) => s.highlight.nodes)
  const wireStart = useLab((s) => s.wireStart)
  const occupied = useLab((s) => s.report.netlist.occupied)

  // strip highlight for the hovered hole: teaches internal connections
  const stripHoles = useMemo(() => {
    if (!hoverNode?.startsWith('bb:') || placing) return []
    const s = stripOf(hoverNode)
    return allHoles().filter((h) => stripOf(h) === s)
  }, [hoverNode, placing])

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const { x, z } = e.point
    const ui = useInteract.getState()
    if (placing) {
      const a = nearestAnchor(x, z) ?? null
      if (a !== ui.ghostAnchor) ui.set({ ghostAnchor: a })
      return
    }
    useLab.getState().setHover(nearestHole(x, z) ?? null)
    ui.set({ pointer: [x, BB.top + 0.15, z] })
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8) return
    const st = useLab.getState()
    if (st.placing) {
      e.stopPropagation()
      const a = nearestAnchor(e.point.x, e.point.z)
      if (a) st.placeAt(a)
      return
    }
    if (st.mode === 'wire' || st.mode === 'measure') {
      e.stopPropagation()
      const h = nearestHole(e.point.x, e.point.z)
      if (h) st.tapNode(h)
      return
    }
    e.stopPropagation()
    st.select({ kind: 'scene', item: 'breadboard' })
  }

  return (
    <group>
      <mesh position={[BB.cx, BB.baseH / 2, BB.cz]} castShadow receiveShadow>
        <boxGeometry args={[BB_WIDTH, BB.baseH, BB_DEPTH]} />
        <meshStandardMaterial color="#ece8de" roughness={0.8} />
      </mesh>
      <mesh
        position={[BB.cx, BB.top + 0.001, BB.cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={onMove}
        onPointerOut={() => useLab.getState().setHover(null)}
        onClick={onClick}
      >
        <planeGeometry args={[BB_WIDTH, BB_DEPTH]} />
        <meshStandardMaterial map={tex} roughness={0.75} />
      </mesh>
      <HoleMarks holes={stripHoles} color="#22d3ee" />
      <HoleMarks holes={highlightNodes.filter((n) => n.startsWith('bb:'))} color="#ff4d4d" />
      {wireStart?.startsWith('bb:') && <HoleMarks holes={[wireStart]} color="#facc15" size={1.6} />}
      {(mode === 'wire' || mode === 'measure') && hoverNode?.startsWith('bb:') && (
        <HoleMarks holes={[hoverNode]} color={occupied[hoverNode] ? '#f87171' : '#ffffff'} size={1.4} />
      )}
    </group>
  )
}

function HoleMarks({ holes, color, size = 1 }: { holes: string[]; color: string; size?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const max = 32
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    holes.slice(0, max).forEach((h, i) => {
      const p = holePos(h)!
      o.position.set(p[0], p[1] + 0.004, p[2])
      o.rotation.set(-Math.PI / 2, 0, 0)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.count = Math.min(max, holes.length)
    m.instanceMatrix.needsUpdate = true
  }, [holes])
  if (!holes.length) return null
  const s = BB.pitch * 0.62 * size
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, max]} raycast={() => null}>
      <ringGeometry args={[s * 0.45, s * 0.6, 4, 1, Math.PI / 4]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
    </instancedMesh>
  )
}

/* ---------------- Pin target (board / module pins) ---------------- */

export function PinTarget({ node, pos, label, size = 0.09 }: { node: string; pos: V3; label: string; size?: number }) {
  const mode = useLab((s) => s.mode)
  const isStart = useLab((s) => s.wireStart === node)
  const hover = useLab((s) => s.hoverNode === node)
  const hl = useLab((s) => s.highlight.nodes.includes(node))
  const active = mode === 'wire' || mode === 'measure'
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  const hit = coarse ? size * 2.1 : size * 1.5
  return (
    <group position={pos}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          useLab.getState().setHover(node)
          useInteract.getState().set({ hoverLabel: { text: label, pos: [pos[0], pos[1] + 0.25, pos[2]] }, pointer: pos })
        }}
        onPointerOut={() => {
          useLab.getState().setHover(null)
          useInteract.getState().set({ hoverLabel: null })
        }}
        onClick={(e) => {
          if (e.delta > 8) return
          const st = useLab.getState()
          if (st.placing) return
          e.stopPropagation()
          if (st.mode === 'select') {
            useInteract.getState().set({ hoverLabel: { text: label, pos: [pos[0], pos[1] + 0.25, pos[2]] } })
            return
          }
          st.tapNode(node)
        }}
      >
        <boxGeometry args={[hit, hit * 1.2, hit]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {(isStart || hl || (active && hover)) && (
        <mesh position={[0, 0.06, 0]} raycast={() => null}>
          <sphereGeometry args={[size * 0.75, 12, 8]} />
          <meshBasicMaterial color={isStart ? '#facc15' : hl ? '#ff4d4d' : '#ffffff'} toneMapped={false} transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  )
}

export function HeaderPin({ pos }: { pos: V3 }) {
  return (
    <group position={pos}>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.07, 0.06, 0.07]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.022, 0.12, 0.022]} />
        <meshStandardMaterial color="#e5b842" metalness={0.9} roughness={0.25} />
      </mesh>
    </group>
  )
}

/* ---------------- Microcontroller board ---------------- */

export function BoardModel() {
  const tex = useMemo(() => boardTexture(BOARD.w, BOARD.l), [])
  const powered = useLab((s) => s.simView.powered)
  const usb = useLab((s) => s.circuit.usbConnected)
  const selected = useLab((s) => s.selection?.kind === 'scene' && s.selection.item === 'board')
  const pwrLed = useRef<THREE.MeshStandardMaterial>(null)
  const txLed = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (pwrLed.current) pwrLed.current.emissiveIntensity = powered ? 3 : 0
    if (txLed.current) txLed.current.emissiveIntensity = powered && Math.sin(clock.elapsedTime * 6.3) > 0.85 ? 4 : 0
  })
  return (
    <group>
      <group
        onClick={(e) => {
          if (e.delta > 8) return
          const st = useLab.getState()
          if (st.mode !== 'select' || st.placing) return
          e.stopPropagation()
          st.select({ kind: 'scene', item: 'board' })
        }}
      >
        <mesh position={[BOARD.cx, BOARD.h / 2, BOARD.cz]} castShadow receiveShadow>
          <boxGeometry args={[BOARD.w, BOARD.h * 0.25, BOARD.l]} />
          <meshStandardMaterial color="#0d3b2e" emissive={selected ? '#22d3ee' : '#000'} emissiveIntensity={selected ? 0.25 : 0} />
        </mesh>
        {/* stand-offs so the board sits on its headers like on a desk */}
        <mesh position={[BOARD.cx, BOARD.h * 0.25, BOARD.cz]}>
          <boxGeometry args={[BOARD.w * 0.9, BOARD.h * 0.5, BOARD.l * 0.9]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        <mesh position={[BOARD.cx, BOARD.h * 0.63 + 0.001, BOARD.cz]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[BOARD.w, BOARD.l]} />
          <meshStandardMaterial map={tex} roughness={0.6} />
        </mesh>
        {/* RF shield module + antenna */}
        <mesh position={[BOARD.cx, BOARD.h * 0.63 + 0.05, BOARD.cz + 0.45]} castShadow>
          <boxGeometry args={[0.55, 0.1, 0.75]} />
          <meshStandardMaterial color="#c0c6cf" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[BOARD.cx, BOARD.h * 0.63 + 0.012, BOARD.cz + 1.0]}>
          <boxGeometry args={[0.55, 0.02, 0.25]} />
          <meshStandardMaterial color="#14532d" />
        </mesh>
        {/* USB port */}
        <mesh position={USB_PORT}>
          <boxGeometry args={[0.26, 0.1, 0.2]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.3} />
        </mesh>
        {/* status LEDs */}
        <mesh position={[BOARD.cx - 0.2, BOARD.h * 0.63 + 0.02, BOARD.cz - 1.1]}>
          <boxGeometry args={[0.06, 0.03, 0.04]} />
          <meshStandardMaterial ref={pwrLed} color="#ff3b3b" emissive="#ff3b3b" emissiveIntensity={0} toneMapped={false} />
        </mesh>
        <mesh position={[BOARD.cx + 0.2, BOARD.h * 0.63 + 0.02, BOARD.cz - 1.1]}>
          <boxGeometry args={[0.06, 0.03, 0.04]} />
          <meshStandardMaterial ref={txLed} color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0} toneMapped={false} />
        </mesh>
      </group>
      {BOARD_PINS.map((p) => {
        const pos = boardPinPos(p.id)!
        const cap = p.power
          ? p.id.startsWith('GND')
            ? 'GND (กราวด์)'
            : p.power === '5V'
              ? '5V (จาก USB)'
              : '3V3 (ไฟเลี้ยง 3.3V)'
          : `GPIO${p.gpio}${p.adc ? ` · ${p.adc}` : ''}${p.output ? '' : ' · รับเข้าอย่างเดียว'}`
        return (
          <group key={p.id}>
            <HeaderPin pos={[pos[0], pos[1] - 0.02, pos[2]]} />
            <PinTarget node={`mcu:${p.id}`} pos={pos} label={cap} />
          </group>
        )
      })}
      {usb && <UsbCable />}
    </group>
  )
}

function UsbCable() {
  const geo = useMemo(() => {
    const pts = [
      new THREE.Vector3(USB_PORT[0], USB_PORT[1], USB_PORT[2] - 0.1),
      new THREE.Vector3(USB_PORT[0], USB_PORT[1], USB_PORT[2] - 0.7),
      new THREE.Vector3(USB_PORT[0] - 0.8, 0.05, USB_PORT[2] - 2.2),
      new THREE.Vector3(USB_PORT[0] - 0.6, 0.05, -3.9),
      new THREE.Vector3(USB_PORT[0] - 0.6, -0.8, -4.1),
    ]
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.035, 8, false)
  }, [])
  return (
    <group>
      <mesh position={[USB_PORT[0], USB_PORT[1], USB_PORT[2] - 0.18]}>
        <boxGeometry args={[0.3, 0.14, 0.26]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#111827" roughness={0.6} />
      </mesh>
    </group>
  )
}

/* ---------------- Wires ---------------- */

export function wireCurve(a: V3, b: V3) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const d = A.distanceTo(B)
  const lift = 0.12 + Math.min(1.1, d * 0.22)
  const top = Math.max(A.y, B.y) + lift
  const pts = [
    A,
    new THREE.Vector3(A.x, A.y + 0.08, A.z),
    new THREE.Vector3(A.x + (B.x - A.x) * 0.25, top, A.z + (B.z - A.z) * 0.25),
    new THREE.Vector3(A.x + (B.x - A.x) * 0.75, top, A.z + (B.z - A.z) * 0.75),
    new THREE.Vector3(B.x, B.y + 0.08, B.z),
    B,
  ]
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal')
}

export function WireModel({ wire, a, b, selected }: { wire: Wire; a: V3; b: V3; selected: boolean }) {
  const key = `${a.join(',')}|${b.join(',')}`
  const geo = useMemo(() => new THREE.TubeGeometry(wireCurve(a, b), 40, 0.024, 6, false), [key])
  useEffect(() => () => geo.dispose(), [geo])
  const hex = WIRE_HEX[wire.color]
  return (
    <group>
      <mesh
        geometry={geo}
        castShadow
        onClick={(e) => {
          if (e.delta > 8) return
          const st = useLab.getState()
          if (st.mode !== 'select' || st.placing) return
          e.stopPropagation()
          st.select({ kind: 'wire', id: wire.id })
        }}
      >
        <meshStandardMaterial color={hex} roughness={0.45} emissive={selected ? '#22d3ee' : '#000'} emissiveIntensity={selected ? 0.9 : 0} />
      </mesh>
      {[a, b].map((p, i) => (
        <mesh key={i} position={[p[0], p[1] + 0.05, p[2]]} raycast={() => null}>
          <boxGeometry args={[0.045, 0.1, 0.045]} />
          <meshStandardMaterial color={hex} />
        </mesh>
      ))}
    </group>
  )
}

/** Live preview while choosing the second end of a wire. */
export function WirePreview({ from, color }: { from: V3; color: Wire['color'] }) {
  const ref = useRef<THREE.Mesh>(null)
  const last = useRef<string>('')
  useFrame(() => {
    const m = ref.current
    const p = useInteract.getState().pointer
    if (!m || !p) return
    const key = p.join(',')
    if (key === last.current) return
    last.current = key
    m.geometry.dispose()
    m.geometry = new THREE.TubeGeometry(wireCurve(from, p), 24, 0.018, 5, false)
  })
  return (
    <mesh ref={ref} raycast={() => null}>
      <tubeGeometry args={[wireCurve(from, [from[0] + 0.01, from[1], from[2]]), 4, 0.018, 5, false]} />
      <meshBasicMaterial color={WIRE_HEX[color]} transparent opacity={0.6} />
    </mesh>
  )
}
