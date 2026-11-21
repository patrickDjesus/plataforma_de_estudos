import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Calculator, Check, Clock3, Coffee, HelpCircle, Lightbulb, Play, Repeat, SkipForward, Sparkles, Target, X } from 'lucide-react'
import { MathText } from '../../components/MathText'
import { Spinner } from '../../components/Voice'
import { difInfo, fmtClock, qHeat, askPrompt, type Conf, type RushQ, type RushState } from '../../lib/rush'
import { tint } from '../../lib/colors'
import { useSubjectMap } from '../../db/hooks'
import { RushCapi, type CapiMood } from './RushCapi'
import { askAboutQuestion, errCopy, finishAnswer, goNext, markDoubt, overrideWrong, say, sfx, skipQuestion, submit, togglePause, applyFifty } from './actions'
import { centerOf, confetti } from '../../lib/sfx'
import { fx, Ring } from './RushFx'
import { FxText, Fx } from '../../components/Fx'

const OK_WORDS = ['Acertou!', 'Mandou bem!', 'Isso aí!', 'Arrasou!', 'Boa!!']

/** Cartão conforme a dificuldade: num fundo escuro, ele "flutua" com sombra pesada e borda avermelhada. */
function heatStyle(q: RushQ) {
  const h = qHeat(q)
  if (q.boss) return { border: '#b3122e', shadow: '0 30px 80px -20px rgba(0,0,0,.9), 0 0 0 1px rgba(255,40,50,.25)' }
  if (h >= 0.7) return { border: '#7a1020', shadow: '0 30px 70px -24px rgba(0,0,0,.85)' }
  if (h >= 0.45) return { border: '#3a3d47', shadow: '0 24px 60px -24px rgba(0,0,0,.7)' }
  return { border: '#e3e6ee', shadow: '0 8px 0 #e6e8f0' }
}

export function RushQuestion({ S }: { S: RushState }) {
  const q = S.current!
  return <QuestionCard key={q.id} S={S} q={q} />
}

function QuestionCard({ S, q }: { S: RushState; q: RushQ }) {
  const subjects = useSubjectMap()
  const sub = subjects.get(q.materia)
  const color = sub?.color ?? '#3e63f2'
  const ph = S.phase
  const L = S.last ?? {}
  const answered = ph === 'feedback' || ph === 'selfgrade'
  const [selected, setSelected] = useState<number | null>(null)
  const [conf, setConf] = useState<Conf>('acho')
  const [hintUsed, setHintUsed] = useState(false)
  const [fifty, setFifty] = useState<number[]>([])
  const [ans, setAns] = useState('')
  const [rac, setRac] = useState('')
  const [now, setNow] = useState(Date.now())
  const [sleepy, setSleepy] = useState(false)
  const [shake, setShake] = useState(0)
  const ctx = { conf, hintUsed, fiftyHidden: fifty }
  const card = useRef<HTMLDivElement>(null)
  const ansRef = useRef<HTMLInputElement>(null)
  const said = useRef({ t60: false, t150: false, typing: false, picks: 0, idle: false })
  const lastAct = useRef(Date.now())

  // relógio da questão + Mendi que comenta o tempo e cochila
  useEffect(() => {
    if (ph !== 'answer' || S.paused) return
    const i = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      const el = t - S.qStart
      if (el > 60000 && !said.current.t60) (said.current.t60 = true), say('t60')
      if (el > 150000 && !said.current.t150) (said.current.t150 = true), say('t150')
      const idle = t - lastAct.current
      if (idle > 45000 && !said.current.idle) (said.current.idle = true), say('idle')
      if (idle > 100000 && !sleepy) (setSleepy(true), say('sleepy'))
    }, 1000)
    return () => window.clearInterval(i)
  }, [ph, S.paused, S.qStart, sleepy])
  useEffect(() => {
    const act = () => {
      lastAct.current = Date.now()
      if (sleepy) {
        setSleepy(false)
        said.current.idle = false
        say('wake')
      }
    }
    const evs = ['pointermove', 'keydown', 'pointerdown', 'touchstart'] as const
    evs.forEach((e) => window.addEventListener(e, act, { passive: true }))
    return () => evs.forEach((e) => window.removeEventListener(e, act))
  }, [sleepy])

  // efeitos ao responder
  useEffect(() => {
    if (ph !== 'feedback') return
    const [x, y] = centerOf(card.current?.querySelector('[data-verdict]') ?? card.current)
    if (L.correct) {
      confetti(x, y, q.boss ? 160 : 50 + q.dificuldade * 6)
      fx({ type: 'flash', tone: q.boss ? 'gold' : 'ok' })
      if (L.pts) window.setTimeout(() => fx({ type: 'fly', text: `+${L.pts}`, from: [x, y] }), 250)
    } else {
      setShake((n) => n + 1)
      fx({ type: 'flash', tone: 'bad' })
    }
    // foco no "Próxima"
    window.setTimeout(() => document.getElementById('rush-next')?.focus({ preventScroll: true }), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ph, L.correct])

  // teclado: A–E escolhem, Enter confere / próxima, H dica
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (S.paused) return
      const tag = (e.target as HTMLElement).tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA'
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        if (ph === 'feedback' && (e.target as HTMLElement).id !== 'rush-ask' && tag !== 'TEXTAREA' && !(tag === 'BUTTON' && (e.target as HTMLElement).id !== 'rush-next')) {
          e.preventDefault()
          goNext()
        } else if (ph === 'answer' && (e.target as HTMLElement).id === 'rush-ans') {
          e.preventDefault()
          submit(ctx, { choice: null, answer: ans, rac })
        } else if (ph === 'answer' && q.formato === 'multipla' && selected != null && !inField) {
          e.preventDefault()
          submit(ctx, { choice: selected, answer: '', rac: '' })
        }
        return
      }
      if (ph !== 'answer' || inField || e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (q.formato === 'multipla') {
        const i = 'abcde'.indexOf(k)
        if (i >= 0 && i < q.alternativas.length && !fifty.includes(i)) {
          setSelected(i)
          sfx('pop')
          return
        }
      }
      if (k === 'h' && q.dica && !hintUsed) {
        setHintUsed(true)
        sfx('pop')
        say('hint')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    if (q.formato === 'aberta') ansRef.current?.focus({ preventScroll: true })
  }, [q.formato])

  const elapsed = answered && L.ms != null ? L.ms : (S.paused || now) - S.qStart
  const di = difInfo(q.dificuldade)
  const hs = heatStyle(q)
  const mood: CapiMood = ph === 'checking' ? 'think' : ph === 'feedback' ? (L.correct ? 'happy' : 'sad') : sleepy ? 'sleepy' : q.boss ? 'boss' : S.stats.streak >= 8 && qHeat(q) < 0.45 ? 'cool' : 'idle'
  const fastLeft = Math.max(0, 1 - elapsed / 45000)
  const onFire = S.stats.streak >= 5 && ph !== 'feedback'

  return (
    <div
      id="rush-card"
      ref={card}
      key={shake}
      className={`essential-motion relative rounded-[26px] border-[3px] bg-white p-5 sm:p-7 ${shake ? 'rush-shake' : 'rush-enter'} ${q.boss ? 'rush-boss' : ''}`}
      style={{ borderColor: ph === 'feedback' ? (L.correct ? '#22b573' : '#ff5c7a') : hs.border, boxShadow: ph === 'feedback' ? `0 8px 0 ${L.correct ? '#16915a' : '#e03a5a'}` : onFire ? `${hs.shadow}, 0 0 30px -6px rgba(255,120,30,.45)` : hs.shadow }}
    >
      {/* faixa da matéria e número da questão */}
      <span className="absolute -top-[3px] right-28 left-8 h-[7px] rounded-b-lg" style={{ background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 70%, #000))` }} />
      <span className="absolute -top-4 left-6 z-[2] rounded-full px-3 py-0.5 font-display text-[13px] font-bold text-white" style={{ background: color, boxShadow: `0 3px 0 color-mix(in srgb, ${color} 70%, #000)` }}>
        {onFire && <Fx name="fire" className="mr-1" />}Q {S.stats.done + (answered ? 0 : 1)}
      </span>
      {ph !== 'feedback' && (
        <div className="absolute -top-12 right-4 z-[3]">
          <RushCapi mood={mood} size={74} heat={qHeat(q)} />
        </div>
      )}

      {q.boss && (
        <div className="rush-enter mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#2a0409] via-[#8f0c22] to-[#2a0409] px-4 py-2.5 text-white">
          <Fx name="skull" size={28} />
          <div>
            <div className="font-display text-xl font-extrabold tracking-wide">QUESTÃO CHEFÃO</div>
            <div className="text-xs font-semibold opacity-85">Vale 3x os pontos. Respira fundo, lê duas vezes e vai com tudo.</div>
          </div>
        </div>
      )}

      {/* meta */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5 pr-20">
        <span className={`flex items-center gap-2 rounded-full py-1 pr-3 pl-2 text-xs font-extrabold ${di.tier >= 4 ? 'bg-[#16181d] text-white' : 'bg-[#f1f2f5]'}`} title={`Dificuldade ${di.d} de 10`}>
          <span className="flex gap-[2px]">
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} className="block h-2.5 w-1.5 rounded-[2px]" style={{ background: i < di.d ? (i < 4 ? '#94a3b8' : i < 6 ? '#f59e0b' : i < 8 ? '#ef4444' : '#b91c1c') : di.tier >= 4 ? 'rgba(255,255,255,.15)' : '#dfe3ea' }} />
            ))}
          </span>
          <FxText text={di.emoji} /> {di.d}/10 · {di.label}
        </span>
        <span className="rounded-full px-3 py-1 text-xs font-extrabold" style={{ background: tint(color, 0.14), color: `color-mix(in srgb, ${color} 75%, #000)` }}>
          {sub?.name ?? 'Matéria'}
        </span>
        {q.kind === 'revisao' ? (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800">
            <Repeat size={12} /> Revisão {q.revIdx}/{q.revOf}
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-xs font-extrabold text-brand">
            <Sparkles size={12} /> Nova
          </span>
        )}
        {q.topico && <span className="rounded-full bg-[#f1f2f5] px-3 py-1 text-xs font-bold text-muted">{q.topico}</span>}
        <span className="flex items-center gap-1 rounded-full bg-[#f1f2f5] px-3 py-1 text-xs font-bold text-muted">
          {q.tipo === 'teoria' ? <Lightbulb size={12} /> : <Calculator size={12} />} {q.tipo === 'teoria' ? 'Teoria' : 'Conta'}
        </span>
        <span className={`ml-auto flex items-center gap-1.5 text-sm font-extrabold tabular-nums ${!answered && elapsed < 45000 ? 'text-amber-600' : 'text-muted'}`} title="Anel amarelo = bônus de velocidade (+25% em até 45s)">
          {answered ? (
            <Clock3 size={15} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 20 20" className="-rotate-90">
              <circle cx="10" cy="10" r="8" fill="none" stroke="#e3e6ee" strokeWidth="4" />
              <circle cx="10" cy="10" r="8" fill="none" stroke={fastLeft > 0 ? '#ffc93c' : '#e3e6ee'} strokeWidth="4" strokeLinecap="round" strokeDasharray="50.3" strokeDashoffset={50.3 * (1 - fastLeft)} className="transition-all duration-1000 ease-linear" />
            </svg>
          )}
          {fmtClock(elapsed)}
        </span>
      </div>
      {q.kind === 'revisao' && <p className="-mt-2 mb-3 text-sm font-bold text-muted">Tentativa de novo: {q.conceito}</p>}

      <MathText text={q.enunciado} className="mb-5 max-w-[72ch] text-[17px] leading-relaxed font-semibold break-words whitespace-pre-wrap" />

      {/* alternativas ou resposta */}
      {q.formato === 'multipla' ? (
        <div className="mb-4 grid gap-2.5" role="radiogroup" aria-label="Alternativas">
          {q.alternativas.map((a, i) => {
            const gone = fifty.includes(i)
            const right = answered && i === q.correta
            const wrong = answered && i === L.choice && i !== q.correta
            const sel = !answered && i === selected
            return (
              <button
                key={i}
                type="button"
                disabled={answered || ph === 'checking' || gone}
                aria-pressed={sel}
                onClick={() => {
                  setSelected(i)
                  sfx('pop')
                  if (said.current.picks < 2 && Math.random() < 0.6) {
                    said.current.picks++
                    say('pick', undefined, { L: 'ABCDE'[i] })
                  }
                }}
                className={`rush-alt grid grid-cols-[34px_1fr] items-center gap-3 rounded-2xl border-[3px] px-3.5 py-2.5 text-left font-semibold transition active:translate-y-1 active:shadow-none ${gone ? 'pointer-events-none scale-[.98] opacity-30 line-through' : ''} ${right ? 'rk-right rk-shine-host border-emerald-500 bg-emerald-50 shadow-[0_4px_0_#22b573]' : wrong ? 'rk-wrong border-rose-400 bg-rose-50 shadow-[0_4px_0_#ff5c7a]' : sel ? 'shadow-[0_4px_0_var(--c)]' : 'border-line bg-white shadow-[0_4px_0_#e6e8f0] enabled:hover:-translate-y-0.5 enabled:hover:border-[var(--c)] enabled:hover:shadow-[0_6px_0_#e6e8f0]'}`}
                style={{ ['--c' as string]: color, animationDelay: `${i * 0.05}s`, ...(sel ? { borderColor: color, background: tint(color, 0.1) } : {}) }}
              >
                <span className={`grid h-[34px] w-[34px] place-items-center rounded-full font-display text-base font-bold ${right ? 'bg-emerald-500 text-white' : wrong ? 'bg-rose-500 text-white' : sel ? 'text-white' : 'bg-[#f1f2f5]'}`} style={sel ? { background: color } : undefined}>
                  {'ABCDE'[i]}
                </span>
                <MathText as="span" text={a} className="break-words whitespace-pre-wrap" />
              </button>
            )
          })}
        </div>
      ) : (
        <div className="mb-2">
          <div className="flex items-center gap-2.5">
            <input
              id="rush-ans"
              ref={ansRef}
              value={answered ? (L.answer ?? '') : ans}
              onChange={(e) => {
                setAns(e.target.value)
                if (!said.current.typing && e.target.value.length >= 2) (said.current.typing = true), say('typing')
              }}
              disabled={answered || ph === 'checking'}
              autoComplete="off"
              spellCheck={false}
              placeholder={q.tipo === 'teoria' ? 'Escreva sua resposta' : 'Resultado final'}
              aria-label="Sua resposta"
              className="min-w-0 flex-1 rounded-2xl border-[3px] border-line px-4 py-3 font-display text-xl font-bold outline-none focus:border-[var(--c)]"
              style={{ ['--c' as string]: color }}
            />
            {q.unidade && <MathText as="span" text={q.unidade.includes('\\') ? `$${q.unidade}$` : q.unidade} className="font-display text-lg font-bold whitespace-nowrap text-muted" />}
          </div>
          {!answered && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-bold text-muted">Mostrar como pensei (opcional, ajuda a achar o erro)</summary>
              <textarea value={rac} onChange={(e) => setRac(e.target.value)} disabled={ph === 'checking'} placeholder="Ex.: fiz Aa x Aa e contei 1/4 de aa…" className="mt-2 min-h-20 w-full rounded-2xl border-2 border-line p-3 text-sm outline-none focus:border-brand" />
            </details>
          )}
        </div>
      )}

      {ph === 'answer' && (
        <>
          {hintUsed && q.dica && (
            <div className="rush-enter mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold">
              <b><Fx name="bulb" /> Dica: </b>
              <MathText as="span" text={q.dica} />
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Quão confiante você está?">
            <span className="text-[11px] font-bold tracking-wider text-muted uppercase">Confiança:</span>
            {(
              [
                ['certeza', '✅ Certeza'],
                ['acho', '🤔 Acho'],
                ['chute', '🎲 Chute'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={conf === v}
                onClick={() => {
                  setConf(v)
                  sfx('pop')
                  say(v)
                }}
                className={`rounded-full border-2 px-3.5 py-1 text-sm font-bold transition ${conf === v ? 'scale-105 border-brand bg-brand text-white' : 'border-line bg-white hover:border-brand/50'}`}
              >
                <FxText text={l} />
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => submit(ctx, { choice: selected, answer: ans, rac })}
              disabled={q.formato === 'multipla' ? selected == null : !ans.trim()}
              className={`flex items-center gap-2 rounded-2xl px-5 py-3 font-display text-base font-bold text-white transition hover:brightness-110 active:translate-y-1 disabled:opacity-40 ${(q.formato === 'multipla' ? selected != null : ans.trim()) ? 'rk-shine-host' : ''}`}
              style={{ background: color, boxShadow: `0 5px 0 color-mix(in srgb, ${color} 70%, #000)` }}
            >
              Conferir <kbd className="rounded-md bg-white/25 px-1.5 text-[11px]">Enter</kbd>
            </button>
            {q.dica && !hintUsed && (
              <button type="button" onClick={() => (setHintUsed(true), sfx('pop'), say('hint'))} className="flex items-center gap-1.5 rounded-2xl bg-amber-300 px-4 py-3 font-display text-sm font-bold text-amber-950 shadow-[0_5px_0_#e8a800] active:translate-y-1">
                <Lightbulb size={16} /> Dica <kbd className="rounded-md bg-white/40 px-1.5 text-[11px]">H</kbd>
              </button>
            )}
            <button type="button" onClick={() => finishAnswer(false, ctx, { naosei: true, erro: 'não sabia por onde começar' })} className="flex items-center gap-1.5 rounded-2xl border-2 border-line bg-white px-4 py-2.5 text-sm font-bold shadow-[0_4px_0_#e6e8f0] active:translate-y-1">
              <HelpCircle size={16} /> Não sei
            </button>
            {q.formato === 'multipla' && S.items.fifty > 0 && !fifty.length && (
              <button
                type="button"
                title="Tira 2 alternativas erradas. Vale metade dos pontos."
                onClick={() => {
                  const gone = applyFifty(q)
                  setFifty(gone)
                  if (selected != null && gone.includes(selected)) setSelected(null)
                }}
                className="flex items-center gap-1.5 rounded-2xl border-2 border-line bg-white px-4 py-2.5 text-sm font-bold shadow-[0_4px_0_#e6e8f0] active:translate-y-1"
              >
                <Target size={16} /> 50/50
              </button>
            )}
            {S.items.skip > 0 && (
              <button type="button" title="Troca a questão sem contar como erro." onClick={skipQuestion} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-muted hover:bg-slate-100">
                <SkipForward size={14} /> Pular ({S.items.skip})
              </button>
            )}
            {q.formato === 'multipla' && <span className="hidden text-xs text-muted sm:inline">Teclas A–E escolhem.</span>}
          </div>
          {S.paused > 0 && (
            <div className="absolute inset-0 z-[4] grid place-items-center content-center gap-2 rounded-[23px] bg-[#f3f4f7]/90 p-5 text-center backdrop-blur-md">
              <RushCapi mood="sleepy" size={110} talk={false} />
              <h3 className="font-display text-3xl font-extrabold">
                Pausado <Coffee className="inline" />
              </h3>
              <p className="text-sm text-muted">Bebe uma água, estica as pernas. O tempo da questão está parado.</p>
              <button type="button" onClick={togglePause} className="mx-auto flex items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 font-bold text-white">
                Continuar <Play size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {ph === 'checking' && (
        <p className="mt-5 flex items-center gap-2 font-bold text-muted">
          <Spinner size={20} /> Corrigindo sua resposta…
        </p>
      )}

      {ph === 'selfgrade' && (
        <div className="mt-5 space-y-3">
          <p className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700">{errCopy(L.aiErr)} Compare você mesmo com o gabarito e diga se acertou.</p>
          <Solution q={q} interactive={false} />
          <div className="flex gap-2">
            <button type="button" onClick={() => finishAnswer(true, ctx)} className="flex items-center gap-1.5 rounded-2xl bg-emerald-500 px-5 py-2.5 font-bold text-white shadow-[0_5px_0_#16915a]">
              <Check size={16} /> Acertei
            </button>
            <button type="button" onClick={() => finishAnswer(false, ctx)} className="flex items-center gap-1.5 rounded-2xl border-2 border-line bg-white px-5 py-2.5 font-bold">
              <X size={16} /> Errei
            </button>
          </div>
        </div>
      )}

      {ph === 'feedback' && <Feedback S={S} q={q} color={color} />}
    </div>
  )
}

function Feedback({ S, q, color }: { S: RushState; q: RushQ; color: string }) {
  const L = S.last ?? {}
  const ok = !!L.correct
  const word = ok ? (L.overridden ? 'Beleza, contei certa!' : OK_WORDS[S.stats.done % OK_WORDS.length]) : L.naosei ? 'Bora aprender essa!' : 'Quase!'
  const [fresh] = useState(true)
  return (
    <div className="mt-6 grid gap-3.5">
      <div data-verdict className={`rush-pop relative grid grid-cols-[86px_1fr] items-center gap-3.5 rounded-[22px] px-4 py-3.5 ${ok ? 'bg-emerald-50' : 'bg-rose-50'}`}>
        <span className="relative isolate">
          {ok && <Ring color={S.current?.boss ? 'rgba(245,158,11,.6)' : 'rgba(34,181,115,.5)'} />}
          <RushCapi mood={ok ? 'happy' : 'sad'} size={86} side="right" />
        </span>
        <div className="min-w-0">
          <div className={`flex flex-wrap items-center gap-2 font-display text-3xl leading-none font-extrabold ${ok ? 'text-emerald-700' : 'text-rose-600'}`}>
            {word}
            {ok && L.pts ? <span className="rk-pop-in rounded-full bg-[#16181d] px-2.5 py-0.5 font-sans text-sm text-amber-300">+{L.pts} pts</span> : null}
            {ok && S.stats.streak >= 3 && <span className="rush-bump rounded-full bg-orange-100 px-2.5 py-0.5 font-sans text-sm text-orange-700"><Fx name="fire" /> combo x{(1 + Math.min(S.stats.streak - 1, 9) / 10).toFixed(1)}</span>}
            {ok && L.fast && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-sans text-xs text-amber-800"><Fx name="bolt" /> rápido +25%</span>}
            {L.shielded && <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-sans text-xs text-blue-700"><Fx name="shield" /> escudo segurou o combo</span>}
          </div>
          {L.comment ? <MathText as="p" text={L.comment} className="mt-1.5 font-semibold whitespace-pre-wrap" /> : !ok ? <p className="mt-1.5 font-semibold">Olha a resolução aqui embaixo. Essa ideia vai voltar daqui a pouco.</p> : null}
        </div>
        {fresh && <span className={`rush-stamp pointer-events-none absolute -top-3.5 right-4 rounded-lg border-4 px-3 font-display text-2xl font-extrabold tracking-widest ${ok ? 'border-emerald-600 text-emerald-600' : 'border-rose-500 text-rose-500'} bg-white/70`}>{ok ? 'CERTO' : L.shielded ? 'UFA' : 'ERROU'}</span>}
      </div>
      {L.note && <div className="rush-enter rounded-2xl bg-amber-100 px-4 py-2.5 text-sm font-bold text-amber-900">{L.note}</div>}
      <SpawnLine S={S} />
      <Solution q={q} interactive={!ok && !L.overridden} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          id="rush-next"
          type="button"
          onClick={() => goNext()}
          className="rk-shine-host flex items-center gap-2 rounded-2xl px-5 py-3 font-display text-base font-bold text-white transition hover:brightness-110 active:translate-y-1"
          style={{ background: color, boxShadow: `0 5px 0 color-mix(in srgb, ${color} 70%, #000)` }}
        >
          Próxima <ArrowRight size={17} /> <kbd className="rounded-md bg-white/25 px-1.5 text-[11px]">Enter</kbd>
        </button>
        {ok && !L.doubt && !L.overridden && (
          <button type="button" onClick={markDoubt} className="flex items-center gap-1.5 rounded-2xl bg-amber-300 px-4 py-3 text-sm font-bold text-amber-950 shadow-[0_5px_0_#e8a800] active:translate-y-1">
            <HelpCircle size={16} /> Fiquei em dúvida, manda de novo
          </button>
        )}
        {!ok && L.choice == null && L.answer && (
          <button type="button" onClick={overrideWrong} className="rounded-2xl border-2 border-line bg-white px-4 py-2.5 text-sm font-bold">
            Na real eu acertei
          </button>
        )}
      </div>
      <AskBox q={q} S={S} ok={ok} />
    </div>
  )
}

function SpawnLine({ S }: { S: RushState }) {
  const sp = S.last?.spawn
  if (!sp || sp.status === 'cancelada') return null
  if (sp.status === 'skip')
    return (
      <p className="text-sm font-bold">
        <span className="mr-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800"><Fx name="repeat" /> Na fila</span> Essa ideia já tem revisões esperando na fila.
      </p>
    )
  const quando = (() => {
    const parts = sp.offs.map((o) => o + 1)
    return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1] : String(parts[0] ?? '')
  })()
  if (sp.long)
    return (
      <p className="flex items-center gap-2 text-sm font-bold">
        {sp.status === 'gerando' ? (
          <>
            <Spinner size={16} /> Agendando uma checagem final dessa ideia para daqui a umas 19 questões…
          </>
        ) : sp.status === 'pronto' ? (
          <>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800"><Fx name="pin" /> Checagem final</span> Daqui a 19 questões vem mais uma dessa ideia, para ver se fixou.
          </>
        ) : null}
      </p>
    )
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
      {sp.status === 'gerando' && (
        <>
          <Spinner size={16} /> Criando {sp.n} {sp.n > 1 ? 'variações' : 'variação'} dessa ideia{quando ? `. Voltam daqui a ${quando} questões.` : '…'}
        </>
      )}
      {sp.status === 'pronto' && (
        <>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800"><Fx name="repeat" /> Na fila</span> {sp.n} {sp.n > 1 ? 'variações entraram' : 'variação entrou'}: daqui a {quando} questões.
        </>
      )}
      {sp.status === 'erro' && (
        <>
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs text-rose-700">Ops</span> Não deu para criar as revisões agora. {errCopy(sp.err)}
        </>
      )}
    </p>
  )
}

/** Gabarito, resolução (passo a passo quando errou) e ideia-chave. */
function Solution({ q, interactive }: { q: RushQ; interactive: boolean }) {
  const lines = useMemo(
    () =>
      q.resolucao
        .split(/\n+/)
        .map((l) => l.replace(/^\s*(?:passo\s*)?\d+\s*[).:–-]\s*/i, '').trim())
        .filter(Boolean),
    [q.resolucao],
  )
  const stepMode = interactive && lines.length > 2
  const [shown, setShown] = useState(stepMode ? 1 : lines.length)
  return (
    <>
      <div className="rush-enter grid gap-1 rounded-2xl bg-[#f6f7f9] px-4 py-3">
        <span className="text-[11px] font-bold tracking-wider text-muted uppercase">Gabarito</span>
        <MathText text={q.gabarito} className="font-display text-xl font-bold text-emerald-700" />
      </div>
      {lines.length > 0 && (
        <div className="rush-enter grid gap-2 rounded-2xl bg-[#f6f7f9] px-4 py-3">
          <span className="text-[11px] font-bold tracking-wider text-muted uppercase">Resolução passo a passo</span>
          <ol className="grid gap-2">
            {lines.slice(0, shown).map((l, i) => (
              <li key={i} className={`rush-enter grid grid-cols-[28px_1fr] items-start gap-2.5 rounded-xl bg-white px-3 py-2 leading-relaxed ${stepMode && i === shown - 1 && shown < lines.length ? 'ring-2 ring-brand' : ''}`}>
                <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-brand font-display text-sm font-bold text-white">{i + 1}</span>
                <MathText as="span" text={l} className="break-words" />
              </li>
            ))}
          </ol>
          {stepMode && shown < lines.length && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => (setShown(shown + 1), sfx('pop'))} className="flex items-center gap-1 rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white">
                <Play size={12} /> Próximo passo
              </button>
              <button type="button" onClick={() => setShown(lines.length)} className="rounded-xl border-2 border-line bg-white px-3 py-1 text-xs font-bold">
                Mostrar tudo
              </button>
              <span className="text-xs text-muted">
                Passo {shown} de {lines.length}. Tente adivinhar o próximo antes de revelar!
              </span>
            </div>
          )}
        </div>
      )}
      {q.ideia && (
        <div className="rush-enter rounded-2xl bg-amber-50 px-4 py-3 text-sm">
          <b><Fx name="bulb" /> Ideia-chave: </b>
          <MathText as="span" text={q.ideia} />
        </div>
      )}
    </>
  )
}

function AskBox({ q, S, ok }: { q: RushQ; S: RushState; ok: boolean }) {
  const [doubt, setDoubt] = useState('')
  const [out, setOut] = useState('')
  const [busy, setBusy] = useState(false)
  const ctl = useRef<AbortController | null>(null)
  useEffect(() => () => ctl.current?.abort(), [])
  const ask = async (text: string) => {
    const dq = text.trim()
    if (!dq) return
    ctl.current?.abort()
    const c = (ctl.current = new AbortController())
    setBusy(true)
    setOut('')
    try {
      const full = await askAboutQuestion(askPrompt(q, S.last, dq), setOut, c.signal)
      setOut(full)
    } catch (e) {
      if ((e as { code?: string }).code !== 'cancelled') setOut(errCopy((e as { code?: string }).code))
    } finally {
      setBusy(false)
    }
  }
  const chips: [string, string][] = [
    ['🧒 Explica mais simples', 'Explica de um jeito bem mais simples, como se eu tivesse 12 anos, com um exemplo do dia a dia.'],
    ['🧠 Me dá um macete', 'Me dá um macete ou um jeito fácil de lembrar disso na prova.'],
    ...(q.formato === 'multipla' ? ([['❓ Por que as outras estão erradas?', 'Explica rapidinho por que cada uma das outras alternativas está errada.']] as [string, string][]) : []),
    ...(!ok ? ([['🔍 Onde eu errei?', 'Olhando minha resposta, onde exatamente eu errei e como não errar de novo?']] as [string, string][]) : []),
  ]
  return (
    <div className="grid gap-2 border-t-2 border-dotted border-line pt-3">
      <div className="flex flex-wrap gap-1.5">
        {chips.map(([l, t]) => (
          <button key={l} type="button" onClick={() => (setDoubt(t), ask(t))} className="rounded-full border-2 border-line bg-white px-3 py-1 text-[13px] font-bold transition hover:-translate-y-0.5 hover:border-brand">
            <FxText text={l} />
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          id="rush-ask"
          value={doubt}
          onChange={(e) => setDoubt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              ask(doubt)
            }
          }}
          placeholder="Ficou com dúvida? Pergunte aqui"
          className="min-w-0 flex-1 rounded-xl border-2 border-line px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button type="button" disabled={busy} onClick={() => ask(doubt)} className="rounded-xl border-2 border-line bg-white px-3 text-sm font-bold disabled:opacity-50">
          Perguntar
        </button>
      </div>
      {(busy || out) && (
        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm leading-relaxed">
          {busy && !out ? (
            <span className="flex items-center gap-2 font-bold text-muted">
              <Spinner size={16} /> Pensando…
            </span>
          ) : (
            <MathText text={out} className="whitespace-pre-wrap" />
          )}
        </div>
      )}
    </div>
  )
}
