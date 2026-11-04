import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import { canAnchorAt, footprint, type LedColor, type PlacedComponent, type ResistorValue } from '../engine/circuit/catalog'
import { useLab } from '../store/lab'
import { useInteract } from './interact'
import { holePos, nodePos, type V3 } from './layout'
import { WireModel, WirePreview } from './models/boards'
import { DriverModule, PirModule, SmallFan, SoilSensor } from './models/modules'
import { BuzzerModel, DhtModel, LdrModel, LedModel, ResistorModel, type PartLook } from './models/parts'

function pinsOf(c: PlacedComponent): Record<string, V3> | null {
  const fp = footprint(c)
  if (!fp) return null
  const out: Record<string, V3> = {}
  for (const [k, h] of Object.entries(fp)) out[k] = holePos(h)!
  return out
}

function OnBoardPart({ comp, look }: { comp: PlacedComponent; look: PartLook }) {
  const ledState = useLab((s) => s.simView.actuators.leds[comp.id])
  const buzzerOn = useLab((s) => s.simView.actuators.buzzer)
  const pins = useMemo(() => pinsOf(comp), [comp])
  if (!pins) return null
  switch (comp.type) {
    case 'led':
      return <LedModel pins={pins as { A: V3; K: V3 }} color={(comp.variant as LedColor) ?? 'red'} state={look.ghost ? undefined : ledState} look={look} />
    case 'resistor':
      return <ResistorModel pins={pins as { '1': V3; '2': V3 }} value={(comp.variant as ResistorValue) ?? 220} look={look} />
    case 'ldr':
      return <LdrModel pins={pins as { '1': V3; '2': V3 }} look={look} />
    case 'dht':
      return <DhtModel pins={pins as { VCC: V3; DATA: V3; GND: V3 }} look={look} />
    case 'buzzer':
      return <BuzzerModel pins={pins as { P: V3; N: V3 }} on={!look.ghost && buzzerOn} look={look} />
    default:
      return null
  }
}

function InteractivePart({ comp }: { comp: PlacedComponent }) {
  const selected = useLab((s) => s.selection?.kind === 'comp' && s.selection.id === comp.id)
  const highlight = useLab((s) => s.highlight.comps.includes(comp.id))
  const moving = useLab((s) => s.placing?.moveId === comp.id)
  const ledState = useLab((s) => s.simView.actuators.leds[comp.id])
  const look: PartLook = { selected, highlight }
  if (moving) return null

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    const st = useLab.getState()
    if (st.mode !== 'select' || st.placing) return
    e.stopPropagation()
    const ui = useInteract.getState()
    ui.set({ armed: { kind: 'comp', id: comp.id, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } })
    if (ui.controls) ui.controls.enabled = false
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8) return
    const st = useLab.getState()
    if (st.mode !== 'select' || st.placing) return
    e.stopPropagation()
    st.select({ kind: 'comp', id: comp.id })
  }

  if (!comp.anchor) {
    switch (comp.type) {
      case 'driver':
        return <DriverModule comp={comp} look={look} />
      case 'fan':
        return <SmallFan comp={comp} look={look} />
      case 'soil':
        return <SoilSensor comp={comp} look={look} />
      case 'pir':
        return <PirModule comp={comp} look={look} />
      default:
        return null
    }
  }
  const pins = pinsOf(comp)
  const top = pins ? Object.values(pins)[0] : null
  return (
    <group onPointerDown={onDown} onClick={onClick}>
      <OnBoardPart comp={comp} look={look} />
      {ledState?.overcurrent && top && (
        <Html position={[top[0], top[1] + 0.7, top[2]]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-lg bg-amber-400 px-2 py-1 text-xs font-bold text-slate-900 shadow-lg">⚡ กระแสเกิน!</div>
        </Html>
      )}
    </group>
  )
}

function Ghost() {
  const placing = useLab((s) => s.placing)
  const circuit = useLab((s) => s.circuit)
  const anchor = useInteract((s) => s.ghostAnchor)
  if (!placing || !anchor) return null
  const base = placing.moveId ? circuit.components.find((c) => c.id === placing.moveId) : undefined
  const comp: PlacedComponent = base ? { ...base, anchor } : { id: 'ghost', type: placing.type, variant: placing.variant, anchor, flipped: placing.flipped }
  const fp = footprint(comp)
  let ok = canAnchorAt(comp.type, anchor) && !!fp
  if (fp && ok) {
    const used = new Set<string>()
    for (const c of circuit.components) {
      if (c.id === placing.moveId) continue
      const f = footprint(c)
      if (f) Object.values(f).forEach((h) => used.add(h))
    }
    for (const w of circuit.wires) used.add(w.a), used.add(w.b)
    ok = !Object.values(fp).some((h) => used.has(h))
  }
  return <OnBoardPart comp={comp} look={{ ghost: ok ? 'ok' : 'bad' }} />
}

export function PlacedParts() {
  const circuit = useLab((s) => s.circuit)
  const selectedWire = useLab((s) => (s.selection?.kind === 'wire' ? s.selection.id : null))
  const wireStart = useLab((s) => s.wireStart)
  const wireColor = useLab((s) => s.wireColor)
  const startPos = wireStart ? nodePos(wireStart, circuit.components) : undefined
  return (
    <group>
      {circuit.components.map((c) => (
        <InteractivePart key={c.id} comp={c} />
      ))}
      {circuit.wires.map((w) => {
        const a = nodePos(w.a, circuit.components)
        const b = nodePos(w.b, circuit.components)
        if (!a || !b) return null
        return <WireModel key={w.id} wire={w} a={a} b={b} selected={selectedWire === w.id} />
      })}
      {startPos && <WirePreview from={startPos} color={wireColor} />}
      <Ghost />
    </group>
  )
}
