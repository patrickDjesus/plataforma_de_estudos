import { useEffect, useMemo, useRef, useState } from 'react'
import { capiMood } from '../lib/mascotBus'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleSlash, Flag, RotateCcw, X, XCircle } from 'lucide-react'
import { Spinner, VoiceTextarea } from './Voice'
import { uid } from '../db/db'
import { logChallengeErrors, saveChallenge } from '../db/repo'
import type { Challenge, ChallengeItem, ChallengeResult } from '../db/types'
import { AIError, getAI } from '../lib/ai'
import { ITEM_LABEL, finalScore, gradeLocal, needsAIGrading, sanitizeItems } from '../lib/challenge'
import { challengePrompt, contextBlock, gradePrompt, type ChallengeOptions, type GradeEntry, type StudyContext } from '../lib/prompts'
import { tint } from '../lib/colors'
import { Capybara, type CapiPose } from './Capybara'

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
  options?: ChallengeOptions
}

/** Gera, aplica e corrige um desafio de recuperação. */
export function ChallengeRunner({ ctx, subjectId, topicId, origin, count, color, onFinish, onCancel, options }: RunnerProps) {
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
    capiMood('focado', 5000)
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
        const raw = await ai.json<unknown>(challengePrompt(ctx, count, options), { tier: count <= 3 ? 'quick' : 'default', fresh: true, signal: ctl.current!.signal })
        const list = sanitizeItems(raw, fromNotes && (!options?.types?.length || options.types.includes('lacunas'))).slice(0, count)
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
    const c: Challenge = { id: idRef.current, subjectId, topicId, origin, fromNotes, createdAt: createdAt.current, items, answers, results: done, score: finalScore(done), request: options?.request?.trim() || undefined }
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

  const finishing = useRef(false)
  const finish = async () => {
    // Clique duplo não pode registrar a revisão duas vezes
    if (finishing.current) return
    finishing.current = true
    const c = await persist(results)
    await logChallengeErrors(c) // erros vão para o caderno de erros
    onFinish(c)
  }

  // ---------- telas ----------
  if (stage === 'gerando' || stage === 'corrigindo')
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <Capybara pose={stage === 'gerando' ? 'pensando' : 'estudando'} size={130} />
        <p className="mt-3 flex items-center gap-2 font-display text-lg font-bold">
          <Spinner size={24} /> {stage === 'gerando' ? 'Preparando seu desafio…' : 'Corrigindo suas respostas…'}
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

  if (stage === 'resultado')
    return (
      <ResultView
        items={items}
        answers={answers}
        results={results}
        fromNotes={fromNotes}
        color={color}
        onSelfGrade={selfGrade}
        onContest={contest}
        onFinish={finish}
      />
    )

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
            style={{ background: k === i ? color : answered(k) ? tint(color, 0.45) : '#e7e7e4' }}
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
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs font-bold ${a === k ? 'bg-white/25' : 'bg-[#efefed]'}`}>{'ABCDE'[k]}</span>
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
            <VoiceTextarea
              color={color}
              value={String(a ?? '')}
              onValue={(v) => setAnswer(v)}
              rows={it.type === 'explique' ? 7 : 4}
              placeholder={it.type === 'explique' ? 'Explique com suas palavras, como se ensinasse a um colega…' : 'Sua resposta…'}
              className="w-full rounded-2xl border border-line bg-[#f7f7f5] px-4 py-3 text-sm outline-none focus:border-brand/50 focus:bg-white focus:ring-4 focus:ring-brand/10"
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
                      className="mx-1 w-36 rounded-lg border-b-2 bg-[#f4f4f2] px-2 py-0.5 text-center font-semibold outline-none"
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

// ---------- Resultado: reação do Capi + correção questão por questão ----------

function reaction(score: number): { pose: CapiPose; title: string; text: string } {
  if (score >= 0.85) return { pose: 'comemorando', title: 'Uhuul, mandou muito bem!', text: 'Você domina esse assunto. Bora manter assim!' }
  if (score >= 0.6) return { pose: 'formado', title: 'Muito bom!', text: 'Quase lá. Vamos ver juntos o que dá pra melhorar.' }
  if (score >= 0.3) return { pose: 'pensando', title: 'Hmm, deu pra salvar algumas…', text: 'Tem coisa pra reforçar. Vou te mostrar questão por questão.' }
  return { pose: 'chorando', title: 'Buáá… essa doeu.', text: 'Tudo bem errar: é assim que se aprende. Vamos ver a correção com calma.' }
}

function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

function verdict(r: ChallengeResult | null) {
  if (!r) return { label: 'sem correção', cls: 'bg-slate-100 text-slate-600', icon: <CircleSlash size={16} />, pose: 'pensando' as CapiPose }
  if (r.contested) return { label: 'contestado', cls: 'bg-slate-100 text-slate-500', icon: <Flag size={15} />, pose: 'pensando' as CapiPose }
  if (r.score >= 0.75) return { label: 'Acertou', cls: 'bg-emerald-50 text-emerald-700', icon: <CheckCircle2 size={16} />, pose: 'comemorando' as CapiPose }
  if (r.score > 0) return { label: 'Quase', cls: 'bg-amber-50 text-amber-700', icon: <CheckCircle2 size={16} />, pose: 'formado' as CapiPose }
  return { label: 'Errou', cls: 'bg-rose-50 text-rose-700', icon: <XCircle size={16} />, pose: 'chorando' as CapiPose }
}

function correctAnswer(it: ChallengeItem): string {
  if (it.type === 'multipla') return it.options[it.correct]
  if (it.type === 'vf') return it.answer ? 'Verdadeiro' : 'Falso'
  if (it.type === 'aberta') return it.expected
  if (it.type === 'explique') return it.keyPoints.join(' · ')
  return it.answers.join(' · ')
}

function capiComment(it: ChallengeItem, r: ChallengeResult | null): string {
  if (!r) return 'Não consegui corrigir esta. Compare com a resposta esperada e me diga se acertou.'
  if (r.feedback) return r.feedback
  if (r.score >= 0.75) return it.type === 'lacunas' ? 'Completou certinho!' : 'Na mosca!'
  return 'Essa escapou. Dá uma olhada na resposta certa ao lado.'
}

export function ResultView({
  items,
  answers,
  results,
  fromNotes,
  color,
  onSelfGrade,
  onContest,
  onFinish,
}: {
  items: ChallengeItem[]
  answers: Answer[]
  results: (ChallengeResult | null)[]
  fromNotes: boolean
  color: string
  onSelfGrade: (k: number, ok: boolean) => void
  onContest: (k: number) => void
  onFinish: () => void
}) {
  const [view, setView] = useState<'reacao' | number>('reacao')
  const graded = results.filter(Boolean) as ChallengeResult[]
  const score = finalScore(graded)
  const pct = useCountUp(Math.round(score * 100))
  const hits = graded.filter((r) => !r.contested && r.score >= 0.75).length
  const ready = results.every(Boolean)
  const re = reaction(score)

  if (view === 'reacao')
    return (
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <span className="absolute inset-x-6 bottom-2 h-10 rounded-md blur-2xl" style={{ background: tint(color, 0.45) }} />
          <Capybara key={re.pose} pose={re.pose} size={190} className="relative" />
        </div>
        <div className="pop-score font-display text-6xl font-extrabold tabular-nums" style={{ color }}>
          {pct}%
        </div>
        <h3 className="mt-1 text-xl font-bold">{re.title}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted">{re.text}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {items.map((_, k) => {
            const v = verdict(results[k])
            return (
              <button key={k} onClick={() => setView(k)} className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold ${v.cls}`} title={`Questão ${k + 1}: ${v.label}`}>
                {v.icon} {k + 1}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-muted">
          {hits} de {items.length} certas{!fromNotes ? ' · desafio feito com conhecimento geral' : ''}
        </p>
        <button onClick={() => setView(0)} className="mt-6 flex items-center gap-2 rounded-2xl px-6 py-3.5 font-bold text-white transition" style={{ background: color, boxShadow: `0 14px 30px -14px ${color}` }}>
          Ver a correção <ArrowRight size={18} />
        </button>
      </div>
    )

  const k = view
  const it = items[k]
  const r = results[k]
  const v = verdict(r)
  const last = k === items.length - 1
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {items.map((_, j) => {
          const vj = verdict(results[j])
          return (
            <button
              key={j}
              onClick={() => setView(j)}
              className="h-2 flex-1 rounded-full transition"
              style={{ background: j === k ? color : vj.label === 'Acertou' ? '#34d399' : vj.label === 'Quase' ? '#fbbf24' : vj.label === 'Errou' ? '#fb7185' : '#e7e7e4', opacity: j === k ? 1 : 0.7 }}
              aria-label={`Questão ${j + 1}`}
            />
          )
        })}
      </div>

      <div key={k} className="capi-pop">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wide uppercase" style={{ color }}>
            Questão {k + 1} de {items.length} · {ITEM_LABEL[it.type]}
          </span>
          <span className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold ${v.cls}`}>
            {v.icon} {v.label}
          </span>
        </div>
        <p className="mb-4 font-display text-lg leading-snug font-bold">{promptOf(it)}</p>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className={`rounded-2xl p-3.5 ${r && !r.contested && r.score >= 0.75 ? 'bg-emerald-50' : r && !r.contested && r.score === 0 ? 'bg-rose-50' : 'bg-[#f4f4f2]'}`}>
            <div className="mb-1 text-[11px] font-bold tracking-wide text-muted uppercase">Sua resposta</div>
            <div className="text-sm font-semibold">{showAnswer(it, answers[k]) || <em className="font-normal text-muted">em branco</em>}</div>
          </div>
          <div className="rounded-2xl p-3.5" style={{ background: tint(color, 0.08) }}>
            <div className="mb-1 text-[11px] font-bold tracking-wide text-muted uppercase">{it.type === 'explique' ? 'O que não podia faltar' : 'Resposta certa'}</div>
            <div className="text-sm font-semibold">{correctAnswer(it)}</div>
          </div>
        </div>

        {/* Comentário do Capi */}
        <div className="mt-4 flex items-end gap-2">
          <Capybara key={`${k}-${v.pose}`} pose={v.pose} size={78} />
          <div className="relative mb-4 flex-1 rounded-2xl border border-line bg-white px-4 py-3 text-sm shadow-sm">
            <span className="absolute bottom-3 -left-1.5 h-3 w-3 rotate-45 border-b border-l border-line bg-white" />
            {capiComment(it, r)}
            {r?.missing && r.missing.length > 0 && <div className="mt-1.5 text-xs text-muted">Faltou: {r.missing.join('; ')}</div>}
            {'explanation' in it && it.explanation && r && r.score >= 0.75 && <div className="mt-1.5 text-xs text-muted">{it.explanation}</div>}
          </div>
        </div>

        {!r ? (
          <div className="flex gap-2">
            <button onClick={() => onSelfGrade(k, true)} className="flex-1 rounded-xl bg-emerald-50 py-2.5 text-sm font-bold text-emerald-700">
              Acertei
            </button>
            <button onClick={() => onSelfGrade(k, false)} className="flex-1 rounded-xl bg-rose-50 py-2.5 text-sm font-bold text-rose-700">
              Errei
            </button>
          </div>
        ) : (
          <button onClick={() => onContest(k)} className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink" title="Se a correção estiver errada, esta questão sai da nota">
            <Flag size={12} /> {r.contested ? 'Desfazer contestação' : 'Discordo da correção'}
          </button>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button onClick={() => setView(k === 0 ? 'reacao' : k - 1)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          <ArrowLeft size={16} /> {k === 0 ? 'Placar' : 'Anterior'}
        </button>
        {last ? (
          <button onClick={onFinish} disabled={!ready} className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: color }}>
            <Check size={16} /> Concluir
          </button>
        ) : (
          <button onClick={() => setView(k + 1)} className="flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white hover:bg-black">
            Próxima <ArrowRight size={16} />
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">As correções são sugestões do Claude e podem errar.</p>
    </div>
  )
}
