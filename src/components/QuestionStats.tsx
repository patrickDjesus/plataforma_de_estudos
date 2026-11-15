import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, ListChecks } from 'lucide-react'
import { db } from '../db/db'
import { useSubjectMap } from '../db/hooks'
import { addDays, fromISODate, weekIdOf } from '../lib/dates'
import { tint } from '../lib/colors'
import { SubjectIcon } from './SubjectIcon'

interface Bucket {
  done: number
  /** Questões com acerto informado (para a %). */
  graded: number
  correct: number
}
const empty = (): Bucket => ({ done: 0, graded: 0, correct: 0 })
const add = (a: Bucket, b: Partial<Bucket>) => {
  a.done += b.done ?? 0
  a.graded += b.graded ?? 0
  a.correct += b.correct ?? 0
}

export interface QuestionStats {
  total: Bucket
  /** Feitas por fora (livro, lista) informadas ao concluir blocos. */
  manual: Bucket
  /** Extras registradas à mão (fora dos blocos). */
  extra: Bucket
  /** Respondidas no Rush. */
  rush: Bucket
  /** Respondidas nos desafios e listas do Mendonça. */
  app: Bucket
  week: Bucket
  bySubject: Map<string, Bucket>
  /** Últimas 8 semanas (mais antiga primeiro). */
  weeks: { weekId: string; done: number }[]
}

export async function loadQuestionStats(now = new Date()): Promise<QuestionStats> {
  const [blocks, challenges, practice] = await Promise.all([db.blocks.filter((b) => (b.questions ?? 0) > 0).toArray(), db.challenges.toArray(), db.practice.toArray()])
  const s: QuestionStats = { total: empty(), manual: empty(), extra: empty(), rush: empty(), app: empty(), week: empty(), bySubject: new Map(), weeks: [] }
  const thisWeek = weekIdOf(now)
  const weekIds = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, (i - 7) * 7))
  const perWeek = new Map(weekIds.map((w) => [w, 0]))
  const put = (subjectId: string | undefined, weekId: string, b: Bucket, src: 'manual' | 'extra' | 'rush' | 'app') => {
    add(s.total, b)
    add(s[src], b)
    if (weekId === thisWeek) add(s.week, b)
    if (perWeek.has(weekId)) perWeek.set(weekId, perWeek.get(weekId)! + b.done)
    if (subjectId) {
      const sb = s.bySubject.get(subjectId) ?? empty()
      add(sb, b)
      s.bySubject.set(subjectId, sb)
    }
  }
  for (const b of blocks) {
    const n = b.questions ?? 0
    const graded = b.correct !== undefined
    put(b.subjectId, weekIdOf(fromISODate(b.date)), { done: n, graded: graded ? n : 0, correct: graded ? b.correct! : 0 }, 'manual')
  }
  for (const c of challenges) {
    const counted = c.results.filter((r) => r && !r.contested)
    put(c.subjectId, weekIdOf(new Date(c.createdAt)), { done: counted.length, graded: counted.length, correct: counted.filter((r) => r.correct).length }, 'app')
  }
  for (const p of practice) {
    const graded = p.correct !== undefined
    put(p.subjectId, weekIdOf(fromISODate(p.date)), { done: p.done, graded: graded ? p.done : 0, correct: graded ? p.correct! : 0 }, p.source)
  }
  s.weeks = weekIds.map((w) => ({ weekId: w, done: perWeek.get(w)! }))
  return s
}

export function useQuestionStats() {
  return useLiveQuery(() => loadQuestionStats(), [])
}

const pct = (b: Bucket) => (b.graded ? Math.round((b.correct / b.graded) * 100) : null)
const accColor = (p: number | null) => (p === null ? '#94a3b8' : p >= 80 ? '#10b981' : p >= 60 ? '#84cc16' : p >= 40 ? '#eab308' : '#ef4444')

/** Faixa compacta no Geral. */
export function QuestionsStrip({ onMore, onRegister }: { onMore: () => void; onRegister?: () => void }) {
  const s = useQuestionStats()
  if (!s) return null
  const p = pct(s.total)
  return (
    <button onClick={onMore} className="group mb-5 flex w-full flex-wrap items-center gap-x-6 gap-y-2 rounded-[18px] border border-line bg-gradient-to-r from-[#f5f7ff] to-white px-5 py-3.5 text-left transition hover:border-brand/40">
      <span className="flex items-center gap-2 text-sm font-bold">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white">
          <ListChecks size={18} />
        </span>
        Questões
      </span>
      <Mini value={s.week.done} label="nesta semana" />
      <Mini value={s.total.done} label="no total" />
      <Mini value={p === null ? '—' : `${p}%`} label="de acerto" color={accColor(p)} />
      {onRegister && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            onRegister()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation()
              onRegister()
            }
          }}
          className="ml-auto rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"
        >
          + Registrar extras
        </span>
      )}
      <span className={`${onRegister ? '' : 'ml-auto'} flex items-center gap-1 text-xs font-bold text-brand`}>
        Ver resumo <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}

function Mini({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <b className="font-display text-xl tabular-nums" style={color ? { color } : undefined}>
        {value}
      </b>
      <span className="text-xs text-muted">{label}</span>
    </span>
  )
}

/** Resumo completo em Resultados. */
export function QuestionsSummary() {
  const s = useQuestionStats()
  const subjects = useSubjectMap()
  if (!s) return null
  const p = pct(s.total)
  const pw = pct(s.week)
  const max = Math.max(1, ...s.weeks.map((w) => w.done))
  const rows = [...s.bySubject.entries()].filter(([id]) => subjects.has(id)).sort((a, b) => b[1].done - a[1].done)
  const maxRow = Math.max(1, ...rows.map(([, b]) => b.done))
  return (
    <div className="rounded-[18px] border border-line p-5 lg:col-span-2">
      <h3 className="mb-4 flex items-center gap-2 font-sans text-sm font-semibold">
        <ListChecks size={18} /> Questões
      </h3>
      {s.total.done === 0 ? (
        <p className="text-sm text-muted">Ainda sem questões. Ao concluir um bloco, a Capi pergunta quantas você fez; os desafios do Mendonça também contam.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr_1.2fr]">
          {/* Números */}
          <div className="grid grid-cols-2 gap-3">
            <Big value={s.total.done} label="no total" />
            <Big value={s.week.done} label="nesta semana" />
            <Big value={p === null ? '—' : `${p}%`} label="acerto geral" color={accColor(p)} />
            <Big value={pw === null ? '—' : `${pw}%`} label="acerto na semana" color={accColor(pw)} />
            <p className="col-span-2 text-[11px] text-muted">
              {[
                [s.rush.done, 'no Rush'],
                [s.manual.done, 'nos blocos'],
                [s.extra.done, 'extras'],
                [s.app.done, 'em desafios e listas'],
              ]
                .filter(([n]) => (n as number) > 0)
                .map(([n, l]) => `${n} ${l}`)
                .join(' · ')}
              . O acerto conta só as questões com acertos informados.
            </p>
          </div>
          {/* Últimas 8 semanas */}
          <div>
            <div className="mb-2 text-xs font-bold text-muted uppercase">Últimas 8 semanas</div>
            <div className="flex h-36 items-end gap-1.5">
              {s.weeks.map((w, i) => (
                <div key={w.weekId} className="flex flex-1 flex-col items-center gap-1" title={`Semana de ${w.weekId.slice(8)}/${w.weekId.slice(5, 7)}: ${w.done} questões`}>
                  <span className="text-[10px] font-bold text-muted tabular-nums">{w.done || ''}</span>
                  <div className="flex w-full items-end rounded-md bg-[#eef0f4]" style={{ height: 100 }}>
                    <div className={`w-full rounded-md ${i === 7 ? 'bg-brand' : 'bg-[#a8b6ff]'}`} style={{ height: `${(w.done / max) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-muted">{i === 7 ? 'esta' : `${w.weekId.slice(8)}/${w.weekId.slice(5, 7)}`}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Por matéria */}
          <div>
            <div className="mb-2 text-xs font-bold text-muted uppercase">Por matéria</div>
            <div className="thin-scroll max-h-44 space-y-2.5 overflow-y-auto pr-1">
              {rows.map(([id, b]) => {
                const sub = subjects.get(id)!
                const sp = pct(b)
                return (
                  <div key={id} className="flex items-center gap-2.5">
                    <SubjectIcon subject={sub} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex justify-between gap-2 text-xs">
                        <span className="truncate font-semibold">{sub.name}</span>
                        <span className="shrink-0 tabular-nums">
                          <b>{b.done}</b>
                          {sp !== null && (
                            <span className="ml-1.5 font-bold" style={{ color: accColor(sp) }}>
                              {sp}%
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: tint(sub.color, 0.14) }}>
                        <div className="h-full rounded-full" style={{ width: `${(b.done / maxRow) * 100}%`, background: sub.color }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Big({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div className="rounded-2xl bg-[#f6f7f9] p-3">
      <div className="font-display text-2xl font-extrabold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}
