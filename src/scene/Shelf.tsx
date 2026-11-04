import type { ThreeEvent } from '@react-three/fiber'
import { CATALOG, type ShelfItem } from '../engine/circuit/catalog'
import { useLab } from '../store/lab'
import { useGuideView } from '../ui/guide'
import { Beacon } from './GuideMarkers'
import { useInteract } from './interact'
import { BIN_W, binPos, SHELF, SHELF_ORDER } from './layout'
import { LED_HEX } from './models/parts'
import { labelTexture } from './textures'

function Mini({ item }: { item: ShelfItem }) {
  switch (item) {
    case 'board':
      return (
        <group>
          <mesh position={[0, 0.05, 0]} rotation={[0, 0.3, 0]}>
            <boxGeometry args={[0.32, 0.04, 0.6]} />
            <meshStandardMaterial color="#0d3b2e" />
          </mesh>
          <mesh position={[0, 0.1, 0.1]} rotation={[0, 0.3, 0]}>
            <boxGeometry args={[0.18, 0.05, 0.22]} />
            <meshStandardMaterial color="#c0c6cf" metalness={0.8} />
          </mesh>
        </group>
      )
    case 'breadboard':
      return (
        <mesh position={[0, 0.06, 0]} rotation={[0, 0.2, 0]}>
          <boxGeometry args={[0.62, 0.08, 0.36]} />
          <meshStandardMaterial color="#f4f1ea" />
        </mesh>
      )
    case 'jumper':
      return (
        <group position={[0, 0.12, 0]}>
          {['#ef4444', '#1f2937', '#facc15', '#22c55e', '#3b82f6'].map((c, i) => (
            <mesh key={c} position={[(i - 2) * 0.07, 0, 0]} rotation={[0, 0, 0]}>
              <torusGeometry args={[0.13, 0.012, 6, 20, Math.PI]} />
              <meshStandardMaterial color={c} />
            </mesh>
          ))}
        </group>
      )
    case 'usb':
      return (
        <group position={[0, 0.05, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.16, 0.025, 8, 24]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          <mesh position={[0.2, 0.02, 0]}>
            <boxGeometry args={[0.1, 0.05, 0.07]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.8} />
          </mesh>
        </group>
      )
    case 'led':
      return (
        <group position={[0, 0.12, 0]}>
          {(['red', 'green', 'blue'] as const).map((c, i) => (
            <mesh key={c} position={[(i - 1) * 0.15, 0, 0]}>
              <capsuleGeometry args={[0.05, 0.08, 4, 10]} />
              <meshStandardMaterial color={LED_HEX[c]} emissive={LED_HEX[c]} emissiveIntensity={0.4} transparent opacity={0.9} />
            </mesh>
          ))}
        </group>
      )
    case 'resistor':
      return (
        <group position={[0, 0.08, 0]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0, (i - 1) * 0.12]} rotation={[0, 0, Math.PI / 2]}>
              <capsuleGeometry args={[0.035, 0.18, 4, 10]} />
              <meshStandardMaterial color="#d8c49a" />
            </mesh>
          ))}
        </group>
      )
    case 'multimeter':
      return (
        <mesh position={[0, 0.1, 0]} rotation={[-0.3, 0.2, 0]}>
          <boxGeometry args={[0.3, 0.12, 0.48]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>
      )
    case 'dht':
      return (
        <group position={[0, 0.15, 0]}>
          <mesh>
            <boxGeometry args={[0.22, 0.26, 0.09]} />
            <meshStandardMaterial color="#f1f5f9" />
          </mesh>
          <mesh position={[0, -0.15, 0]}>
            <boxGeometry args={[0.26, 0.03, 0.06]} />
            <meshStandardMaterial color="#1d4ed8" />
          </mesh>
        </group>
      )
    case 'ldr':
      return (
        <mesh position={[0, 0.1, 0]} rotation={[0.6, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.04, 20]} />
          <meshStandardMaterial color="#e8d6a0" />
        </mesh>
      )
    case 'soil':
      return (
        <mesh position={[0, 0.2, 0]} rotation={[0, 0.4, 0.15]}>
          <boxGeometry args={[0.14, 0.42, 0.02]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      )
    case 'pir':
      return (
        <group position={[0, 0.06, 0]}>
          <mesh>
            <boxGeometry args={[0.3, 0.04, 0.3]} />
            <meshStandardMaterial color="#15803d" />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <sphereGeometry args={[0.12, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
        </group>
      )
    case 'buzzer':
      return (
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.1, 20]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
      )
    case 'driver':
      return (
        <group position={[0, 0.05, 0]}>
          <mesh>
            <boxGeometry args={[0.4, 0.03, 0.36]} />
            <meshStandardMaterial color="#b91c1c" />
          </mesh>
          <mesh position={[0, 0.06, 0.12]}>
            <boxGeometry args={[0.24, 0.08, 0.08]} />
            <meshStandardMaterial color="#2563eb" />
          </mesh>
        </group>
      )
    case 'fan':
      return (
        <group position={[0, 0.2, 0]} rotation={[0, 0.3, 0]}>
          <mesh>
            <boxGeometry args={[0.36, 0.36, 0.08]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          <mesh position={[0, 0, 0.045]}>
            <circleGeometry args={[0.15, 20]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
        </group>
      )
  }
}

function Bin({ item, index }: { item: ShelfItem; index: number }) {
  const p = binPos(index)
  const selected = useLab((s) => s.selection?.kind === 'shelf' && s.selection.item === item)
  const found = useLab((s) => s.progress.found.includes(item))
  const guideHere = useGuideView((s) => s.g?.current?.shelf === item)
  const lbl = labelTexture(CATALOG[item].nameTh, { w: 512, h: 128, bg: found ? '#0b3b5c' : '#0e2247' })
  const w = BIN_W * 0.9
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    const st = useLab.getState()
    if (st.mode !== 'select' || st.placing) return
    e.stopPropagation()
    const ui = useInteract.getState()
    ui.set({ armed: { kind: 'shelf', id: item, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } })
    if (ui.controls) ui.controls.enabled = false
  }
  return (
    <group position={p}>
      <group
        onPointerDown={onDown}
        onClick={(e) => {
          if (e.delta > 8) return
          const st = useLab.getState()
          if (st.placing) return
          e.stopPropagation()
          st.select({ kind: 'shelf', item })
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        {/* open bin */}
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <boxGeometry args={[w, 0.04, SHELF.depth * 0.8]} />
          <meshStandardMaterial color={selected ? '#155e75' : '#1e3a5f'} emissive={selected ? '#22d3ee' : '#000'} emissiveIntensity={selected ? 0.35 : 0} />
        </mesh>
        <mesh position={[0, 0.12, SHELF.depth * 0.4]}>
          <boxGeometry args={[w, 0.22, 0.03]} />
          <meshStandardMaterial color="#1e40af" />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[(s * w) / 2, 0.1, 0]}>
            <boxGeometry args={[0.03, 0.18, SHELF.depth * 0.8]} />
            <meshStandardMaterial color="#1e40af" />
          </mesh>
        ))}
        <Mini item={item} />
        {/* big invisible hit area for touch */}
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[w, 0.5, SHELF.depth * 0.8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      <mesh position={[0, 0.13, SHELF.depth * 0.42]}>
        <planeGeometry args={[w * 0.95, w * 0.24]} />
        <meshBasicMaterial map={lbl} toneMapped={false} />
      </mesh>
      {guideHere && <Beacon pos={[0, 0.1, SHELF.depth * 0.3]} scale={1.3} />}
      {found && (
        <mesh position={[w * 0.4, 0.3, SHELF.depth * 0.42]}>
          <sphereGeometry args={[0.05, 10, 8]} />
          <meshBasicMaterial color="#34d399" toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

export function Shelf() {
  const x = (SHELF.x0 + SHELF.x1) / 2
  const width = SHELF.x1 - SHELF.x0 + 0.2
  const title = labelTexture('ชั้นวางอุปกรณ์', { sub: 'Component Shelf', w: 640, h: 180 })
  return (
    <group>
      {/* hutch frame */}
      {[SHELF.x0 - 0.1, SHELF.x1 + 0.1].map((sx) => (
        <mesh key={sx} position={[sx, 1.6, SHELF.z]} castShadow>
          <boxGeometry args={[0.12, 3.2, SHELF.depth]} />
          <meshStandardMaterial color="#0f2347" />
        </mesh>
      ))}
      <mesh position={[x, 1.6, SHELF.z - SHELF.depth / 2]}>
        <boxGeometry args={[width, 3.2, 0.06]} />
        <meshStandardMaterial color="#0b1a36" />
      </mesh>
      {SHELF.tiers.map((y) => (
        <mesh key={y} position={[x, y - 0.03, SHELF.z]} receiveShadow>
          <boxGeometry args={[width, 0.06, SHELF.depth]} />
          <meshStandardMaterial color="#13305e" />
        </mesh>
      ))}
      {/* neon edge */}
      <mesh position={[x, 3.2, SHELF.z + SHELF.depth / 2]}>
        <boxGeometry args={[width, 0.04, 0.04]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} />
      </mesh>
      <mesh position={[x, 2.95, SHELF.z - SHELF.depth / 2 + 0.05]}>
        <planeGeometry args={[2.2, 0.62]} />
        <meshBasicMaterial map={title} toneMapped={false} />
      </mesh>
      {SHELF_ORDER.map((item, i) => (
        <Bin key={item} item={item} index={i} />
      ))}
    </group>
  )
}
