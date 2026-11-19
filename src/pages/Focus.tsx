import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, Check, Pause, Play, SkipForward, Square, X } from 'lucide-react'
import { db } from '../db/db'
import { useNotes, useSettings } from '../db/hooks'
import { addSession, pauseTimer, rateReview, resumeTimer, setTopicDone, startTimer, stopTimer, updateSession } from '../db/repo'
import type { ReviewRating } from '../db/types'
import { RATING_LABEL } from '../lib/review'
import { tint } from '../lib/colors'
import { fmtDuration } from '../lib/dates'
import { noteText } from '../lib/ai'
import { askBlockQuestions, showMascot } from '../lib/mascotBus'
import { buildPhases } from '../lib/focus'
import { ratingFromScore } from '../lib/challenge'
import { ChallengeRunner } from '../components/ChallengeRunner'
import { VoiceTextarea } from '../components/Voice'
import { useStudyContext } from '../components/ChallengeModal'
import { Capybara } from '../components/Capybara'
import { NoteEditor } from '../components/NoteEditor'
import { SubjectIcon } from '../components/SubjectIcon'
import { LogoMark } from '../components/Logo'

type Step = 'antes' | 'durante' | 'depois'
const GOALS = ['Entender o conceito', 'Fazer exercícios', 'Revisar minhas anotações', 'Criar flashcards', 'Resumir com minhas palavras']
const CONFIDENCE = [
  { v: 1, emoji: '', label: 'Perdido' },
  { v: 2, emoji: '', label: 'Inseguro' },
  { v: 3, emoji: '', label: 'Razoável' },
  { v: 4, emoji: '', label: 'Confiante' },
  { v: 5, emoji: '', label: 'Domino' },
]

function beep() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 660
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.65)
  } catch {
    /* sem som disponível */
  }
}

export function FocusPage() {
  const { blockId } = useParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const notes = useNotes()
  const data = useLiveQuery(async () => {
    const block = blockId ? await db.blocks.get(blockId) : undefined
    if (!block) return { block: undefined }
    const [subject, topic, timer] = await Promise.all([
      block.subjectId ? db.subjects.get(block.subjectId) : undefined,
      block.topicId ? db.topics.get(block.topicId) : undefined,
      db.timer.get('timer'),
    ])
    return { block, subject, topic, timer }
  }, [blockId])

  const [step, setStep] = useState<Step>('antes')
  const [goal, setGoal] = useState('')
  const [phaseIdx, setPhaseIdx] = useState(0)
  // Fim da fase pelo relógio (e não contando segundos): navegadores atrasam
  // os intervalos de abas em segundo plano, e a contagem ficaria lenta.
  const [endsAt, setEndsAt] = useState(0)
  const [pausedLeft, setPausedLeft] = useState(0) // segundos restantes enquanto pausado
  const [now, setNow] = useState(() => Date.now())
  const startPhase = (seconds: number, from = Date.now()) => {
    setEndsAt(from + seconds * 1000)
    setNow(Date.now())
  }
  const [paused, setPaused] = useState(false)
  const remaining = paused ? pausedLeft : Math.max(0, Math.ceil((endsAt - now) / 1000))
  const [showNote, setShowNote] = useState(true)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [recall, setRecall] = useState('')
  const [compare, setCompare] = useState(false)
  const [topicDone, setTopicDoneState] = useState(false)
  const [rating, setRating] = useState<ReviewRating | null>(null)
  const [saving, setSaving] = useState(false)
  const [quiz, setQuiz] = useState<'fechado' | 'aberto' | 'feito'>('fechado')
  const [quizScore, setQuizScore] = useState<number | null>(null)
  const studyCtx = useStudyContext(data?.block?.subjectId, data?.block?.topicId)
  const resumedOnce = useRef(false)

  const block = data?.block
  const subject = data?.subject
  const topic = data?.topic
  const color = subject?.color ?? '#c4471d'
  const total = block ? Math.max(10, block.end - block.start) : 50
  const phases = useMemo(() => buildPhases(total, settings.focusMinutes ?? 25, settings.focusPauseMinutes ?? 5), [total, settings.focusMinutes, settings.focusPauseMinutes])
  const phase = phases[phaseIdx]
  const note = useMemo(() => notes.find((n) => topic && n.topicId === topic.id) ?? notes.find((n) => !topic && n.subjectId === subject?.id), [notes, topic, subject])
  const allTitles = useMemo(() => new Set(notes.map((n) => n.title.trim().toLowerCase())), [notes])
  const isReview = block?.kind === 'revisao'

  // Se o cronômetro deste bloco já está rodando, vai direto para o foco
  useEffect(() => {
    if (resumedOnce.current || !data?.block) return
    resumedOnce.current = true
    if (data.timer?.blockId === data.block.id) {
      setStep('durante')
      startPhase(phases[0].minutes * 60)
    }
  }, [data, phases])

  // Contagem regressiva da fase
  useEffect(() => {
    if (step !== 'durante' || paused) return
    const tick = () => setNow(Date.now())
    const i = window.setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(i)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [step, paused])

  // Fim da fase: foco → pausa → foco… → depois
  useEffect(() => {
    if (step !== 'durante' || remaining > 0 || !phase) return
    beep()
    const next = phaseIdx + 1
    if (next >= phases.length) {
      setStep('depois')
      pauseTimer()
      return
    }
    setPhaseIdx(next)
    setPaused(false)
    // A próxima fase conta a partir do fim real da anterior (se a aba ficou parada, recupera o atraso)
    startPhase(phases[next].minutes * 60, Math.max(endsAt, Date.now() - phases[next].minutes * 60 * 1000 + 1000))
    if (phases[next].kind === 'pausa') pauseTimer()
    else resumeTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, step])

  if (data && !data.block)
    return (
      <Shell onClose={() => navigate('/calendario')}>
        <div className="mx-auto mt-20 max-w-md text-center">
          <Capybara pose="pensando" size={140} />
          <p className="mt-3 font-semibold">Não encontrei esse bloco. Ele pode ter sido remarcado.</p>
        </div>
      </Shell>
    )
  if (!block) return null

  const title = isReview ? `Revisão: ${topic?.name ?? subject?.name}` : (topic?.name ?? subject?.name ?? 'Estudo')

  const begin = async () => {
    const t = await db.timer.get('timer')
    if (t?.blockId === block.id) await resumeTimer()
    else await startTimer({ blockId: block.id, subjectId: block.subjectId, topicId: block.topicId, label: topic?.name ?? subject?.name ?? 'Estudo' })
    setPhaseIdx(0)
    startPhase(phases[0].minutes * 60)
    setStep('durante')
  }

  const togglePause = async () => {
    if (paused) {
      if (phase.kind === 'foco') await resumeTimer()
      startPhase(pausedLeft)
    } else {
      await pauseTimer()
      setPausedLeft(remaining)
    }
    setPaused(!paused)
  }

  const finish = async () => {
    setSaving(true)
    const extra = { goal: goal.trim() || undefined, confidence: confidence ?? undefined, recall: recall.trim() || undefined }
    const sessionId = await stopTimer(true, true)
    if (sessionId) await updateSession(sessionId, extra)
    else if (extra.goal || extra.confidence || extra.recall)
      await addSession({ blockId: block.id, subjectId: block.subjectId, topicId: block.topicId, startedAt: Date.now(), seconds: 0, ...extra })
    if (isReview && rating && topic) await rateReview(topic.id, rating, block.id)
    if (!isReview && topicDone && topic && !topic.done) await setTopicDone(topic.id, true)
    navigate('/', { replace: true })
    if (block.questions === undefined) askBlockQuestions(block.id)
    window.setTimeout(
      () =>
        showMascot({
          pose: 'comemorando',
          title: 'Bloco concluído!',
          text: `${title}${confidence ? ` · confiança ${confidence}/5` : ''}.${topicDone ? ' Agendei a primeira revisão para amanhã.' : ''}`,
          autoHideMs: 7000,
        }),
      900,
    )
  }

  const studied = Math.round(((data?.timer?.accumulated ?? 0) + (data?.timer?.startedAt ? (Date.now() - data.timer.startedAt) / 1000 : 0)) / 60)
  const focusDone = phases.slice(0, phaseIdx).filter((p) => p.kind === 'foco').length
  const focusTotal = phases.filter((p) => p.kind === 'foco').length
  const progress = phase ? 1 - remaining / (phase.minutes * 60) : 0

  return (
    <Shell onClose={() => navigate(-1)} color={color} title={title}>
      {step === 'antes' && (
        <div className="capi-pop mx-auto grid max-w-5xl items-center gap-10 px-6 py-10 lg:grid-cols-[280px_1fr]">
          <div className="flex flex-col items-center">
            <div className="relative mb-3 rounded-lg border border-line bg-white px-5 py-3 text-center font-display text-lg font-bold shadow-sm">
              O que você quer conseguir neste bloco?
              <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-r border-b border-line bg-white" />
            </div>
            <Capybara pose="pensando" size={170} />
          </div>
          <div className="rounded-xl border border-line bg-white p-8">
            <div className="mb-5 flex items-center gap-3">
              <SubjectIcon subject={subject} size={52} />
              <div>
                <div className="text-sm font-semibold" style={{ color }}>
                  {isReview ? 'Revisão' : 'Estudo'} · {subject?.name}
                </div>
                <h1 className="text-2xl font-bold">{topic?.name ?? subject?.name}</h1>
                <div className="text-sm text-muted">
                  {fmtDuration(total * 60)} · {focusTotal}× {settings.focusMinutes ?? 25} min de foco
                  {focusTotal > 1 ? ` com ${settings.focusPauseMinutes ?? 5} min de pausa` : ''}
                </div>
              </div>
            </div>
            <label htmlFor="focus-goal" className="mb-2 block text-sm font-semibold">
              Meu objetivo
            </label>
            <VoiceTextarea
              id="focus-goal"
              color={color}
              value={goal}
              onValue={setGoal}
              rows={2}
              placeholder="Ex.: entender a diferença entre velocidade média e instantânea"
              className="w-full resize-none rounded-2xl border border-line bg-[#f7f7f5] px-4 py-3 outline-none focus:border-brand/50 focus:bg-white focus:ring-4 focus:ring-brand/10"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {GOALS.map((g) => (
                <button key={g} onClick={() => setGoal(g)} className="rounded-md bg-[#efefed] px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-[#e7e7e4]">
                  {g}
                </button>
              ))}
            </div>
            <button
              onClick={begin}
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-lg font-bold text-white transition"
              style={{ background: color, boxShadow: `0 16px 34px -14px ${color}` }}
            >
              <Play size={20} /> Começar foco
            </button>
            <p className="mt-2 text-center text-xs text-muted">Dica: deixe o celular longe e feche as outras abas.</p>
          </div>
        </div>
      )}

      {step === 'durante' && phase && (
        <div className={`mx-auto grid max-w-6xl gap-6 px-6 py-6 ${showNote && phase.kind === 'foco' ? 'lg:grid-cols-[360px_1fr]' : ''}`}>
          <div className="flex flex-col items-center">
            <div className="text-xs font-bold tracking-widest uppercase" style={{ color: phase.kind === 'foco' ? color : '#4d7a57' }}>
              {phase.kind === 'foco' ? `Foco ${focusDone + 1} de ${focusTotal}` : 'Pausa'}
            </div>
            {/* anel do tempo */}
            <div className="relative my-4 grid h-64 w-64 place-items-center">
              <svg width="256" height="256" className="absolute inset-0 -rotate-90">
                <circle cx="128" cy="128" r="116" fill="none" stroke="#e7e7e4" strokeWidth="14" />
                <circle
                  cx="128"
                  cy="128"
                  r="116"
                  fill="none"
                  stroke={phase.kind === 'foco' ? color : '#4d7a57'}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 116}
                  strokeDashoffset={2 * Math.PI * 116 * (1 - progress)}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div className="text-center">
                <div className="font-display text-6xl font-extrabold tabular-nums">
                  {String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}
                </div>
                <div className="mt-1 text-sm text-muted">{paused ? 'pausado' : phase.kind === 'foco' ? 'foco total' : 'respire, alongue, beba água'}</div>
              </div>
            </div>
            {phase.kind === 'pausa' && <Capybara pose="relaxando" size={120} />}
            {goal && phase.kind === 'foco' && (
              <div className="mb-3 max-w-xs rounded-2xl px-4 py-2 text-center text-sm" style={{ background: tint(color, 0.08), color: `color-mix(in srgb, ${color} 80%, #000)` }}>
                {goal}
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={togglePause} className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold shadow-sm hover:bg-slate-50">
                {paused ? <Play size={16} /> : <Pause size={16} />} {paused ? 'Continuar' : 'Pausar'}
              </button>
              {phase.kind === 'pausa' && (
                <button onClick={() => { setPaused(false); setPausedLeft(0); setEndsAt(Date.now()); setNow(Date.now()) }} className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold shadow-sm hover:bg-slate-50">
                  <SkipForward size={16} /> Pular pausa
                </button>
              )}
              <button
                onClick={async () => {
                  await pauseTimer()
                  setStep('depois')
                }}
                className="flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white hover:bg-black"
              >
                <Square size={14} /> Terminar bloco
              </button>
            </div>
            {phase.kind === 'foco' && (
              <button onClick={() => setShowNote(!showNote)} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink">
                <BookOpen size={14} /> {showNote ? 'Esconder anotações' : 'Mostrar anotações'}
              </button>
            )}
            <div className="mt-4 flex gap-1.5">
              {phases.map((p, i) => (
                <span key={i} className={`h-2 rounded-full ${p.kind === 'foco' ? 'w-8' : 'w-3'}`} style={{ background: i < phaseIdx ? (p.kind === 'foco' ? color : '#4d7a57') : i === phaseIdx ? tint(p.kind === 'foco' ? color : '#4d7a57', 0.5) : '#e7e7e4' }} />
              ))}
            </div>
          </div>
          {showNote && phase.kind === 'foco' && (
            <div className="min-w-0 rounded-xl border border-line bg-white px-6 py-5 shadow-sm">
              {note ? (
                <>
                  <div className="mb-2 text-xs font-semibold text-muted">Suas anotações · salvas automaticamente</div>
                  <h2 className="mb-3 text-2xl font-bold">{note.title}</h2>
                  <NoteEditor key={note.id} note={note} subject={subject} allTitles={allTitles} />
                </>
              ) : (
                <p className="text-sm text-muted">Este bloco não tem uma nota ligada. Use o Caderno para criar uma.</p>
              )}
            </div>
          )}
        </div>
      )}

      {step === 'depois' && (
        <div className="capi-pop mx-auto max-w-3xl px-6 py-8">
          <div className="mb-6 flex items-end gap-3">
            <Capybara pose="comemorando" size={110} />
            <div className="mb-6 rounded-lg border border-line bg-white px-5 py-3 font-display text-lg font-bold shadow-sm">Boa! Antes de fechar, como foi?</div>
          </div>
          <div className="space-y-5 rounded-xl border border-line bg-white p-7">
            <div className="text-sm text-muted">
              {title} · {studied} min de foco{goal ? ` · objetivo: ${goal}` : ''}
            </div>

            <section className="rounded-2xl p-4" style={{ background: tint(color, 0.06), boxShadow: `inset 0 0 0 1.5px ${tint(color, 0.25)}` }}>
              {quiz === 'aberto' && studyCtx ? (
                <ChallengeRunner
                  ctx={studyCtx.ctx}
                  subjectId={block.subjectId!}
                  topicId={block.topicId}
                  origin="bloco"
                  count={3}
                  color={color}
                  onCancel={() => setQuiz('fechado')}
                  onFinish={(c) => {
                    setQuizScore(c.score)
                    setQuiz('feito')
                    if (isReview) setRating(ratingFromScore(c.score))
                  }}
                />
              ) : quiz === 'feito' ? (
                <div className="flex items-center gap-3 text-sm font-semibold">
                  <span className="font-display text-2xl font-extrabold" style={{ color }}>
                    {Math.round((quizScore ?? 0) * 100)}%
                  </span>
                  no desafio rápido{isReview ? ` · revisão marcada como "${RATING_LABEL[ratingFromScore(quizScore ?? 0)].label}"` : ''}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-sans text-sm font-bold">Desafio rápido (3 itens)</h3>
                    <p className="text-xs text-muted">{isReview ? 'Teste sua memória: o resultado define a próxima revisão.' : 'Teste agora o que ficou do bloco. Leva uns 2 minutos.'}</p>
                  </div>
                  <button onClick={() => setQuiz('aberto')} disabled={!block.subjectId} className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: color }}>
                    Fazer desafio
                  </button>
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-2 font-sans text-sm font-bold">1. Quanto você confia no que estudou?</h3>
              <div className="grid grid-cols-5 gap-2">
                {CONFIDENCE.map((c) => (
                  <button
                    key={c.v}
                    onClick={() => setConfidence(c.v)}
                    className={`rounded-2xl border py-2.5 text-center transition ${confidence === c.v ? 'border-transparent text-white' : 'border-line hover:bg-slate-50'}`}
                    style={confidence === c.v ? { background: color } : undefined}
                  >
                    <div className="font-display text-2xl">{c.v}</div>
                    <div className="text-[11px] font-bold">{c.label}</div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-1 font-sans text-sm font-bold">2. Tela em branco (opcional)</h3>
              <p className="mb-2 text-xs text-muted">Sem olhar as anotações, escreva tudo o que você lembra. É o exercício que mais fixa o conteúdo.</p>
              <VoiceTextarea
                id="focus-recall"
                color={color}
                value={recall}
                onValue={setRecall}
                rows={5}
                placeholder="O que eu lembro sobre o tópico…"
                className="w-full rounded-2xl border border-line bg-[#f7f7f5] px-4 py-3 text-sm outline-none focus:border-brand/50 focus:bg-white focus:ring-4 focus:ring-brand/10"
              />
              {recall.trim() && note && (
                <button onClick={() => setCompare(!compare)} className="mt-2 text-xs font-bold text-brand">
                  {compare ? 'Esconder comparação' : 'Comparar com minhas anotações'}
                </button>
              )}
              {compare && note && (
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-[#f4f4f2] p-3 text-sm whitespace-pre-wrap">
                    <div className="mb-1 text-[11px] font-bold text-muted uppercase">O que lembrei</div>
                    {recall}
                  </div>
                  <div className="rounded-2xl p-3 text-sm whitespace-pre-wrap" style={{ background: tint(color, 0.07) }}>
                    <div className="mb-1 text-[11px] font-bold text-muted uppercase">Minhas anotações</div>
                    {noteText(note.content, 3000) || 'A nota está vazia.'}
                  </div>
                </div>
              )}
            </section>

            {isReview ? (
              <section>
                <h3 className="mb-2 font-sans text-sm font-bold">3. Como foi a revisão?</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(['dificil', 'ok', 'facil'] as ReviewRating[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRating(r)}
                      className={`rounded-2xl border py-2.5 text-center ${rating === r ? 'border-transparent text-white' : 'border-line hover:bg-slate-50'}`}
                      style={rating === r ? { background: color } : undefined}
                    >
                      <div className="text-xs font-bold">{RATING_LABEL[r].label}</div>
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              topic &&
              !topic.done && (
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-[#f4f4f2] px-4 py-3 text-sm font-semibold">
                  <input type="checkbox" className="h-5 w-5" style={{ accentColor: color }} checked={topicDone} onChange={(e) => setTopicDoneState(e.target.checked)} />
                  Concluí o tópico "{topic.name}" (começa a revisão espaçada amanhã)
                </label>
              )
            )}

            <button
              onClick={finish}
              disabled={saving || (isReview && !rating)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-lg font-bold text-white transition disabled:opacity-50"
              style={{ background: color, boxShadow: `0 16px 34px -14px ${color}` }}
            >
              <Check size={20} /> {saving ? 'Salvando…' : 'Concluir bloco'}
            </button>
            {isReview && !rating && <p className="-mt-3 text-center text-xs text-muted">Escolha como foi a revisão para concluir.</p>}
          </div>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children, onClose, color = '#c4471d', title }: { children: React.ReactNode; onClose: () => void; color?: string; title?: string }) {
  return (
    <div className="page-in relative min-h-screen overflow-hidden" style={{ background: '#ffffff', borderTop: `4px solid ${color}` }}>
      <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-2.5">
          <LogoMark size={36} />
          <div className="leading-none">
            <div className="font-display text-[16px] font-bold">Modo foco</div>
            {title && <div className="mt-1 max-w-[50vw] truncate text-xs text-muted">{title}</div>}
          </div>
        </div>
        <button onClick={onClose} className="flex items-center gap-1.5 rounded-md bg-white/80 px-3.5 py-2 text-sm font-semibold text-slate-600 backdrop-blur hover:bg-white" title="Sair (o cronômetro continua no topo do site)">
          <X size={16} /> Sair
        </button>
      </header>
      {children}
    </div>
  )
}
