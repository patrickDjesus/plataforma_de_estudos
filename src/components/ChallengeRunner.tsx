import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Flag, Loader2, RotateCcw, X } from 'lucide-react'
import { uid } from '../db/db'
import { saveChallenge } from '../db/repo'
import type { Challenge, ChallengeItem, ChallengeResult } from '../db/types'
import { AIError, getAI } from '../lib/ai'
import { ITEM_LABEL, finalScore, gradeLocal, needsAIGrading, sanitizeItems } from '../lib/challenge'
import { challengePrompt, contextBlock, gradePrompt, type GradeEntry, type StudyContext } from '../lib/prompts'
import { tint } from '../lib/colors'
import { Capybara } from './Capybara'

type Answer = Challenge['answers'][number]
type Stage = 'gerando' | 'respondendo' | 'corrigindo' | 'resultado' | 'erro'

export interface RunnerProps {
  ctx: StudyContext
  subjectId: string
  topicId?: string
  origin: Challenge['origin']
  count: number
  color: string
  /** Chamado ao concluir, com o desafio salvo (nota em `score`). */
  onFinish: (c: Challenge) => void
  onCancel?: () => void
}

/** Gera, aplica e corrige um desafio de recuperação. */
export function ChallengeRunner({ ctx, subjectId, topicId, origin, count, color, onFinish, onCancel }: RunnerProps) {
  const [stage, setStage] = useState<Stage>('gerando')
  const [error, setError] = useState('')
  const [items, setItems] = useState<ChallengeItem[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [results, setResults] = useState<(ChallengeResult | null)[]>([])
  const [i, setI] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const idRef = useRef(uid())
  const createdAt = useRef(Date.now())
  const fromNotes = useMemo(() => contextBlock(ctx).fromNotes, [ctx])
  const ctl = useRef<AbortController | null>(null)

  // Gera o desafio
  useEffect(() => {
    let alive = true
    ctl.current = new AbortController()
    ;(async () => {
      setStage('gerando')
      const ai = await getAI()
      if (!ai) {
        setError('O Claude não está disponível aqui. Abra o Mendonça pelo claude.ai para fazer desafios.')
        setStage('erro')
        return
      }
      try {
        const raw = await ai.json<unknown>(challengePrompt(ctx, count), { tier: count <= 3 ? 'quick' : 'default', fresh: true, signal: ctl.current!.signal })
        const list = sanitizeItems(raw, fromNotes).slice(0, count)
        if (!alive) return
        if (list.length < 2) {
          setError('O desafio veio incompleto. Tente gerar de novo.')
          setStage('erro')
          return
        }
        setItems(list)
        setAnswers(list.map((it) => (it.type === 'lacunas' ? it.answers.map(() => '') : null)))
        setI(0)
        setStage('respondendo')
      } catch (e) {
        if (!alive) return
        setError(e instanceof AIError ? e.message : 'Não consegui montar o desafio.')
        setStage('erro')
      }
    })()
    return () => {
      alive = false
      ctl.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  const setAnswer = (v: Answer) => setAnswers((prev) => prev.map((a, k) => (k === i ? v : a)))

  const persist = async (res: (ChallengeResult | null)[]) => {
    const done = res.map((r) => r ?? { score: 0, correct: false, feedback: 'Sem correção.' })
    const c: Challenge = { id: idRef.current, subjectId, topicId, origin, fromNotes, createdAt: createdAt.current, items, answers, results: done, score: finalScore(done) }
    await saveChallenge(c)
    return c
  }

  const submit = async () => {
    setStage('corrigindo')
    const local = items.map((it, k) => gradeLocal(it, answers[k]))
    const pending: GradeEntry[] = items
      .map((it, k) => ({ it, k }))
      .filter(({ it }) => needsAIGrading(it))
      .map(({ it, k }) => ({
        index: k,
        kind: ITEM_LABEL[it.type],
        question: it.type === 'aberta' ? it.question : it.type === 'explique' ? it.prompt : '',
        reference: it.type === 'aberta' ? it.expected : it.type === 'explique' ? `Pontos-chave: ${it.keyPoints.join('; ')}` : '',
        answer: String(answers[k] ?? ''),
      }))
    const res: (ChallengeResult | null)[] = [...local]
    if (pending.length) {
      // Respostas em branco não precisam de IA
      for (const p of pending) if (!p.answer.trim()) res[p.index] = { score: 0, correct: false, feedback: 'Resposta em branco.' }
      const toGrade = pending.filter((p) => p.answer.trim())
      if (toGrade.length) {
        try {
          const ai = await getAI()
          const out = await ai!.json<{ results?: { index?: number; score?: number; feedback?: string; missing?: string[] }[] }>(gradePrompt(ctx, toGrade), { fresh: true })
          for (const r of out?.results ?? []) {
            if (typeof r.index !== 'number' || !toGrade.some((p) => p.index === r.index)) continue
            const score = Math.max(0, Math.min(1, Number(r.score) || 0))
            res[r.index] = { score, correct: score >= 0.75, feedback: r.feedback, missing: Array.isArray(r.missing) ? r.missing.filter((m) => typeof m === 'string') : [] }
          }
        } catch {
          /* itens sem correção: você mesmo avalia na tela de resultado */
        }
      }
    }
    setResults(res)
    if (res.every(Boolean)) await persist(res)
    setStage('resultado')
  }

  const selfGrade = async (k: number, ok: boolean) => {
    const next = results.map((r, j) => (j === k ? { score: ok ? 1 : 0, correct: ok, feedback: 'Avaliado por você.' } : r))
    setResults(next)
    if (next.every(Boolean)) await persist(next)
  }

  const contest = async (k: number) => {
    const next = results.map((r, j) => (j === k && r ? { ...r, contested: !r.contested } : r))
    setResults(next)
    if (next.every(Boolean)) await persist(next)
  }

  const finish = async () => onFinish(await persist(results))

  // ---------- telas ----------
  if (stage === 'gerando' || stage === 'corrigindo')
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <Capybara pose={stage === 'gerando' ? 'pensando' : 'estudando'} size={130} />
        <p className="mt-3 flex items-center gap-2 font-display text-lg font-bold">
          <Loader2 size={18} className="animate-spin" /> {stage === 'gerando' ? 'Preparando seu desafio…' : 'Corrigindo suas respostas…'}
        </p>
        <p className="mt-1 text-sm text-muted">{stage === 'gerando' ? (fromNotes ? 'Usando as suas anotações.' : 'Sua nota está vazia: vou usar conhecimento geral do tópico.') : 'Pode levar alguns segundos.'}</p>
        {onCancel && stage === 'gerando' && (
          <button onClick={onCancel} className="mt-4 text-sm font-semibold text-muted hover:text-ink">
            Cancelar
          </button>
        )}
      </div>
    )

  if (stage === 'erro')
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <Capybara pose="pensando" size={110} />
        <p className="mt-2 max-w-sm text-sm font-semibold text-rose-700">{error}</p>
        <div className="mt-4 flex gap-2">
          {onCancel && (
            <button onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Voltar
            </button>
          )}
          <button onClick={() => setAttempt((a) => a + 1)} className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ background: color }}>
            <RotateCcw size={15} /> Tentar de novo
          </button>
        </div>
      </div>
    )

  if (stage === 'resultado') {
    const ready = results.every(Boolean)
    const score = finalScore(results.filter(Boolean) as ChallengeResult[])
    const pct = Math.round(score * 100)
    return (
      <div>
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl p-4" style={{ background: tint(color, 0.08) }}>
          <Capybara pose={score >= 0.85 ? 'comemorando' : score >= 0.5 ? 'formado' : 'pensando'} size={90} />
          <div className="flex-1">
            <div className="font-display text-4xl font-extrabold" style={{ color }}>
              {ready ? `${pct}%` : '…'}
            </div>
            <div className="text-sm font-semibold">{score >= 0.85 ? 'Mandou muito bem!' : score >= 0.5 ? 'Bom caminho, revise os pontos abaixo.' : 'Vale reforçar esse tópico.'}</div>
            {!fromNotes && <div className="mt-1 text-xs text-muted">Desafio feito com conhecimento geral (sua nota estava vazia).</div>}
          </div>
        </div>
        <div className="space-y-3">
          {items.map((it, k) => {
            const r = results[k]
            return (
              <div key={k} className={`rounded-2xl border p-4 ${r?.contested ? 'border-dashed border-slate-300 opacity-70' : 'border-line'}`}>
                <div className="mb-1 flex items-start justify-between gap-3">
                  <span className="text-[11px] font-bold tracking-wide text-muted uppercase">
                    {k + 1}. {ITEM_LABEL[it.type]}
                  </span>
                  {r && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${r.contested ? 'bg-slate-100 text-slate-500' : r.score >= 0.75 ? 'bg-emerald-50 text-emerald-700' : r.score > 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                      {r.contested ? 'contestado' : r.score >= 0.75 ? 'certo' : r.score > 0 ? 'parcial' : 'errado'}
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold">{promptOf(it)}</div>
                <div className="mt-1.5 rounded-xl bg-[#f6f7f9] px-3 py-2 text-sm">
                  <span className="text-xs text-muted">Sua resposta: </span>
                  {showAnswer(it, answers[k]) || <em className="text-muted">em branco</em>}
                </div>
                {r?.feedback && <p className="mt-2 text-sm text-slate-700">{r.feedback}</p>}
                {r?.missing && r.missing.length > 0 && <p className="mt-1 text-xs text-muted">Faltou: {r.missing.join('; ')}</p>}
                {!r && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Não consegui corrigir este item. Compare com a referência e avalie você mesmo:
                    <span className="font-semibold">{it.type === 'aberta' ? it.expected : it.type === 'explique' ? it.keyPoints.join('; ') : ''}</span>
                    <button onClick={() => selfGrade(k, true)} className="rounded-lg bg-white px-2 py-1 font-bold text-emerald-700">
                      Acertei
                    </button>
                    <button onClick={() => selfGrade(k, false)} className="rounded-lg bg-white px-2 py-1 font-bold text-rose-700">
                      Errei
                    </button>
                  </div>
                )}
                {r && (
                  <button onClick={() => contest(k)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink" title="Se a correção estiver errada, este item sai da nota">
                    <Flag size={12} /> {r.contested ? 'Desfazer contestação' : 'Contestar correção'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-muted">As correções são sugestões do Claude e podem errar. Itens contestados não contam na nota.</p>
        <button
          onClick={finish}
          disabled={!ready}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-bold text-white disabled:opacity-50"
          style={{ background: color }}
        >
          <Check size={18} /> Concluir
        </button>
      </div>
    )
  }

  // respondendo
  const it = items[i]
  const a = answers[i]
  const answered = (k: number) => {
    const v = answers[k]
    return Array.isArray(v) ? v.some((x) => String(x).trim()) : v !== null && v !== undefined && String(v).trim() !== ''
  }
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {items.map((_, k) => (
          <button
            key={k}
            onClick={() => setI(k)}
            className="h-2 flex-1 rounded-full transition"
            style={{ background: k === i ? color : answered(k) ? tint(color, 0.45) : '#e6e8ee' }}
            aria-label={`Item ${k + 1}`}
          />
        ))}
      </div>
      <div className="mb-1 text-[11px] font-bold tracking-wide uppercase" style={{ color }}>
        {i + 1} de {items.length} · {ITEM_LABEL[it.type]}
      </div>

      <div key={i} className="capi-pop">
        {it.type === 'multipla' && (
          <>
            <p className="mb-4 font-display text-xl leading-snug font-bold">{it.question}</p>
            <div className="space-y-2">
              {it.options.map((o, k) => (
                <button
                  key={k}
                  onClick={() => setAnswer(k)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left text-sm font-semibold transition ${a === k ? 'border-transparent text-white' : 'border-line hover:bg-slate-50'}`}
                  style={a === k ? { background: color } : undefined}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${a === k ? 'bg-white/25' : 'bg-[#f1f2f5]'}`}>{'ABCDE'[k]}</span>
                  {o}
                </button>
              ))}
            </div>
          </>
        )}
        {it.type === 'vf' && (
          <>
            <p className="mb-4 font-display text-xl leading-snug font-bold">{it.statement}</p>
            <div className="grid grid-cols-2 gap-3">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  onClick={() => setAnswer(v)}
                  className={`rounded-2xl border py-4 text-lg font-bold transition ${a === v ? 'border-transparent text-white' : 'border-line hover:bg-slate-50'}`}
                  style={a === v ? { background: color } : undefined}
                >
                  {v ? 'Verdadeiro' : 'Falso'}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Pense no porquê antes de seguir: a explicação aparece no resultado.</p>
          </>
        )}
        {(it.type === 'aberta' || it.type === 'explique') && (
          <>
            <p className="mb-3 font-display text-xl leading-snug font-bold">{it.type === 'aberta' ? it.question : it.prompt}</p>
            <textarea
              value={String(a ?? '')}
              onChange={(e) => setAnswer(e.target.value)}
              rows={it.type === 'explique' ? 7 : 4}
              placeholder={it.type === 'explique' ? 'Explique com suas palavras, como se ensinasse a um colega…' : 'Sua resposta…'}
              className="w-full rounded-2xl border border-line bg-[#f8f9fb] px-4 py-3 text-sm outline-none focus:border-brand/50 focus:bg-white focus:ring-4 focus:ring-brand/10"
            />
          </>
        )}
        {it.type === 'lacunas' && (
          <>
            <p className="mb-3 text-sm text-muted">Complete com os termos que faltam:</p>
            <p className="text-lg leading-loose">
              {it.text.split(/_{3,}/).map((part, k, arr) => (
                <span key={k}>
                  {part}
                  {k < arr.length - 1 && (
                    <input
                      aria-label={`Lacuna ${k + 1}`}
                      value={(a as string[])[k] ?? ''}
                      onChange={(e) => setAnswer((a as string[]).map((x, j) => (j === k ? e.target.value : x)))}
                      className="mx-1 w-36 rounded-lg border-b-2 bg-[#f6f7f9] px-2 py-0.5 text-center font-semibold outline-none"
                      style={{ borderColor: color }}
                    />
                  )}
                </span>
              ))}
            </p>
          </>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button onClick={() => (i === 0 ? onCancel?.() : setI(i - 1))} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          {i === 0 ? <X size={16} /> : <ArrowLeft size={16} />} {i === 0 ? 'Sair' : 'Anterior'}
        </button>
        {i < items.length - 1 ? (
          <button onClick={() => setI(i + 1)} className="flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white hover:bg-black">
            Próxima <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={submit} className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ background: color }}>
            <Check size={16} /> Corrigir
          </button>
        )}
      </div>
    </div>
  )
}

function promptOf(it: ChallengeItem) {
  if (it.type === 'multipla' || it.type === 'aberta') return it.question
  if (it.type === 'vf') return it.statement
  if (it.type === 'explique') return it.prompt
  return it.text
}

function showAnswer(it: ChallengeItem, a: Answer): string {
  if (a === null || a === undefined) return ''
  if (it.type === 'multipla') return typeof a === 'number' ? it.options[a] : ''
  if (it.type === 'vf') return a === true ? 'Verdadeiro' : a === false ? 'Falso' : ''
  if (Array.isArray(a)) return a.join(' · ')
  return String(a)
}
