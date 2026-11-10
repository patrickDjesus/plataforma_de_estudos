import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Brain, History as HistoryIcon, Layers3, RotateCcw, Sparkles, Swords } from 'lucide-react'
import { db } from '../db/db'
import { useSubjectMap, useTopics } from '../db/hooks'
import { rateCard, rateReview } from '../db/repo'
import { ratingFromScore } from '../lib/challenge'
import { ChallengeModal } from '../components/ChallengeModal'
import type { Flashcard, ReviewRating } from '../db/types'
import { RATING_LABEL } from '../lib/review'
import { tint } from '../lib/colors'
import { daysUntil, toISODate } from '../lib/dates'
import { AREAS } from '../db/hooks'
import { Capybara } from '../components/Capybara'
import { SubjectIcon } from '../components/SubjectIcon'
import { Btn, Card, PageHeader } from '../components/ui'

/** Recuperação: tudo que pede para você lembrar hoje. Nesta etapa, os flashcards. */
export function RecoveryPage() {
  const navigate = useNavigate()
  const today = toISODate(new Date())
  const cards = useLiveQuery(() => db.cards.toArray(), [], [])
  const subjects = useSubjectMap()
  const [filter, setFilter] = useState<string | null>(null)
  const [session, setSession] = useState<Flashcard[] | null>(null)
  const [modal, setModal] = useState<{ subjectId: string; topicId?: string; origin: 'revisao' | 'demanda' } | null>(null)

  const due = useMemo(() => cards.filter((c) => c.due <= today).sort((a, b) => a.due.localeCompare(b.due) || a.createdAt - b.createdAt), [cards, today])
  const bySubject = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of due) m.set(c.subjectId, (m.get(c.subjectId) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [due])
  const filtered = filter ? due.filter((c) => c.subjectId === filter) : due

  if (session) return <StudySession cards={session} onExit={() => setSession(null)} />

  return (
    <>
      <PageHeader icon={<Brain size={24} />} title="Recuperação" subtitle="Lembrar sem olhar é o que fixa. Aqui fica tudo que pede revisão hoje." />
      <div className="grid items-start gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
        <ReviewsToday onChallenge={(subjectId, topicId) => setModal({ subjectId, topicId, origin: 'revisao' })} />
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Layers3 size={20} /> Flashcards de hoje
            </h2>
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">{due.length} para revisar</span>
          </div>
          {cards.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Capybara pose="estudando" size={120} />
              <p className="mt-2 max-w-sm text-sm text-muted">Você ainda não tem flashcards. Abra uma nota no Caderno e crie cartões à mão ou peça sugestões ao Claude.</p>
              <Btn variant="primary" className="mt-4" onClick={() => navigate('/caderno')}>
                <Sparkles size={16} /> Ir para o Caderno
              </Btn>
            </div>
          ) : due.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Capybara pose="relaxando" size={120} />
              <p className="mt-2 text-sm font-semibold text-emerald-700">Nenhum cartão para hoje. Memória em dia! ✨</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                <button onClick={() => setFilter(null)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter ? 'bg-[#f1f2f5] text-slate-600' : 'bg-ink text-white'}`}>
                  Todas ({due.length})
                </button>
                {bySubject.map(([id, n]) => {
                  const s = subjects.get(id)
                  const on = filter === id
                  return (
                    <button key={id} onClick={() => setFilter(on ? null : id)} className="rounded-full border px-3 py-1 text-xs font-semibold" style={on ? { background: s?.color, borderColor: s?.color, color: '#fff' } : { borderColor: tint(s?.color ?? '#999', 0.4), color: s?.color }}>
                      {s?.name} ({n})
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setSession(filtered.slice(0, 30))}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-display text-lg font-bold text-white shadow-[0_14px_30px_-14px_rgba(62,99,242,0.9)] transition hover:-translate-y-0.5"
              >
                <RotateCcw size={20} /> Revisar {Math.min(filtered.length, 30)} cartões
              </button>
              {filtered.length > 30 && <p className="mt-2 text-center text-xs text-muted">Sessões de até 30 cartões. Os outros ficam para a próxima rodada.</p>}
            </>
          )}
        </Card>
        </div>

        <div className="space-y-5">
        <FreeChallenge onStart={(subjectId, topicId) => setModal({ subjectId, topicId, origin: 'demanda' })} />
        <History />
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-bold">Seus cartões por matéria</h2>
          {cards.length === 0 && <p className="text-sm text-muted">Nada por aqui ainda.</p>}
          <div className="space-y-2">
            {[...new Set(cards.map((c) => c.subjectId))].map((id) => {
              const s = subjects.get(id)
              const all = cards.filter((c) => c.subjectId === id)
              const learned = all.filter((c) => c.intervalDays >= 7).length
              return (
                <div key={id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                  <SubjectIcon subject={s} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate font-semibold">{s?.name ?? 'Matéria'}</span>
                      <span className="text-muted tabular-nums">
                        {learned}/{all.length} firmes
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: tint(s?.color ?? '#999', 0.12) }}>
                      <div className="h-full rounded-full" style={{ width: `${(learned / all.length) * 100}%`, background: s?.color }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {cards.length > 0 && <p className="mt-3 text-xs text-muted">"Firme" = cartão com intervalo de 7 dias ou mais.</p>}
        </Card>
        </div>
      </div>
      {modal && (
        <ChallengeModal
          subjectId={modal.subjectId}
          topicId={modal.topicId}
          origin={modal.origin}
          onClose={() => setModal(null)}
          onFinish={(c) => {
            if (modal.origin === 'revisao' && modal.topicId) rateReview(modal.topicId, ratingFromScore(c.score))
          }}
        />
      )}
    </>
  )
}

/** Uma rodada de cartões: frente → mostrar resposta → como foi. */
function StudySession({ cards, onExit }: { cards: Flashcard[]; onExit: () => void }) {
  const subjects = useSubjectMap()
  const topics = useTopics()
  const [i, setI] = useState(0)
  const [show, setShow] = useState(false)
  const [tally, setTally] = useState<Record<ReviewRating, number>>({ dificil: 0, ok: 0, facil: 0 })
  const card = cards[i]

  if (!card)
    return (
      <Card className="mx-auto mt-6 flex max-w-lg flex-col items-center p-8 text-center">
        <Capybara pose="comemorando" size={140} />
        <h2 className="mt-2 text-2xl font-bold">Rodada concluída!</h2>
        <p className="mt-1 text-sm text-muted">{cards.length} cartões revisados</p>
        <div className="mt-4 flex gap-3">
          {(['dificil', 'ok', 'facil'] as ReviewRating[]).map((r) => (
            <div key={r} className="rounded-2xl bg-[#f6f7f9] px-4 py-2 text-center">
              <div className="text-xl">{RATING_LABEL[r].emoji}</div>
              <div className="font-display text-lg font-bold">{tally[r]}</div>
              <div className="text-[11px] text-muted">{RATING_LABEL[r].label}</div>
            </div>
          ))}
        </div>
        <Btn variant="primary" className="mt-6" onClick={onExit}>
          Voltar
        </Btn>
      </Card>
    )

  const s = subjects.get(card.subjectId)
  const t = topics.find((x) => x.id === card.topicId)
  const rate = async (r: ReviewRating) => {
    await rateCard(card.id, r)
    setTally({ ...tally, [r]: tally[r] + 1 })
    setShow(false)
    setI(i + 1)
  }

  return (
    <div className="mx-auto mt-2 max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onExit} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white">
          ← Sair
        </button>
        <span className="text-sm font-semibold text-muted tabular-nums">
          {i + 1} / {cards.length}
        </span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#e6e8ee]">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(i / cards.length) * 100}%` }} />
      </div>
      <div key={card.id} className="capi-pop overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_24px_50px_-28px_rgba(16,24,40,0.4)]">
        <div className="flex items-center gap-2 px-6 py-3 text-xs font-semibold" style={{ background: tint(s?.color ?? '#3e63f2', 0.1), color: s?.color }}>
          <SubjectIcon subject={s} size={22} /> {s?.name}
          {t ? ` · ${t.name}` : ''}
        </div>
        <div className="flex min-h-[180px] items-center justify-center px-8 py-10 text-center font-display text-2xl leading-snug font-bold">{card.front}</div>
        {show ? (
          <div className="border-t border-dashed border-line bg-[#fafbfc] px-8 py-8 text-center text-lg leading-relaxed">{card.back}</div>
        ) : (
          <div className="border-t border-line p-4">
            <button onClick={() => setShow(true)} className="w-full rounded-2xl bg-ink py-3.5 font-bold text-white hover:bg-black">
              Mostrar resposta
            </button>
            <p className="mt-2 text-center text-xs text-muted">Tente responder de cabeça antes de virar.</p>
          </div>
        )}
      </div>
      {show && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {(['dificil', 'ok', 'facil'] as ReviewRating[]).map((r) => (
            <button
              key={r}
              onClick={() => rate(r)}
              className={`rounded-2xl border py-3 text-center transition hover:-translate-y-0.5 ${r === 'ok' ? 'border-brand/30 bg-brand-soft text-brand' : 'border-line bg-white'}`}
            >
              <div className="text-2xl">{RATING_LABEL[r].emoji}</div>
              <div className="text-sm font-bold">{RATING_LABEL[r].label}</div>
              <div className="text-[11px] text-muted">{r === 'dificil' ? 'volta amanhã' : r === 'ok' ? 'espaça um pouco' : 'espaça bastante'}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Revisões espaçadas de tópicos que venceram: por desafio (recomendado) ou avaliação manual. */
function ReviewsToday({ onChallenge }: { onChallenge: (subjectId: string, topicId: string) => void }) {
  const today = toISODate(new Date())
  const reviews = useLiveQuery(() => db.reviews.where('due').belowOrEqual(today).toArray(), [today], [])
  const subjects = useSubjectMap()
  const topics = useTopics()
  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <RotateCcw size={20} /> Revisões de tópicos
        </h2>
        <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">{reviews.length} para hoje</span>
      </div>
      <p className="mb-4 text-xs text-muted">O desafio testa sua memória e a nota define a próxima revisão. Sem tempo? Avalie direto.</p>
      {reviews.length === 0 && <p className="rounded-2xl bg-[#f6f7f9] px-4 py-3 text-sm text-muted">Nenhuma revisão de tópico vencendo hoje.</p>}
      <div className="divide-y divide-line">
        {reviews.map((r) => {
          const s = subjects.get(r.subjectId)
          const t = topics.find((x) => x.id === r.topicId)
          const late = -daysUntil(r.due)
          return (
            <div key={r.topicId} className="flex flex-wrap items-center gap-3 py-2.5">
              <SubjectIcon subject={s} size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{t?.name ?? 'Tópico'}</div>
                <div className={`text-xs ${late > 0 ? 'font-semibold text-rose-600' : 'text-muted'}`}>
                  {s?.name} · {late > 0 ? `atrasada ${late}d` : 'vence hoje'}
                </div>
              </div>
              <button onClick={() => onChallenge(r.subjectId, r.topicId)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white" style={{ background: s?.color ?? '#3e63f2' }}>
                <Swords size={14} /> Desafio
              </button>
              <div className="flex gap-1">
                {(['dificil', 'ok', 'facil'] as ReviewRating[]).map((k) => (
                  <button key={k} onClick={() => rateReview(r.topicId, k)} className="rounded-lg bg-[#f1f2f5] px-2 py-1.5 text-xs" title={RATING_LABEL[k].label}>
                    {RATING_LABEL[k].emoji}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/** Desafio sob demanda: escolha a matéria e, se quiser, um tópico. */
function FreeChallenge({ onStart }: { onStart: (subjectId: string, topicId?: string) => void }) {
  const subjects = useSubjectMap()
  const topics = useTopics()
  const [subjectId, setSubjectId] = useState('')
  const [topicId, setTopicId] = useState('')
  const list = [...subjects.values()]
  const sel = subjects.get(subjectId)
  return (
    <Card className="p-6">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <Swords size={20} /> Desafio livre
      </h2>
      <p className="mb-4 text-xs text-muted">5 itens variados sobre o que você escolher. Usa suas anotações quando existem.</p>
      <div className="space-y-2">
        <select id="free-subject" value={subjectId} onChange={(e) => (setSubjectId(e.target.value), setTopicId(''))} className="w-full rounded-xl border border-line bg-[#f8f9fb] px-3 py-2.5 text-sm outline-none">
          <option value="">Escolha a matéria…</option>
          {AREAS.map((a) => (
            <optgroup key={a.id} label={a.name}>
              {list
                .filter((s) => s.areaId === a.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <select id="free-topic" value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!subjectId} className="w-full rounded-xl border border-line bg-[#f8f9fb] px-3 py-2.5 text-sm outline-none disabled:opacity-50">
          <option value="">Matéria inteira</option>
          {topics
            .filter((t) => t.subjectId === subjectId)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
        <button
          onClick={() => onStart(subjectId, topicId || undefined)}
          disabled={!subjectId}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-40"
          style={{ background: sel?.color ?? '#3e63f2' }}
        >
          <Sparkles size={16} /> Desafie-me
        </button>
      </div>
    </Card>
  )
}

const ORIGIN_LABEL = { bloco: 'fim de bloco', revisao: 'revisão', demanda: 'desafio livre' }

function History() {
  const list = useLiveQuery(() => db.challenges.orderBy('createdAt').reverse().limit(8).toArray(), [], [])
  const subjects = useSubjectMap()
  const topics = useTopics()
  return (
    <Card className="p-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <HistoryIcon size={20} /> Últimos desafios
      </h2>
      {list.length === 0 && <p className="text-sm text-muted">Seus desafios aparecem aqui.</p>}
      <div className="space-y-1.5">
        {list.map((c) => {
          const s = subjects.get(c.subjectId)
          const t = topics.find((x) => x.id === c.topicId)
          const pct = Math.round(c.score * 100)
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
              <SubjectIcon subject={s} size={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{t?.name ?? s?.name}</div>
                <div className="text-[11px] text-muted">
                  {ORIGIN_LABEL[c.origin]} · {new Date(c.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${pct >= 85 ? 'bg-emerald-50 text-emerald-700' : pct >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{pct}%</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
