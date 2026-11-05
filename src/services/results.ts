/**
 * Result storage. localStorage is always used; Supabase is used in addition when
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set at build time.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type LabId = 'aiot' | 'av' | 'twin'
export const LAB_TH: Record<LabId, string> = { aiot: 'AIoT & สมองกลฝังตัว', av: 'ภาพ เสียง และแสงอัจฉริยะ', twin: 'ดิจิทัลทวิน' }

export interface ResultRecord {
  id: string
  /** which career lab (older records without it are AIoT) */
  lab?: LabId
  nickname: string
  school: string
  startedAt: number
  finishedAt: number
  durationS: number
  quizScore: number | null
  quizTotal: number
  missionsPassed: number[]
  challenge: string | null
  autoScore: number | null
  hintsUsed: number
  /** used guided step-by-step mode for at least one mission */
  guided?: boolean
}

const KEY = 'aiot-lab-results-v1'
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabaseEnabled = !!(url && anon)
export const STAFF_PIN = (import.meta.env.VITE_STAFF_PIN as string | undefined) || '2468'
const TABLE = 'lab_results'

let client: Promise<SupabaseClient> | null = null
function sb() {
  if (!supabaseEnabled) return null
  client ??= import('@supabase/supabase-js').then((m) => m.createClient(url!, anon!))
  return client
}

export function loadLocalResults(): ResultRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ResultRecord[]) : []
  } catch {
    return []
  }
}

export async function saveResult(r: ResultRecord): Promise<{ local: boolean; remote: 'ok' | 'off' | 'error'; error?: string }> {
  let local = false
  try {
    const list = loadLocalResults().filter((x) => x.id !== r.id)
    list.push(r)
    localStorage.setItem(KEY, JSON.stringify(list.slice(-500)))
    local = true
  } catch {
    local = false
  }
  const c = sb()
  if (!c) return { local, remote: 'off' }
  try {
    const { error } = await (await c).from(TABLE).upsert({
      id: r.id,
      lab: r.lab ?? 'aiot',
      nickname: r.nickname,
      school: r.school,
      started_at: new Date(r.startedAt).toISOString(),
      finished_at: new Date(r.finishedAt).toISOString(),
      duration_s: r.durationS,
      quiz_score: r.quizScore,
      quiz_total: r.quizTotal,
      missions_passed: r.missionsPassed,
      challenge: r.challenge,
      auto_score: r.autoScore,
      hints_used: r.hintsUsed,
      guided: r.guided ?? false,
    })
    if (error) return { local, remote: 'error', error: error.message }
    return { local, remote: 'ok' }
  } catch (e) {
    return { local, remote: 'error', error: String(e) }
  }
}

export async function fetchRemoteResults(): Promise<ResultRecord[] | { error: string }> {
  const c = sb()
  if (!c) return { error: 'off' }
  const { data, error } = await (await c).from(TABLE).select('*').order('finished_at', { ascending: false }).limit(1000)
  if (error) return { error: error.message }
  return (data ?? []).map((d: Record<string, unknown>) => ({
    id: String(d.id),
    lab: (d.lab as LabId) ?? 'aiot',
    nickname: String(d.nickname ?? ''),
    school: String(d.school ?? ''),
    startedAt: Date.parse(String(d.started_at)),
    finishedAt: Date.parse(String(d.finished_at)),
    durationS: Number(d.duration_s ?? 0),
    quizScore: d.quiz_score == null ? null : Number(d.quiz_score),
    quizTotal: Number(d.quiz_total ?? 5),
    missionsPassed: (d.missions_passed as number[]) ?? [],
    challenge: (d.challenge as string) ?? null,
    autoScore: d.auto_score == null ? null : Number(d.auto_score),
    hintsUsed: Number(d.hints_used ?? 0),
    guided: Boolean(d.guided),
  }))
}
