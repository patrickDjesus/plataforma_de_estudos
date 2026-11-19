import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Clock3, RotateCcw, X } from 'lucide-react'
import { db } from '../db/db'
import { useSubjectMap, useTopics } from '../db/hooks'
import { rateReview } from '../db/repo'
import type { ReviewRating } from '../db/types'
import { toISODate } from '../lib/dates'
import { RATING_LABEL } from '../lib/review'
import { ratingFromScore } from '../lib/challenge'
import { Capybara } from '../components/Capybara'
import { SubjectIcon } from '../components/SubjectIcon'
import { ChallengeRunner } from '../components/ChallengeRunner'
import { useStudyContext } from '../components/ChallengeModal'
import { ReviewCard } from './Errors'
import { StudySession } from './Recovery'

const MAX_MINUTES = 15
const EST = { erro: 1, cartao: 0.5, revisao: 3 } // minutos por item

/** Fila única do dia: erros → flashcards → revisões de tópico, até 15 min. */
export function useReviewQueue() {
  const today = toISODate(new Date())
  const errors = useLiveQuery(() => db.errors.where('due').belowOrEqual(today).filter((e) => !e.resolved).toArray(), [today], [])
  const cards = useLiveQuery(() => db.cards.where('due').belowOrEqual(today).toArray(), [today], [])
  const reviews = useLiveQuery(() => db.reviews.where('due').belowOrEqual(today).toArray(), [today], [])
  return useMemo(() => {
    // Cabe em 15 min: erros primeiro, depois cartões, depois revisões
    let budget = MAX_MINUTES
    const take = <T,>(list: T[], cost: number) => {
      const n = Math.max(0, Math.min(list.length, Math.floor(budget / cost)))
      budget -= n * cost
      return list.slice(0, n)
    }
    const e = take(errors, EST.erro)
    const c = take(cards, EST.cartao)
    const r = take(reviews, EST.revisao)
    const minutes = Math.ceil(e.length * EST.erro + c.length * EST.cartao + r.length * EST.revisao)
    return { errors: e, cards: c, reviews: r, total: e.length + c.length + r.length, pending: errors.length + cards.length + reviews.length, minutes }
  }, [errors, cards, reviews])
}

type Stage = 'erros' | 'cartoes' | 'revisoes' | 'fim'

export function ReviewTodayPage() {
  const navigate = useNavigate()
  const q = useReviewQueue()
  const subjects = useSubjectMap()
  const topics = useTopics()
  const [stage, setStage] = useState<Stage | null>(null)
  const [ei, setEi] = useState(0)
  const [ri, setRi] = useState(0)
  const [reviewMode, setReviewMode] = useState<'escolha' | 'desafio'>('escolha')
  const [done, setDone] = useState({ erros: 0, cartoes: 0, revisoes: 0 })
  // Congela a fila ao começar (os itens somem do banco conforme você responde)
  const [frozen, setFrozen] = useState<typeof q | null>(null)
  const F = frozen ?? q

  const start = () => {
    setFrozen(q)
    setStage(q.errors.length ? 'erros' : q.cards.length ? 'cartoes' : q.reviews.length ? 'revisoes' : 'fim')
  }
  const next = (from: Stage) => {
    if (from === 'erros') setStage(F.cards.length ? 'cartoes' : F.reviews.length ? 'revisoes' : 'fim')
    else if (from === 'cartoes') setStage(F.reviews.length ? 'revisoes' : 'fim')
    else setStage('fim')
  }
  // Etapa sem itens (ou já terminada): avança fora da renderização
  useEffect(() => {
    if (stage === 'erros' && !F.errors[ei]) next('erros')
    if (stage === 'revisoes' && !F.reviews[ri]) next('revisoes')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, ei, ri])

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="page-in mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white">
          <X size={16} /> Sair
        </button>
        {stage && stage !== 'fim' && (
          <div className="flex gap-1.5 text-xs font-bold">
            {(['erros', 'cartoes', 'revisoes'] as const).map((s) => {
              const n = s === 'erros' ? F.errors.length : s === 'cartoes' ? F.cards.length : F.reviews.length
              if (!n) return null
              const on = stage === s
              return (
                <span key={s} className={`rounded-md px-2.5 py-1 ${on ? 'bg-brand text-white' : 'bg-white text-muted'}`}>
                  {s === 'erros' ? `Erros ${done.erros}/${n}` : s === 'cartoes' ? `Cartões ${done.cartoes}/${n}` : `Revisões ${done.revisoes}/${n}`}
                </span>
              )
            })}
          </div>
        )}
      </div>
      {children}
    </div>
  )

  if (stage === null)
    return (
      <Shell>
        <div className="rounded-xl border border-line bg-white p-8 text-center">
          <Capybara pose={q.total ? 'estudando' : 'relaxando'} size={130} />
          <h1 className="mt-2 font-display text-3xl font-extrabold">Revisar hoje</h1>
          {q.total === 0 ? (
            <p className="mt-2 text-muted">Nada vencendo hoje. Memória em dia!</p>
          ) : (
            <>
              <p className="mt-2 text-muted">
                Tudo que vence hoje, numa fila só, em até {MAX_MINUTES} minutos.
                {q.pending > q.total ? ` ${q.pending - q.total} item(ns) ficam para amanhã.` : ''}
              </p>
              <div className="mx-auto mt-5 grid max-w-md grid-cols-3 gap-2">
                {[
                  ['Erros', q.errors.length, '#b23a2a'],
                  ['Cartões', q.cards.length, '#c4471d'],
                  ['Revisões', q.reviews.length, '#4d7a57'],
                ].map(([l, n, c]) => (
                  <div key={l as string} className="rounded-2xl bg-[#f4f4f2] p-3">
                    <div className="font-display text-2xl font-extrabold" style={{ color: c as string }}>
                      {n}
                    </div>
                    <div className="text-xs text-muted">{l}</div>
                  </div>
                ))}
              </div>
              <button onClick={start} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-brand px-7 py-3.5 font-display text-lg font-bold text-white active:translate-y-1">
                <Clock3 size={18} /> Começar (~{q.minutes} min)
              </button>
            </>
          )}
        </div>
      </Shell>
    )

  if (stage === 'erros') {
    const e = F.errors[ei]
    if (!e) return null
    return (
      <Shell>
        <ReviewCard
          e={e}
          subjects={subjects}
          position={`${ei + 1}/${F.errors.length}`}
          onNext={() => {
            setDone((d) => ({ ...d, erros: d.erros + 1 }))
            if (ei + 1 >= F.errors.length) next('erros')
            else setEi(ei + 1)
          }}
        />
      </Shell>
    )
  }

  if (stage === 'cartoes')
    return (
      <Shell>
        <StudySession
          cards={F.cards}
          onExit={() => {
            setDone((d) => ({ ...d, cartoes: F.cards.length }))
            next('cartoes')
          }}
        />
      </Shell>
    )

  if (stage === 'revisoes') {
    const r = F.reviews[ri]
    if (!r) return null
    const s = subjects.get(r.subjectId)
    const t = topics.find((x) => x.id === r.topicId)
    const advance = () => {
      setDone((d) => ({ ...d, revisoes: d.revisoes + 1 }))
      setReviewMode('escolha')
      if (ri + 1 >= F.reviews.length) next('revisoes')
      else setRi(ri + 1)
    }
    if (reviewMode === 'desafio')
      return (
        <Shell>
          <div className="rounded-xl border border-line bg-white p-6">
            <ReviewChallenge subjectId={r.subjectId} topicId={r.topicId} color={s?.color ?? '#c4471d'} onDone={(score) => rateReview(r.topicId, ratingFromScore(score)).then(advance)} onCancel={() => setReviewMode('escolha')} />
          </div>
        </Shell>
      )
    return (
      <Shell>
        <div className="rounded-xl border border-line bg-white p-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-xs font-bold text-muted">
            <SubjectIcon subject={s} size={22} /> {s?.name} · revisão {ri + 1}/{F.reviews.length}
          </div>
          <h2 className="font-display text-2xl font-extrabold">{t?.name ?? 'Tópico'}</h2>
          <p className="mt-2 text-sm text-muted">Tente lembrar o essencial de cabeça. Depois, teste com 3 questões rápidas ou avalie direto.</p>
          <button onClick={() => setReviewMode('desafio')} className="mt-5 inline-flex items-center gap-2 rounded-2xl px-6 py-3 font-bold text-white" style={{ background: s?.color ?? '#c4471d' }}>
            Desafio rápido (3 questões)
          </button>
          <div className="mt-4 text-xs font-bold text-muted uppercase">ou avalie direto</div>
          <div className="mx-auto mt-2 grid max-w-md grid-cols-3 gap-2">
            {(['dificil', 'ok', 'facil'] as ReviewRating[]).map((k) => (
              <button key={k} onClick={() => rateReview(r.topicId, k).then(advance)} className={`rounded-2xl border py-3 ${k === 'ok' ? 'border-brand/30 bg-brand-soft text-brand' : 'border-line bg-white'}`}>
                <div className="text-sm font-bold">{RATING_LABEL[k].label}</div>
              </button>
            ))}
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="rounded-xl border border-line bg-white p-8 text-center">
        <Capybara pose="comemorando" size={130} />
        <h1 className="mt-2 font-display text-3xl font-extrabold">Revisão do dia feita!</h1>
        <p className="mt-2 text-muted">
          {done.erros} erro(s), {done.cartoes} cartão(ões) e {done.revisoes} revisão(ões). A memória agradece.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 font-bold text-white">
            <Check size={16} /> Voltar ao início
          </button>
          {q.pending > 0 && (
            <button
              onClick={() => {
                setFrozen(null)
                setStage(null)
                setEi(0)
                setRi(0)
                setDone({ erros: 0, cartoes: 0, revisoes: 0 })
              }}
              className="flex items-center gap-2 rounded-2xl border border-line bg-white px-5 py-2.5 font-bold"
            >
              <RotateCcw size={16} /> Fazer mais ({q.pending})
            </button>
          )}
        </div>
      </div>
    </Shell>
  )
}

function ReviewChallenge({ subjectId, topicId, color, onDone, onCancel }: { subjectId: string; topicId: string; color: string; onDone: (score: number) => void; onCancel: () => void }) {
  const data = useStudyContext(subjectId, topicId)
  if (!data) return null
  return <ChallengeRunner ctx={data.ctx} subjectId={subjectId} topicId={topicId} origin="revisao" count={3} color={color} onFinish={(c) => onDone(c.score)} onCancel={onCancel} />
}

/** Botão "Revisar hoje" com a contagem, para o Início e a Recuperação. */
export function ReviewTodayButton({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const q = useReviewQueue()
  if (!q.pending) return null
  return (
    <button onClick={() => navigate('/revisar')} className={`group flex items-center gap-4 border-l-2 border-[#4d7a57] bg-[#eef3ec] text-left transition-colors hover:bg-[#dbe7d8] ${compact ? 'px-4 py-2.5' : 'w-full px-5 py-3.5'}`}>
      <RotateCcw size={18} className="shrink-0 text-[#4d7a57]" />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-semibold">Revisar hoje <span className="font-mono text-xs font-normal text-muted">~{q.minutes} min</span></span>
        <span className="text-sm text-muted">
          {q.errors.length ? `${q.errors.length} erro(s)` : ''}
          {q.errors.length && (q.cards.length || q.reviews.length) ? ' · ' : ''}
          {q.cards.length ? `${q.cards.length} cartão(ões)` : ''}
          {q.cards.length && q.reviews.length ? ' · ' : ''}
          {q.reviews.length ? `${q.reviews.length} revisão(ões)` : ''}
        </span>
      </span>
    </button>
  )
}
