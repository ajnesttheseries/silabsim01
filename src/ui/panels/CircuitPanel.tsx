import { componentName } from '../../engine/circuit/catalog'
import type { Issue } from '../../engine/circuit/validator'
import { useLab } from '../../store/lab'
import { Btn, Modal, Section } from '../common'
import { Schematic } from './Schematic'

const SEV: Record<Issue['severity'], { cls: string; icon: string; th: string }> = {
  danger: { cls: 'border-rose-400 bg-rose-950/70', icon: '🔥', th: 'อันตราย' },
  error: { cls: 'border-rose-300/70 bg-rose-950/40', icon: '⛔', th: 'ผิด' },
  warning: { cls: 'border-amber-400 bg-amber-950/40', icon: '⚠️', th: 'ควรแก้' },
  info: { cls: 'border-sky-400/60 bg-sky-950/40', icon: '💡', th: 'แนะนำ' },
  ok: { cls: 'border-emerald-400/70 bg-emerald-950/40', icon: '✅', th: 'ถูกต้อง' },
}

export function CircuitPanel() {
  const report = useLab((s) => s.report)
  const circuit = useLab((s) => s.circuit)
  const checkShown = useLab((s) => s.checkShown)
  const check = useLab((s) => s.checkCircuit)
  const focus = useLab((s) => s.focusIssue)
  const highlight = useLab((s) => s.highlight)
  const clear = useLab((s) => s.clearCircuit)
  const ask = useLab((s) => s.ask)
  const select = useLab((s) => s.select)
  const remove = useLab((s) => s.removeComponent)
  const setUsb = useLab((s) => s.setUsb)
  const showSchematic = useLab((s) => s.showSchematic)
  const setSchematic = useLab((s) => s.setSchematic)
  const counts = report.issues.reduce<Record<string, number>>((a, i) => ((a[i.severity] = (a[i.severity] ?? 0) + 1), a), {})

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Btn variant="primary" onClick={check}>
          🔍 ตรวจวงจร
        </Btn>
        <Btn onClick={() => setSchematic(true)}>📐 แผนผังวงจร (Schematic)</Btn>
        <Btn variant={circuit.usbConnected ? 'soft' : 'primary'} onClick={() => setUsb(!circuit.usbConnected)}>
          🔌 {circuit.usbConnected ? 'ถอด USB' : 'เสียบ USB'}
        </Btn>
        <Btn variant="danger" onClick={() => ask('ล้างวงจรทั้งหมด? อุปกรณ์และสายบนเบรดบอร์ดจะถูกนำออก', clear)}>
          🧹 ล้างวงจร
        </Btn>
      </div>

      {checkShown ? (
        <Section
          title="ผลการตรวจวงจร"
          right={
            <span className="text-xs text-slate-300">
              {(['danger', 'error', 'warning', 'ok'] as const).map((k) => counts[k] && `${SEV[k].icon}${counts[k]} `)}
            </span>
          }
        >
          {report.issues.length === 0 && <p className="text-sm text-slate-300">ยังไม่มีอุปกรณ์หรือสายให้ตรวจ</p>}
          <ul className="space-y-1.5">
            {report.issues.map((i, k) => {
              const active = i.compIds?.length && i.compIds.every((c) => highlight.comps.includes(c))
              return (
                <li key={k}>
                  <button
                    className={`w-full rounded-xl border-l-4 p-2 text-left text-sm ${SEV[i.severity].cls} ${active ? 'ring-2 ring-cyan-300' : ''}`}
                    onClick={() => focus(active ? null : i)}
                  >
                    <p className="font-semibold">
                      {SEV[i.severity].icon} {i.message}
                    </p>
                    {i.explain && <p className="mt-0.5 text-xs text-slate-300">{i.explain}</p>}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-slate-400">แตะรายการเพื่อไฮไลต์อุปกรณ์ในฉาก 3D · ระบบตรวจจาก netlist (จุดเชื่อมต่อจริง) ด้วยแบบจำลอง DC อย่างง่ายเพื่อการเรียนรู้ ไม่ใช่ SPICE</p>
        </Section>
      ) : (
        <p className="rounded-xl bg-ink-800/60 p-3 text-sm text-slate-300">กด "ตรวจวงจร" เพื่อให้ระบบวิเคราะห์ว่าต่อถูกหรือผิดตรงไหน (LED จะติดหรือไม่ติดตามวงจรจริงอยู่แล้วแม้ไม่กดตรวจ)</p>
      )}

      <Section title={`อุปกรณ์ในวงจร (${circuit.components.length}) · สาย ${circuit.wires.length} เส้น`}>
        {circuit.components.length === 0 && <p className="text-sm text-slate-300">ยังไม่มีอุปกรณ์ เลือกจากชั้นวางแล้วกด "วางบนเบรดบอร์ด" หรือลากไปวาง</p>}
        <ul className="space-y-1">
          {circuit.components.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink-800/60 px-2 py-1">
              <button className="min-h-10 flex-1 text-left text-sm" onClick={() => select({ kind: 'comp', id: c.id })}>
                {componentName(c)} <span className="text-xs text-slate-400">{c.anchor ? c.anchor.replace('bb:', '').toUpperCase() : 'บนโต๊ะ'}</span>
              </button>
              <Btn variant="ghost" onClick={() => remove(c.id)} aria-label={`นำ${componentName(c)}ออก`}>
                🗑
              </Btn>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="วิธีต่อสาย">
        <ul className="list-inside list-disc space-y-1 text-xs text-slate-300">
          <li>กด "〰️ ต่อสาย" เลือกสี แล้วแตะจุดเริ่มต้นและจุดปลายทาง</li>
          <li>รูในคอลัมน์เดียวกัน (A–E หรือ F–J) เชื่อมกันภายใน: เลื่อนเมาส์/นิ้วบนเบรดบอร์ดจะเห็นรูที่เชื่อมกันเป็นสีฟ้า</li>
          <li>1 รูเสียบได้ 1 ขา ใช้รูอื่นในคอลัมน์เดียวกันแทนได้</li>
          <li>แตะสายเพื่อเลือกแล้วลบ</li>
        </ul>
      </Section>
      <Modal open={showSchematic} onClose={() => setSchematic(false)} title="แผนผังวงจร (Schematic)" wide>
        <Schematic />
      </Modal>
    </div>
  )
}
