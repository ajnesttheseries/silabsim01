import { useMemo } from 'react'
import { DESK } from './layout'
import { canvasTexture, signTexture } from './textures'

function matTexture() {
  return canvasTexture('esd-mat', 1024, 640, (g, w, h) => {
    g.fillStyle = '#123a6b'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = 'rgba(147,197,253,0.18)'
    g.lineWidth = 2
    for (let x = 0; x < w; x += 32) {
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x, h)
      g.stroke()
    }
    for (let y = 0; y < h; y += 32) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(w, y)
      g.stroke()
    }
    g.fillStyle = 'rgba(191,219,254,0.5)'
    g.font = '700 28px system-ui'
    g.fillText('ESD SAFE  ⏚', 20, h - 20)
  })
}

export function Room() {
  const sign = useMemo(signTexture, [])
  const mat = useMemo(matTexture, [])
  const floorY = DESK.floorY
  return (
    <group>
      {/* floor */}
      <mesh position={[0, floorY, 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[26, 22]} />
        <meshStandardMaterial color="#0a1226" roughness={0.9} />
      </mesh>
      {/* walls */}
      <mesh position={[0, 0.5, -6.2]} receiveShadow>
        <planeGeometry args={[26, 16]} />
        <meshStandardMaterial color="#0c1a3a" roughness={0.95} />
      </mesh>
      <mesh position={[-12.5, 0.5, 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[22, 16]} />
        <meshStandardMaterial color="#0b1633" roughness={0.95} />
      </mesh>
      <mesh position={[12, 0.5, 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[22, 16]} />
        <meshStandardMaterial color="#0b1633" roughness={0.95} />
      </mesh>
      {/* sign */}
      <mesh position={[0, 5.4, -6.15]}>
        <planeGeometry args={[11, 1.93]} />
        <meshBasicMaterial map={sign} transparent toneMapped={false} />
      </mesh>
      {/* neon strips */}
      {[7.4, -3.6].map((y) => (
        <mesh key={y} position={[0, y, -6.1]}>
          <boxGeometry args={[25, 0.05, 0.05]} />
          <meshBasicMaterial color="#22d3ee" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[11.95, -3.6, 2]}>
        <boxGeometry args={[0.05, 0.05, 20]} />
        <meshBasicMaterial color="#6366f1" toneMapped={false} />
      </mesh>
      {/* desk */}
      <mesh position={[0, -DESK.thickness / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[DESK.w, DESK.thickness, DESK.d]} />
        <meshStandardMaterial color="#1f2a44" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, -DESK.thickness + 0.02, DESK.d / 2 + 0.01]}>
        <boxGeometry args={[DESK.w, 0.04, 0.02]} />
        <meshBasicMaterial color="#38bdf8" toneMapped={false} />
      </mesh>
      {[-7.6, 7.6].map((x) =>
        [-3.6, 3.6].map((z) => (
          <mesh key={`${x}${z}`} position={[x, (floorY - DESK.thickness) / 2, z]} castShadow>
            <boxGeometry args={[0.3, -floorY - DESK.thickness, 0.3]} />
            <meshStandardMaterial color="#111827" metalness={0.6} />
          </mesh>
        )),
      )}
      {/* anti-static mat */}
      <mesh position={[-0.9, 0.006, 0.85]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8.6, 5.2]} />
        <meshStandardMaterial map={mat} roughness={0.95} />
      </mesh>
    </group>
  )
}
