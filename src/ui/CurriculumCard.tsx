import { CAREERS, PROGRAM, type Career, type CurriculumLink } from '../content'

/** "What you just did = this part of the SI curriculum" card for a mission. */
export function CurriculumCard({ career, link, done }: { career: Career['id']; link?: CurriculumLink; done: boolean }) {
  if (!link) return null
  const c = CAREERS.find((x) => x.id === career)!
  const area = c.areas[link.area]
  return (
    <section className={`rounded-2xl border p-3 ${done ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-indigo-400/40 bg-indigo-500/10'}`} aria-label="เชื่อมกับหลักสูตร">
      <p className="mb-1 text-xs font-bold text-indigo-200">
        🎓 ในหลักสูตร {PROGRAM.short} · ด้านที่ {link.area + 1}: {area.th} ({area.en})
      </p>
      <p className="text-sm text-slate-200">{link.text}</p>
    </section>
  )
}
