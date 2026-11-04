import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useLab } from '../store/lab'

type Variant = 'primary' | 'ghost' | 'danger' | 'success' | 'soft'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.35)]',
  ghost: 'bg-transparent text-cyan-100 border border-cyan-400/40 hover:bg-cyan-400/10',
  danger: 'bg-rose-500 text-white hover:bg-rose-400',
  success: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400',
  soft: 'bg-ink-700/70 text-cyan-50 hover:bg-ink-700 border border-white/10',
}

export function Btn({ variant = 'soft', className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{children}</span>
}

export function Section({ title, children, right }: { title: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-ink-900/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-cyan-200">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`glass anim-pop max-h-[92vh] w-full overflow-y-auto rounded-t-3xl p-4 sm:rounded-3xl sm:p-6 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-cyan-100">{title}</h2>
          <Btn variant="ghost" onClick={onClose} aria-label="ปิด">
            ✕
          </Btn>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Toasts() {
  const toasts = useLab((s) => s.toasts)
  const dismiss = useLab((s) => s.dismissToast)
  const color = { ok: 'border-emerald-400 bg-emerald-950/90', error: 'border-rose-400 bg-rose-950/90', warn: 'border-amber-400 bg-amber-950/90', info: 'border-cyan-400 bg-slate-900/90' }
  const icon = { ok: '✅', error: '⛔', warn: '⚠️', info: '💡' }
  return (
    <div className="pointer-events-none fixed inset-x-2 top-16 z-[60] flex flex-col items-center gap-2" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`anim-pop pointer-events-auto max-w-xl rounded-xl border-l-4 px-4 py-2 text-left text-sm shadow-xl ${color[t.kind]}`}
        >
          {icon[t.kind]} {t.text}
        </button>
      ))}
    </div>
  )
}

export function ConfirmDialog() {
  const c = useLab((s) => s.confirm)
  const close = useLab((s) => s.closeConfirm)
  return (
    <Modal open={!!c} onClose={close} title="ยืนยัน">
      <p className="mb-4 text-sm text-slate-200">{c?.text}</p>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={close}>
          ยกเลิก
        </Btn>
        <Btn
          variant="primary"
          onClick={() => {
            c?.onYes()
            close()
          }}
        >
          ตกลง
        </Btn>
      </div>
    </Modal>
  )
}

/** Original helper character: a small robot called "น้องไบต์". */
export function ByteBot({ size = 64, mood = 'happy' }: { size?: number; mood?: 'happy' | 'think' | 'alert' }) {
  const eye = mood === 'alert' ? '#fb7185' : '#22d3ee'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="anim-float">
      <line x1="32" y1="6" x2="32" y2="14" stroke="#7dd3fc" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="5" r="4" fill={mood === 'alert' ? '#fb7185' : '#facc15'} />
      <rect x="10" y="14" width="44" height="32" rx="12" fill="#1e40af" stroke="#7dd3fc" strokeWidth="2.5" />
      <rect x="16" y="20" width="32" height="18" rx="8" fill="#0b1226" />
      {mood === 'think' ? (
        <>
          <rect x="21" y="28" width="8" height="3" rx="1.5" fill={eye} />
          <rect x="35" y="28" width="8" height="3" rx="1.5" fill={eye} />
        </>
      ) : (
        <>
          <circle cx="25" cy="29" r="4" fill={eye} />
          <circle cx="39" cy="29" r="4" fill={eye} />
        </>
      )}
      <path d={mood === 'alert' ? 'M27 36 h10' : 'M26 35 q6 4 12 0'} stroke={eye} strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="20" y="46" width="24" height="10" rx="4" fill="#1e3a8a" stroke="#7dd3fc" strokeWidth="2" />
      <rect x="4" y="24" width="6" height="12" rx="3" fill="#38bdf8" />
      <rect x="54" y="24" width="6" height="12" rx="3" fill="#38bdf8" />
      <circle cx="32" cy="51" r="2.2" fill="#22c55e" />
    </svg>
  )
}

export const fmtDuration = (s: number) => {
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${m}:${String(ss).padStart(2, '0')}`
}
