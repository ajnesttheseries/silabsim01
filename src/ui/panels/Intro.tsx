import { useState } from 'react'
import { STAGES } from '../../content'
import { useLab } from '../../store/lab'
import { Btn, ByteBot, Modal, Pill } from '../common'

/** Mission 0: short intro + stage map + controls tutorial (shown once). */
export function IntroModal() {
  const seen = useLab((s) => s.progress.tutorial.seenIntro)
  const current = useLab((s) => s.progress.current)
  const nickname = useLab((s) => s.profile.nickname)
  const flag = useLab((s) => s.tutorialFlag)
  const [step, setStep] = useState(0)
  const open = !seen && current === 0
  const close = () => flag('seenIntro')
  const pages = [
    <div key="0" className="text-center">
      <div className="mb-2 flex justify-center">
        <ByteBot size={96} />
      </div>
      <p className="mb-2 text-lg font-bold text-white">สวัสดี{nickname ? ` ${nickname}` : ''}! ผมชื่อ "น้องไบต์" ผู้ช่วยประจำแล็บ</p>
      <p className="text-sm text-slate-300">
        วันนี้เราจะได้ลองเป็น <b className="text-cyan-200">วิศวกรระบบ AIoT และสมองกลฝังตัว</b> คนที่ทำให้อุปกรณ์ธรรมดา "ฉลาด" ขึ้น เช่น ห้องเรียนที่เปิดพัดลมเองเมื่อร้อน หรือกระถางต้นไม้ที่ร้องเตือนเมื่อดินแห้ง
      </p>
      <svg viewBox="0 0 300 90" className="mx-auto mt-3 w-full max-w-sm" aria-hidden>
        {['เซนเซอร์ (รับรู้)', 'บอร์ด (คิด)', 'อุปกรณ์ (ลงมือทำ)'].map((t, i) => (
          <g key={t}>
            <rect x={10 + i * 100} y={20} width={80} height={44} rx={10} fill="#0f1f47" stroke="#22d3ee" />
            <text x={50 + i * 100} y={47} textAnchor="middle" fill="#e0f2fe" fontSize="11">
              {t}
            </text>
            {i < 2 && <path d={`M${92 + i * 100} 42 h14`} stroke="#22d3ee" strokeWidth="3" markerEnd="url(#a)" className="anim-glow" />}
          </g>
        ))}
        <defs>
          <marker id="a" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#22d3ee" />
          </marker>
        </defs>
      </svg>
    </div>,
    <div key="1">
      <p className="mb-3 text-sm text-slate-300">สาย AIoT มี 3 ด่าน วันนี้เราเริ่มที่ด่านที่ 1</p>
      <div className="space-y-2">
        {STAGES.map((s) => (
          <div key={s.id} className={`rounded-xl border p-3 ${s.open ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 opacity-70'}`}>
            <div className="flex items-center justify-between">
              <b>
                ด่านที่ {s.id}: {s.th}
              </b>
              {s.open ? <Pill className="bg-emerald-500/25 text-emerald-100">เปิด</Pill> : <Pill className="bg-slate-600/40">🔒 เร็ว ๆ นี้</Pill>}
            </div>
            <p className="text-xs text-cyan-300">{s.en}</p>
            <p className="text-xs text-slate-300">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>,
    <div key="2" className="space-y-2 text-sm">
      <p className="font-bold text-white">วิธีใช้แล็บ</p>
      <p>🖱️ / 👆 <b>หมุนกล้อง:</b> ลากบนฉาก · <b>ซูม:</b> ล้อเมาส์ หรือใช้สองนิ้ว · <b>เลื่อน:</b> คลิกขวาลาก หรือลากสองนิ้ว</p>
      <p>🎥 ปุ่มมุมกล้องด้านบน: ภาพรวม / ชั้นวาง / เบรดบอร์ด / จอมอนิเตอร์</p>
      <p>👆 <b>เลือกวัตถุ:</b> แตะอุปกรณ์เพื่อดูการ์ดข้อมูล · <b>วางอุปกรณ์:</b> กด "วางบนเบรดบอร์ด" แล้วแตะรู หรือกดค้างที่ชั้นวางแล้วลาก</p>
      <p>〰️ <b>ต่อสาย:</b> กดปุ่ม "ต่อสาย" เลือกสี แตะจุดเริ่มต้น แล้วแตะจุดปลายทาง</p>
      <p>⚡ <b>จ่ายไฟ:</b> ปุ่ม Power ด้านล่าง (ต้องเสียบสาย USB ก่อน)</p>
      <p className="rounded-xl bg-cyan-500/15 p-2">
        🧭 <b>โหมดพาทำเปิดอยู่:</b> น้องไบต์จะบอกทีละขั้นพร้อมเหตุผล และมีลูกศรสีเหลืองชี้จุดที่ต้องแตะในฉาก ถ้าอยากลองเองให้กด "💪 ทำเอง" ได้ทุกเมื่อ
      </p>
      <p className="text-xs text-slate-400">ทุกอย่างในแล็บนี้เป็นแบบจำลองอย่างง่ายเพื่อการเรียนรู้ ต่อผิดได้ไม่มีอะไรพังจริง ลองผิดลองถูกได้เต็มที่!</p>
    </div>,
  ]
  return (
    <Modal open={open} onClose={close} title={['ยินดีต้อนรับสู่ AIoT Lab', 'แผนที่ด่าน', 'สอนใช้งาน (Tutorial)'][step]}>
      {pages[step]}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {step + 1}/{pages.length}
        </span>
        <div className="flex gap-2">
          {step > 0 && <Btn onClick={() => setStep(step - 1)}>ย้อนกลับ</Btn>}
          {step < pages.length - 1 ? (
            <Btn variant="primary" onClick={() => setStep(step + 1)}>
              ถัดไป →
            </Btn>
          ) : (
            <Btn variant="primary" onClick={close}>
              เริ่มเลย! 🚀
            </Btn>
          )}
        </div>
      </div>
    </Modal>
  )
}
