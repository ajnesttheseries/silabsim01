/** 2D schematic generated from the current netlist (bus style: one vertical bus per net). */
import type { ReactElement } from 'react'
import { CATALOG, componentName, formatOhms, pinNode, type PlacedComponent } from '../../engine/circuit/catalog'
import type { Net } from '../../engine/circuit/netlist'
import { useLab } from '../../store/lab'

const NET_COLOR = (n: string) => (n === 'GND' ? '#94a3b8' : n === '3V3' ? '#f87171' : n === '5V' ? '#fb923c' : n.startsWith('GPIO') ? '#facc15' : '#38bdf8')

function netName(net: Net, idx: number) {
  if (net.hasGnd) return 'GND'
  if (net.has5v) return '5V'
  if (net.has3v3) return '3V3'
  if (net.gpios.length) return `GPIO${net.gpios[0].gpio}`
  return `N${idx}`
}

function Symbol({ c, x, y, h }: { c: PlacedComponent; x: number; y: number; h: number }) {
  const s = '#e2e8f0'
  const mid = y + h / 2
  switch (c.type) {
    case 'led':
      return (
        <g stroke={s} fill="none" strokeWidth={2}>
          <line x1={x} y1={y} x2={x} y2={mid - 12} />
          <path d={`M${x - 10} ${mid - 12} L${x + 10} ${mid - 12} L${x} ${mid + 6} Z`} fill={c.variant === 'green' ? '#22c55e' : c.variant === 'blue' ? '#3b82f6' : '#ef4444'} />
          <line x1={x - 10} y1={mid + 6} x2={x + 10} y2={mid + 6} />
          <line x1={x} y1={mid + 6} x2={x} y2={y + h} />
          <path d={`M${x + 12} ${mid - 8} l8 -8 M${x + 16} ${mid - 2} l8 -8`} />
        </g>
      )
    case 'resistor':
    case 'ldr': {
      const z = [0, 1, 2, 3, 4, 5].map((i) => `${x + (i % 2 ? 7 : -7)} ${mid - 15 + i * 6}`).join(' L')
      return (
        <g stroke={s} fill="none" strokeWidth={2}>
          <line x1={x} y1={y} x2={x} y2={mid - 18} />
          <path d={`M${x} ${mid - 18} L${z} L${x} ${mid + 18}`} />
          <line x1={x} y1={mid + 18} x2={x} y2={y + h} />
          {c.type === 'ldr' && <path d={`M${x - 26} ${mid - 16} l12 10 M${x - 26} ${mid - 4} l12 10`} stroke="#fde047" />}
        </g>
      )
    }
    default:
      return (
        <g>
          <rect x={x - 22} y={y + 4} width={44} height={h - 8} rx={6} fill="#0f1f47" stroke={s} strokeWidth={2} />
          {c.type === 'fan' && (
            <text x={x} y={mid + 5} fill={s} fontSize={16} textAnchor="middle" fontWeight={700}>
              M
            </text>
          )}
        </g>
      )
  }
}

export function Schematic() {
  const circuit = useLab((s) => s.circuit)
  const nl = useLab((s) => s.report.netlist)
  const comps = circuit.components
  // nets that connect at least two "things" (board pin or component pin)
  const relevant = nl.nets.filter((n) => n.boardPins.length + n.compPins.length >= 2 && n.compPins.length > 0)
  const names = new Map<string, string>()
  let k = 1
  relevant.forEach((n) => names.set(n.id, netName(n, n.boardPins.length ? 0 : k++)))
  const busX = new Map<string, number>()
  relevant.forEach((n, i) => busX.set(n.id, 200 + i * 14))

  const mcuPins = [...new Set(relevant.flatMap((n) => n.boardPins.map((p) => (p.power === 'GND' ? 'GND' : p.power === '3V3' ? '3V3' : p.id))))]
  const rowH = 26
  const mcuTop = 40
  const mcuPinY = new Map<string, number>()
  mcuPins.forEach((p, i) => mcuPinY.set(p, mcuTop + 20 + i * rowH))

  const compX = 200 + relevant.length * 14 + 60
  let cy = 30
  const items = comps.map((c) => {
    const pins = CATALOG[c.type].pinDefs ?? []
    const h = Math.max(70, pins.length * 26 + 18)
    const y = cy
    cy += h + 26
    return { c, pins, y, h }
  })
  const H = Math.max(cy + 10, mcuTop + 40 + mcuPins.length * rowH)
  const W = compX + 220

  if (!comps.length)
    return <p className="text-sm text-slate-300">ยังไม่มีอุปกรณ์ในวงจร วางอุปกรณ์และต่อสายก่อน แล้วแผนผังจะสร้างให้อัตโนมัติ</p>

  return (
    <div className="overflow-auto rounded-xl bg-[#071026] p-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="แผนผังวงจรที่สร้างจากวงจรปัจจุบัน" className="font-mono">
        {/* MCU block */}
        <rect x={20} y={mcuTop} width={130} height={Math.max(50, mcuPins.length * rowH + 20)} rx={10} fill="#0d3b2e" stroke="#34d399" strokeWidth={2} />
        <text x={85} y={mcuTop - 8} textAnchor="middle" fill="#a7f3d0" fontSize={13} fontWeight={700}>
          MCU (3.3V)
        </text>
        {mcuPins.map((p) => (
          <g key={p}>
            <text x={140} y={mcuPinY.get(p)! + 4} textAnchor="end" fill="#ecfeff" fontSize={12}>
              {p.replace('GPIO', 'G')}
            </text>
            <line x1={150} y1={mcuPinY.get(p)!} x2={170} y2={mcuPinY.get(p)!} stroke="#ecfeff" strokeWidth={2} />
          </g>
        ))}
        {/* buses */}
        {relevant.map((n) => {
          const name = names.get(n.id)!
          const bx = busX.get(n.id)!
          const col = NET_COLOR(name)
          const ys: number[] = []
          const segs: ReactElement[] = []
          for (const bp of n.boardPins) {
            const key = bp.power === 'GND' ? 'GND' : bp.power === '3V3' ? '3V3' : bp.id
            const y = mcuPinY.get(key)
            if (y === undefined || ys.includes(y)) continue
            ys.push(y)
            segs.push(<line key={`m${key}`} x1={170} y1={y} x2={bx} y2={y} stroke={col} strokeWidth={2} />)
          }
          for (const it of items) {
            it.pins.forEach((p, i) => {
              if (!n.compPins.includes(pinNode(it.c.id, p.id))) return
              const y = it.y + 18 + i * 26
              ys.push(y)
              segs.push(<line key={`${it.c.id}${p.id}`} x1={bx} y1={y} x2={compX - 40} y2={y} stroke={col} strokeWidth={2} />)
              segs.push(<circle key={`d${it.c.id}${p.id}`} cx={bx} cy={y} r={3} fill={col} />)
            })
          }
          if (ys.length < 2) return null
          return (
            <g key={n.id}>
              <line x1={bx} y1={Math.min(...ys)} x2={bx} y2={Math.max(...ys)} stroke={col} strokeWidth={2} />
              {segs}
              <text x={bx + 3} y={Math.min(...ys) - 4} fill={col} fontSize={10}>
                {name}
              </text>
            </g>
          )
        })}
        {/* components */}
        {items.map(({ c, pins, y, h }) => (
          <g key={c.id}>
            {pins.map((p, i) => {
              const py = y + 18 + i * 26
              const net = nl.pinNet(c.id, p.id)
              const name = net && names.get(net.id)
              return (
                <g key={p.id}>
                  <line x1={compX - 40} y1={py} x2={compX - 2} y2={py} stroke="#e2e8f0" strokeWidth={2} />
                  <text x={compX - 36} y={py - 4} fill={name ? '#cbd5e1' : '#f87171'} fontSize={10}>
                    {p.id}
                    {!name && ' (ไม่ได้ต่อ)'}
                  </text>
                </g>
              )
            })}
            <Symbol c={c} x={compX + 24} y={y + 10} h={h - 20} />
            <text x={compX + 60} y={y + h / 2} fill="#e0f2fe" fontSize={12} fontFamily="Noto Sans Thai, sans-serif">
              {componentName(c)}
            </text>
            {c.type === 'resistor' && (
              <text x={compX + 60} y={y + h / 2 + 16} fill="#94a3b8" fontSize={11}>
                {formatOhms(Number(c.variant))}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className="mt-1 text-xs text-slate-400">เส้นแนวตั้งแต่ละเส้นคือ "จุดต่อ (net)" เดียวกัน ภาพนี้สร้างจากวงจร 3D ที่ต่ออยู่ตอนนี้ ใช้เปรียบเทียบเท่านั้น</p>
    </div>
  )
}
