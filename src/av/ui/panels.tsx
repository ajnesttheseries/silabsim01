import type { ReactNode } from 'react'
import { scoreQuiz } from '../../engine/quiz'
import { useLab } from '../../store/lab'
import { Btn, Modal, Pill, Section } from '../../ui/common'
import { Quiz } from '../../ui/panels/MissionPanel'
import { TARGET } from '../engine/audio'
import { checkAddresses, COLOR_TH, colorName, CONSOLE_PATCH, FIXTURES, footprintOf, PROFILE, PROFILE_TH, buildUniverse, fixtureType } from '../engine/dmx'
import { AV_FIND_LIST, AV_FIND_TARGET, AV_FINAL_QUIZ, AV_MINI_QUIZ, AV_MISSIONS, avObjectives, COLOR_TARGETS, M4_QUESTION } from '../engine/missions'
import { DEVICES, PORTS, familyOf, type PatchIssue } from '../engine/patch'
import { cueAt, cueToConsole, MOVER_TH, SHOW_LENGTH, SONG, WALL_TH, type MoverMode, type ParColor, type WallMode } from '../engine/show'
import { FAMILY_HEX } from '../scene/layout'
import { avSound } from '../sound'
import { avCtx, useAv } from '../store'
import { AvGuidePanelSection } from './guide'

const SEV: Record<PatchIssue['severity'], { cls: string; icon: string }> = {
  danger: { cls: 'border-rose-400 bg-rose-950/70', icon: '🔥' },
  error: { cls: 'border-rose-300/70 bg-rose-950/40', icon: '⛔' },
  warning: { cls: 'border-amber-400 bg-amber-950/40', icon: '⚠️' },
  info: { cls: 'border-sky-400/60 bg-sky-950/40', icon: '💡' },
  ok: { cls: 'border-emerald-400/70 bg-emerald-950/40', icon: '✅' },
}

function IssueList({ issues }: { issues: Array<{ severity: PatchIssue['severity']; message: string; explain?: string }> }) {
  if (!issues.length) return <p className="text-sm text-slate-300">ยังไม่มีอะไรให้ตรวจ</p>
  return (
    <ul className="space-y-1.5">
      {issues.map((i, k) => (
        <li key={k} className={`rounded-xl border-l-4 p-2 text-sm ${SEV[i.severity].cls}`}>
          <p className="font-semibold">
            {SEV[i.severity].icon} {i.message}
          </p>
          {i.explain && <p className="mt-0.5 text-xs text-slate-300">{i.explain}</p>}
        </li>
      ))}
    </ul>
  )
}

/* ---------------- mission ---------------- */

export function AvMissionPanel() {
  const s = useAv()
  const p = s.progress
  const m = AV_MISSIONS[p.current]
  const st = avObjectives(m, avCtx(s))
  const done = p.completed.includes(m.id)
  const next = AV_MISSIONS[m.id + 1]
  const level = p.hintLevel[m.id] ?? 0
  const sol = ({ 2: 'dmx', 3: 'audio', 4: 'monitor', 5: 'cues' } as const)[m.id as 2]
  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto scroll-thin pb-1">
        {AV_MISSIONS.map((x) => {
          const d = p.completed.includes(x.id)
          const unlocked = x.id === 0 || p.completed.includes(x.id - 1)
          return (
            <button
              key={x.id}
              onClick={() => s.goMission(x.id)}
              className={`min-h-11 shrink-0 rounded-xl border px-2 text-xs font-semibold ${p.current === x.id ? 'border-fuchsia-300 bg-fuchsia-500/25 text-white' : d ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100' : unlocked ? 'border-white/15 text-slate-200' : 'border-white/5 text-slate-500'}`}
            >
              {d ? '✅' : unlocked ? '🔓' : '🔒'} {x.id === 6 ? 'สุดท้าย' : x.id}. {x.short}
            </button>
          )
        })}
      </div>
      <div>
        <p className="text-xs font-semibold text-fuchsia-300">
          {m.id === 6 ? 'ภารกิจสุดท้าย' : `ภารกิจที่ ${m.id}`} · ประมาณ {m.minutes} นาที
        </p>
        <h2 className="presenter-xl text-xl font-extrabold text-white">{m.title}</h2>
        <p className="mt-1 text-sm text-slate-300">{m.intro}</p>
      </div>
      <Section title="เป้าหมาย">
        <ul className="space-y-1.5">
          {m.objectives.map((o) => (
            <li key={o.id} className={`flex gap-2 text-sm ${st[o.id] ? 'text-emerald-200' : 'text-slate-200'}`}>
              <span aria-hidden>{st[o.id] ? '✅' : '⬜'}</span>
              <span>{o.th}</span>
            </li>
          ))}
        </ul>
        {done && next && (
          <Btn variant="primary" className="mt-3 w-full" onClick={() => s.goMission(next.id)}>
            ไปภารกิจถัดไป: {next.title} →
          </Btn>
        )}
      </Section>
      <AvGuidePanelSection />
      {m.id === 1 && (
        <>
          <Section title={`อุปกรณ์ที่ดูแล้ว (${p.found.length}/${AV_FIND_TARGET} ขึ้นไป)`}>
            <div className="flex flex-wrap gap-1">
              {AV_FIND_LIST.map((d) => (
                <Pill key={d} className={p.found.includes(d) ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/5 text-slate-300'}>
                  {p.found.includes(d) ? '✔' : '○'} {DEVICES[d].nameTh}
                </Pill>
              ))}
            </div>
          </Section>
          <Section title="Mini quiz">
            <Quiz qs={AV_MINI_QUIZ} answers={p.miniAnswers} onAnswer={s.answerMini} />
          </Section>
        </>
      )}
      {m.id === 4 && (
        <Section title={`คำถาม: ${M4_QUESTION.q}`}>
          <div className="grid gap-1.5">
            {M4_QUESTION.choices.map((c, k) => (
              <button
                key={k}
                onClick={() => s.answerM4(k)}
                className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm ${p.m4Answer === k ? (k === M4_QUESTION.answer ? 'border-emerald-400 bg-emerald-500/20' : 'border-rose-400 bg-rose-500/20') : 'border-white/10 hover:bg-white/5'}`}
              >
                {['ก', 'ข', 'ค', 'ง'][k]}. {c}
              </button>
            ))}
          </div>
        </Section>
      )}
      {m.id === 5 && <ShowTargets />}
      {m.id === 6 && (
        <Section title="แบบทดสอบ 5 ข้อ">
          <Quiz qs={AV_FINAL_QUIZ} answers={p.finalAnswers} onAnswer={s.answerFinal} oneAtATime />
          {p.finalAnswers.every((a) => a !== null) && (
            <div className="mt-3 rounded-xl bg-emerald-900/40 p-3 text-center">
              <p className="mb-2 text-lg font-bold">
                คะแนน {scoreQuiz(AV_FINAL_QUIZ, p.finalAnswers)}/{AV_FINAL_QUIZ.length}
              </p>
              <Btn variant="primary" onClick={s.finishLab}>
                🎓 ดูผลสรุปและรับใบประกาศ
              </Btn>
            </div>
          )}
        </Section>
      )}
      <Section title="ตัวช่วย">
        <div className="mb-2 flex flex-wrap gap-2">
          <Btn onClick={() => s.setTheory(true)}>📘 ทฤษฎี</Btn>
          <Btn onClick={() => useLab.getState().ask('เริ่มภารกิจนี้ใหม่?', s.resetMission)}>↺ เริ่มภารกิจใหม่</Btn>
          <Btn onClick={() => void s.saveResult()}>💾 บันทึกผล</Btn>
        </div>
        <div className="space-y-2">
          {level >= 1 && <p className="rounded-lg bg-sky-900/40 p-2 text-sm">💡 ใบ้เบา: {m.hints[0]}</p>}
          {level >= 2 && <p className="rounded-lg bg-sky-900/60 p-2 text-sm">🔦 ใบ้ชัด: {m.hints[1]}</p>}
          {level >= 3 && (
            <div className="rounded-lg bg-violet-900/50 p-2 text-sm">
              🧩 เฉลย:{' '}
              {sol ? (
                <Btn variant="primary" onClick={() => useLab.getState().ask('วางตัวอย่างเฉลยแทนของเดิมในส่วนนี้?', () => s.loadSolution(sol))}>
                  วางเฉลยให้ดู
                </Btn>
              ) : (
                <span className="text-slate-300">ภารกิจนี้ไม่มีเฉลยแบบวางให้ ทำตามคำใบ้ด้านบนได้เลย</span>
              )}
            </div>
          )}
          {level < 3 && (
            <Btn variant="ghost" onClick={() => s.useHint()}>
              🙋 ขอคำใบ้ ({['เบา', 'ชัด', 'เฉลย'][level]})
            </Btn>
          )}
        </div>
      </Section>
      <Modal open={s.showTheory} onClose={() => s.setTheory(false)} title={`📘 ทฤษฎี: ${m.theory.title}`}>
        {m.theory.formula && <p className="mb-3 rounded-xl bg-ink-800 p-3 text-center font-mono text-base text-fuchsia-100">{m.theory.formula}</p>}
        <ul className="space-y-2 text-sm text-slate-200">
          {m.theory.body.map((b) => (
            <li key={b}>• {b}</li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}

/* ---------------- patch ---------------- */

export function AvPatchPanel() {
  const s = useAv()
  const issues = [...s.patch.issues].sort((a, b) => ['danger', 'error', 'warning', 'info', 'ok'].indexOf(a.severity) - ['danger', 'error', 'warning', 'info', 'ok'].indexOf(b.severity))
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Btn variant={s.mode === 'cable' ? 'primary' : 'soft'} onClick={() => s.setMode(s.mode === 'cable' ? 'select' : 'cable')}>
          🔌 {s.mode === 'cable' ? 'กำลังเสียบสาย (กดเพื่อเสร็จ)' : 'เสียบสาย'}
        </Btn>
        <Btn variant="danger" onClick={() => useLab.getState().ask('ถอดสายทั้งหมด?', s.clearCables)}>
          🧹 ถอดสายทั้งหมด
        </Btn>
      </div>
      <Section title="ประเภทสาย">
        <div className="flex flex-wrap gap-2 text-xs">
          <Pill className="bg-white/5">
            <span className="h-3 w-3 rounded-full" style={{ background: FAMILY_HEX.xlr }} /> XLR สัญญาณเสียง (ไมค์/ไลน์)
          </Pill>
          <Pill className="bg-white/5">
            <span className="h-3 w-3 rounded-full" style={{ background: FAMILY_HEX.speakon }} /> Speakon สายลำโพงกำลังสูง
          </Pill>
          <Pill className="bg-white/5">
            <span className="h-3 w-3 rounded-full" style={{ background: FAMILY_HEX.dmx }} /> DMX ควบคุมไฟ (หัว XLR)
          </Pill>
        </div>
      </Section>
      <Section title="ผลตรวจสายสัญญาณ">
        <IssueList issues={issues} />
      </Section>
      <Section title={`สายที่ต่ออยู่ (${s.cables.length})`}>
        {!s.cables.length && <p className="text-sm text-slate-300">ยังไม่มีสาย กด "เสียบสาย" แล้วแตะช่อง OUT กับช่อง IN ในฉาก</p>}
        <ul className="space-y-1">
          {s.cables.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink-800/60 px-2 py-1 text-xs">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: FAMILY_HEX[familyOf(PORTS[c.from].kind) === 'dmx' || familyOf(PORTS[c.to].kind) === 'dmx' ? 'dmx' : familyOf(PORTS[c.from].kind)] }} />
                {DEVICES[PORTS[c.from].device].nameTh} {PORTS[c.from].label} → {DEVICES[PORTS[c.to].device].nameTh} {PORTS[c.to].label}
              </span>
              <Btn variant="ghost" onClick={() => s.removeCable(c.id)} aria-label="ถอดสาย">
                🗑
              </Btn>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

/* ---------------- lighting ---------------- */

const SWATCH = (r: number, g: number, b: number) => `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`

export function AvLightPanel() {
  const s = useAv()
  const f = s.selectedFixture
  const prof = PROFILE[fixtureType(f)]
  const vals = s.console[f]
  const out = s.live.rig[f]
  const addrIssues = checkAddresses(s.addresses)
  const u = buildUniverse(s.live.showPlaying ? cueToConsole(cueAt(s.cues, s.live.showT), s.live.showT) : s.console)
  return (
    <div className="space-y-3">
      <Section title="ตั้ง DMX address บนตัวไฟ (เทียบกับ Patch ในคอนโซล)">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead className="text-xs text-fuchsia-200">
              <tr>
                <th className="py-1">ไฟ</th>
                <th>ช่อง</th>
                <th>คอนโซลส่งที่</th>
                <th>address บนตัวไฟ</th>
              </tr>
            </thead>
            <tbody>
              {FIXTURES.map((x) => {
                const ok = s.addresses[x.id] === CONSOLE_PATCH[x.id]
                return (
                  <tr key={x.id} className={`border-t border-white/5 ${f === x.id ? 'bg-fuchsia-500/10' : ''}`}>
                    <td className="py-1">
                      <button className="min-h-10 font-semibold underline-offset-2 hover:underline" onClick={() => s.selectFixture(x.id)}>
                        {x.id.toUpperCase()}
                      </button>
                    </td>
                    <td className="text-xs text-slate-300">{footprintOf(x.id)}</td>
                    <td className="font-mono">
                      {CONSOLE_PATCH[x.id]}–{CONSOLE_PATCH[x.id] + footprintOf(x.id) - 1}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="h-9 w-9 rounded-lg bg-white/10" onClick={() => s.setAddress(x.id, s.addresses[x.id] - 1)} aria-label={`ลด address ${x.id}`}>
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={512}
                          value={s.addresses[x.id]}
                          onChange={(e) => s.setAddress(x.id, Number(e.target.value))}
                          className={`h-9 w-16 rounded-lg border bg-ink-900 px-1 text-center font-mono ${ok ? 'border-emerald-400/70' : 'border-rose-400/60'}`}
                          aria-label={`DMX address ของ ${x.id}`}
                        />
                        <button className="h-9 w-9 rounded-lg bg-white/10" onClick={() => s.setAddress(x.id, s.addresses[x.id] + 1)} aria-label={`เพิ่ม address ${x.id}`}>
                          +
                        </button>
                        <span aria-hidden>{ok ? '✅' : '⚠️'}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2">
          <IssueList issues={addrIssues.filter((i) => i.severity !== 'ok' || addrIssues.length === 1).slice(0, 4)} />
        </div>
      </Section>
      <Section
        title={`คอนโซล: ${f.toUpperCase()} (ช่อง ${CONSOLE_PATCH[f]}–${CONSOLE_PATCH[f] + prof.length - 1})`}
        right={
          out && (
            <span className="flex items-center gap-2 text-xs">
              <span className="h-6 w-6 rounded-full border border-white/40" style={{ background: SWATCH(out.r, out.g, out.b), boxShadow: `0 0 12px ${SWATCH(out.r, out.g, out.b)}` }} />
              {out.receiving ? COLOR_TH[colorName(out.r, out.g, out.b)] : 'ไม่ได้รับ DMX'}
            </span>
          )
        }
      >
        {s.live.showPlaying && <p className="mb-2 text-xs text-amber-300">กำลังเล่นโชว์: ไฟถูกควบคุมด้วย Cue list อยู่</p>}
        <div className="space-y-2">
          {prof.map((name, i) => (
            <label key={name} className="flex items-center gap-2 text-sm">
              <span className="w-24 shrink-0">
                {PROFILE_TH[name]} <span className="text-[10px] text-slate-400">ch {CONSOLE_PATCH[f] + i}</span>
              </span>
              <input
                type="range"
                min={0}
                max={255}
                value={vals[i]}
                onChange={(e) => s.setFader(f, i, Number(e.target.value))}
                className={`h-8 flex-1 ${name === 'Red' ? 'accent-red-500' : name === 'Green' ? 'accent-green-500' : name === 'Blue' ? 'accent-blue-500' : 'accent-fuchsia-400'}`}
                aria-label={`${name} ของ ${f}`}
              />
              <span className="w-10 text-right font-mono text-xs">{vals[i]}</span>
            </label>
          ))}
        </div>
        {COLOR_TARGETS[f] && (
          <p className="mt-2 text-xs text-slate-300">
            เป้าหมายภารกิจ 2: {COLOR_TH[COLOR_TARGETS[f]]} {out && colorName(out.r, out.g, out.b) === COLOR_TARGETS[f] && out.intensity >= 0.4 ? '✅' : ''}
          </p>
        )}
      </Section>
      <Section title="DMX Monitor: ค่าช่อง 1–32 ใน Universe">
        <div className="grid grid-cols-8 gap-1 font-mono text-[10px]">
          {u.slice(0, 32).map((v, i) => (
            <div key={i} className="rounded bg-ink-800 p-1 text-center" title={`ช่อง ${i + 1}`}>
              <div className="text-slate-500">{i + 1}</div>
              <div className="h-1 rounded bg-fuchsia-400" style={{ opacity: v / 255 }} />
              <div>{v}</div>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">1 Universe มี 512 ช่อง ค่าแต่ละช่อง 0–255 ไฟแต่ละดวงอ่านเฉพาะช่องที่เริ่มจาก address ของตัวเอง</p>
      </Section>
    </div>
  )
}

/* ---------------- sound ---------------- */

function Meter({ db }: { db: number }) {
  const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100))
  const color = db > -3 ? 'bg-rose-500' : db >= -18 ? 'bg-emerald-400' : 'bg-sky-400'
  return (
    <div className="relative h-5 overflow-hidden rounded bg-black/60" role="meter" aria-valuenow={Math.round(db)} aria-valuemin={-60} aria-valuemax={0} aria-label="ระดับสัญญาณ dBFS">
      <div className="absolute inset-y-0 bg-emerald-400/15" style={{ left: `${((-18 + 60) / 60) * 100}%`, width: `${(15 / 60) * 100}%` }} />
      <div className={`h-full ${color} transition-[width] duration-75`} style={{ width: `${pct}%` }} />
      <span className="absolute inset-0 flex items-center justify-end pr-1 font-mono text-[11px]">{db <= -59 ? '−∞' : `${db.toFixed(1)} dBFS`}</span>
    </div>
  )
}

function Slider({ label, value, min, max, step = 1, unit, onChange }: { label: ReactNode; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-28 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 flex-1 accent-fuchsia-400" />
      <span className="w-16 text-right font-mono text-xs">
        {value <= -60 ? '−∞' : `${value > 0 ? '+' : ''}${value}`} {unit}
      </span>
    </label>
  )
}

export function AvSoundPanel() {
  const s = useAv()
  const m = s.mixer
  const lv = s.live.levels
  const ch = s.patch.micChannel[m.micOnStand]
  const strip = m[ch ?? 'ch1']
  const margin = Number.isFinite(lv.loopGain) ? -lv.loopGain : null
  return (
    <div className="space-y-3">
      <Section title="จ่ายไฟ (ลำดับสำคัญ!)">
        <div className="flex flex-wrap gap-2">
          <Btn variant={m.mixerOn ? 'success' : 'soft'} onClick={() => s.setPower('mixer', !m.mixerOn)}>
            ① มิกเซอร์: {m.mixerOn ? 'เปิด' : 'ปิด'}
          </Btn>
          <Btn variant={m.ampOn ? 'success' : 'soft'} onClick={() => s.setPower('amp', !m.ampOn)}>
            ② เพาเวอร์แอมป์: {m.ampOn ? 'เปิด' : 'ปิด'}
          </Btn>
        </div>
        <p className="mt-1 text-xs text-slate-400">เปิด: มิกเซอร์ → แอมป์ · ปิด: แอมป์ → มิกเซอร์</p>
      </Section>
      <Section
        title="ซ้อมร้อง"
        right={
          <Btn
            variant={s.live.rehearsing ? 'danger' : 'primary'}
            onClick={() => {
              avSound.unlock()
              s.setRehearsing(!s.live.rehearsing)
            }}
          >
            {s.live.rehearsing ? '⏹ หยุด' : '▶ ให้นักร้องซ้อมร้อง'}
          </Btn>
        }
      >
        <div className="flex flex-wrap gap-2 text-xs">
          <span>ไมค์บนขาตั้ง:</span>
          {(['micDyn', 'micCond'] as const).map((id) => (
            <Btn key={id} variant={m.micOnStand === id ? 'primary' : 'soft'} onClick={() => s.setMixer({ micOnStand: id })}>
              {id === 'micDyn' ? '🎤 ไดนามิก' : '🎙️ คอนเดนเซอร์'}
            </Btn>
          ))}
        </div>
        {lv.silentReason && <p className="mt-2 rounded-lg bg-amber-900/50 px-2 py-1 text-xs text-amber-100">🔇 {lv.silentReason}</p>}
      </Section>
      <Section title={`ช่องไมค์ ${ch ? ch.toUpperCase() : '(ยังไม่ได้ต่อ)'}`}>
        <div className="space-y-2">
          <div>
            <p className="mb-1 text-xs text-slate-300">แถบวัดก่อน Fader (เป้าหมาย: ค่าสูงสุดอยู่ช่วงสีเขียว −18 ถึง −3 dBFS)</p>
            <Meter db={s.live.meter} />
            {(lv.clipPre || lv.clipMain) && <p className="mt-1 text-xs font-bold text-rose-300">⚠️ CLIP! สัญญาณเกิน 0 dBFS เสียงแตก ลด Gain ลง</p>}
          </div>
          <Slider label="Gain (พรีแอมป์)" value={strip.gain} min={0} max={60} unit="dB" onChange={(v) => ch && s.setChannel(ch, { gain: v })} />
          <Slider label="Fader" value={strip.fader} min={-60} max={10} unit="dB" onChange={(v) => ch && s.setChannel(ch, { fader: v })} />
          <Slider label="MON send" value={strip.mon} min={-60} max={10} unit="dB" onChange={(v) => ch && s.setChannel(ch, { mon: v })} />
          <div className="flex flex-wrap gap-2">
            <Btn variant={strip.phantom ? 'primary' : 'soft'} onClick={() => ch && s.setChannel(ch, { phantom: !strip.phantom })} disabled={!ch}>
              +48V Phantom: {strip.phantom ? 'เปิด' : 'ปิด'}
            </Btn>
            <Btn variant={strip.mute ? 'danger' : 'soft'} onClick={() => ch && s.setChannel(ch, { mute: !strip.mute })} disabled={!ch}>
              {strip.mute ? '🔇 Mute อยู่' : 'Mute'}
            </Btn>
          </div>
        </div>
      </Section>
      <Section title="Master และผลลัพธ์">
        <Slider label="Master" value={m.master} min={-60} max={10} unit="dB" onChange={(v) => s.setMixer({ master: v })} />
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-ink-800 p-2">
            <p className="text-xs text-slate-400">ผู้ชมที่ FOH ได้ยิน</p>
            <p className={`font-mono text-lg ${lv.fohSpl != null && lv.fohSpl >= TARGET.fohSpl ? 'text-emerald-300' : ''}`}>{lv.fohSpl == null ? '—' : `${lv.fohSpl.toFixed(1)} dB`}</p>
          </div>
          <div className="rounded-xl bg-ink-800 p-2">
            <p className="text-xs text-slate-400">นักร้องได้ยินมอนิเตอร์</p>
            <p className={`font-mono text-lg ${lv.monSpl != null && lv.monSpl >= TARGET.monSpl ? 'text-emerald-300' : ''}`}>{lv.monSpl == null ? '—' : `${lv.monSpl.toFixed(1)} dB`}</p>
          </div>
          <div className={`col-span-2 rounded-xl p-2 ${lv.feedback ? 'bg-rose-900/70' : margin != null && margin < 6 ? 'bg-amber-900/50' : 'bg-ink-800'}`}>
            <p className="text-xs text-slate-300">ระยะปลอดภัยก่อนหอน (Gain before feedback)</p>
            <p className="font-mono text-lg">{lv.feedback ? '🔊 หอน!' : margin == null ? '—' : `เหลือ ${margin.toFixed(1)} dB`}</p>
            {lv.loopParts.length > 0 && (
              <p className="text-[11px] text-slate-400">
                ตัวที่ส่งเสียงย้อนเข้าไมค์มากที่สุด: {DEVICES[[...lv.loopParts].sort((a, b) => b.db - a.db)[0].who].nameTh}
              </p>
            )}
          </div>
        </div>
      </Section>
      <Section title="ตำแหน่งลำโพง">
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-28">ลำโพงหลัก (PA)</span>
            <Btn variant={m.paPos === 'front' ? 'primary' : 'soft'} onClick={() => s.setMixer({ paPos: 'front' })}>
              หน้าเวที หันหาผู้ชม
            </Btn>
            <Btn variant={m.paPos === 'back' ? 'primary' : 'soft'} onClick={() => s.setMixer({ paPos: 'back' })}>
              หลังนักร้อง
            </Btn>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-28">ลำโพงมอนิเตอร์</span>
            <Btn variant={m.wedgePos === 'front' ? 'primary' : 'soft'} onClick={() => s.setMixer({ wedgePos: 'front' })}>
              หน้านักร้อง (หันเข้าหา)
            </Btn>
            <Btn variant={m.wedgePos === 'behind' ? 'primary' : 'soft'} onClick={() => s.setMixer({ wedgePos: 'behind' })}>
              หลังนักร้อง
            </Btn>
          </div>
        </div>
      </Section>
      <p className="text-xs text-slate-500">ค่าทั้งหมดคำนวณจากแบบจำลองอย่างง่ายเพื่อการเรียนรู้ (ระยะทาง ทิศลำโพง รูปแบบรับเสียง cardioid และค่าเผื่อการสะท้อนของห้อง)</p>
    </div>
  )
}

/* ---------------- show ---------------- */

function ShowTargets() {
  const results = useAv((s) => s.showResults)
  const score = useAv((s) => s.progress.showScore)
  const live = useAv((s) => s.showLive)
  const run = useAv((s) => s.runShowTest)
  const list = results ?? live.checkpoints
  return (
    <Section title="เป้าหมายของโชว์ (ระบบตรวจ 4 ช่วง)" right={<Btn variant="primary" onClick={run}>🧪 ทดสอบโชว์อัตโนมัติ</Btn>}>
      {score && (
        <p className="mb-2 text-sm font-bold">
          ผลทดสอบล่าสุด: <span className={score.score >= 4 ? 'text-emerald-300' : 'text-amber-300'}>{score.score}/{score.total}</span>
        </p>
      )}
      <ul className="space-y-1.5">
        {list.map((cp) => (
          <li key={cp.t} className={`rounded-lg p-2 text-xs ${cp.pass ? 'bg-emerald-900/40' : 'bg-ink-800'}`}>
            <p className="font-semibold">
              {cp.pass ? '✅' : '⬜'} {cp.th}
            </p>
            {cp.checks.map((c) => (
              <p key={c.th} className={c.ok ? 'text-emerald-200' : 'text-slate-300'}>
                {c.ok ? '✔' : '✘'} {c.th}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </Section>
  )
}

const SEL = 'h-10 rounded-lg border border-white/15 bg-ink-900 px-1 text-xs text-cyan-50'

export function AvShowPanel() {
  const s = useAv()
  const cues = [...s.cues].sort((a, b) => a.time - b.time)
  const t = s.live.showT
  return (
    <div className="space-y-3">
      <Section
        title="ไทม์ไลน์เพลง (32 วินาที)"
        right={
          <Btn
            variant={s.live.showPlaying ? 'danger' : 'primary'}
            onClick={() => {
              avSound.unlock()
              s.playShow(!s.live.showPlaying)
              if (!s.live.showPlaying) s.setCamera('overview')
            }}
          >
            {s.live.showPlaying ? '⏹ หยุดโชว์' : '▶ เล่นโชว์'}
          </Btn>
        }
      >
        <div className="relative flex h-8 overflow-hidden rounded-lg text-[10px]">
          {SONG.map((sec, i) => (
            <div key={sec.id} className={`flex items-center justify-center border-r border-black/30 ${['bg-indigo-800', 'bg-sky-800', 'bg-rose-800', 'bg-amber-800', 'bg-slate-800'][i]}`} style={{ width: `${((sec.to - sec.from) / SHOW_LENGTH) * 100}%` }}>
              {sec.th}
            </div>
          ))}
          {cues.map((c) => (
            <div key={c.id} className="absolute top-0 h-full w-0.5 bg-white" style={{ left: `${(c.time / SHOW_LENGTH) * 100}%` }} title={c.name} />
          ))}
          {(s.live.showPlaying || t > 0) && <div className="absolute top-0 h-full w-1 bg-yellow-300" style={{ left: `${(t / SHOW_LENGTH) * 100}%` }} />}
        </div>
        <p className="mt-1 font-mono text-xs text-slate-300">
          {t.toFixed(1)} / {SHOW_LENGTH} วินาที
        </p>
      </Section>
      <Section title={`Cue list (${cues.length})`} right={<Btn onClick={() => s.addCue()}>＋ เพิ่มคิว</Btn>}>
        {!cues.length && <p className="text-sm text-slate-300">ยังไม่มีคิว กด "เพิ่มคิว" แล้วตั้งเวลาและสถานะของเวที</p>}
        <div className="space-y-2">
          {cues.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 bg-ink-800/70 p-2">
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span>เวลา</span>
                <input type="number" min={0} max={31} step={1} value={c.time} onChange={(e) => s.updateCue(c.id, { time: Math.max(0, Math.min(31, Number(e.target.value))) })} className={`${SEL} w-16`} aria-label="เวลาของคิว (วินาที)" />
                <span>วิ</span>
                <input value={c.name} onChange={(e) => s.updateCue(c.id, { name: e.target.value.slice(0, 20) })} className={`${SEL} w-28`} aria-label="ชื่อคิว" />
                <Btn variant="ghost" className="ml-auto" onClick={() => s.removeCue(c.id)} aria-label="ลบคิว">
                  🗑
                </Btn>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-3">
                <label>
                  สี PAR
                  <select className={`${SEL} w-full`} value={c.parColor} onChange={(e) => s.updateCue(c.id, { parColor: e.target.value as ParColor })}>
                    {(['black', 'red', 'green', 'blue', 'yellow', 'magenta', 'cyan', 'white', 'amber'] as ParColor[]).map((x) => (
                      <option key={x} value={x}>
                        {COLOR_TH[x]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ความสว่าง PAR {c.parLevel}%
                  <input type="range" min={0} max={100} step={5} value={c.parLevel} onChange={(e) => s.updateCue(c.id, { parLevel: Number(e.target.value) })} className="h-8 w-full accent-fuchsia-400" />
                </label>
                <label>
                  Moving Head
                  <select className={`${SEL} w-full`} value={c.mover} onChange={(e) => s.updateCue(c.id, { mover: e.target.value as MoverMode })}>
                    {(Object.keys(MOVER_TH) as MoverMode[]).map((x) => (
                      <option key={x} value={x}>
                        {MOVER_TH[x]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  จอ LED
                  <select className={`${SEL} w-full`} value={c.wall} onChange={(e) => s.updateCue(c.id, { wall: e.target.value as WallMode })}>
                    {(Object.keys(WALL_TH) as WallMode[]).map((x) => (
                      <option key={x} value={x}>
                        {WALL_TH[x]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ไมค์
                  <select className={`${SEL} w-full`} value={c.mic} onChange={(e) => s.updateCue(c.id, { mic: e.target.value as 'mute' | 'live' })}>
                    <option value="mute">ปิด (Mute)</option>
                    <option value="live">เปิด (Live)</option>
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <ShowTargets />
    </div>
  )
}
