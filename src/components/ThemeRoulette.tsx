import { useEffect, useMemo, useRef, useState } from 'react'
import type { Subject } from '../db/types'
import { daysUntil } from '../lib/dates'
import { centerOf, confetti, playSfx } from '../lib/sfx'
import { Capybara } from './Capybara'
import { SubjectIcon } from './SubjectIcon'

type Slice = Pick<Subject, 'id' | 'name' | 'color' | 'icon' | 'deadline'>

/**
 * Sorteio da matéria da semana do Ensino Médio.
 * Nunca repete a da semana passada (se houver outra opção). Uma prova nos próximos 14 dias
 * vence o sorteio: a roleta ainda gira, mas para nela.
 */
export function pickThemeSubject(list: Slice[], lastWeekId?: string, now = new Date(), rand = Math.random): { id: string; forced: boolean } {
  const exams = list
    .map((s) => ({ s, d: s.deadline ? daysUntil(s.deadline, now) : null }))
    .filter((x): x is { s: Slice; d: number } => x.d !== null && x.d >= 0 && x.d <= 14)
    .sort((a, b) => a.d - b.d)
  if (exams.length) return { id: exams[0].s.id, forced: true }
  const pool = list.length > 1 ? list.filter((s) => s.id !== lastWeekId) : list
  return { id: pool[Math.floor(rand() * pool.length)].id, forced: false }
}

const R = 100
const polar = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180
  return [R + Math.cos(a) * r, R + Math.sin(a) * r]
}

/** Tela cheia: a Mendi com a roleta das matérias. Chama onDone com a matéria sorteada. */
export function ThemeRoulette({ subjects, lastWeekId, onDone, onSkip }: { subjects: Slice[]; lastWeekId?: string; onDone: (id: string) => void; onSkip: () => void }) {
  const n = subjects.length
  const seg = 360 / n
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'done'>('idle')
  const [rot, setRot] = useState(0)
  const [result, setResult] = useState<{ id: string; forced: boolean } | null>(null)
  const wheelRef = useRef<SVGGElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const won = subjects.find((s) => s.id === result?.id)

  const paths = useMemo(
    () =>
      subjects.map((s, i) => {
        const a0 = i * seg
        const a1 = (i + 1) * seg
        const [x0, y0] = polar(a0, R - 4)
        const [x1, y1] = polar(a1, R - 4)
        const large = seg > 180 ? 1 : 0
        const [tx, ty] = polar(a0 + seg / 2, R * 0.62)
        return { s, d: n === 1 ? '' : `M${R} ${R} L${x0} ${y0} A${R - 4} ${R - 4} 0 ${large} 1 ${x1} ${y1} Z`, tx, ty, mid: a0 + seg / 2 }
      }),
    [subjects, seg, n],
  )

  // "tic" a cada fatia que passa pelo ponteiro
  useEffect(() => {
    if (phase !== 'spinning') return
    let raf = 0
    let last = -1
    const tick = () => {
      const g = wheelRef.current
      if (g) {
        const m = new DOMMatrix(getComputedStyle(g).transform)
        const deg = ((Math.atan2(m.b, m.a) * 180) / Math.PI + 360) % 360
        const idx = Math.floor(((360 - deg) % 360) / seg)
        if (idx !== last) {
          if (last !== -1) playSfx('blip')
          last = idx
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, seg])

  const spin = () => {
    if (phase !== 'idle') return
    const r = pickThemeSubject(subjects, lastWeekId)
    const i = subjects.findIndex((s) => s.id === r.id)
    // para no meio da fatia, com um tremidinho para não parecer sempre igual
    const jitter = (Math.random() - 0.5) * seg * 0.6
    const target = 360 * 6 + (360 - (i * seg + seg / 2)) + jitter
    setResult(r)
    setPhase('spinning')
    requestAnimationFrame(() => setRot(target))
    playSfx('whoosh')
  }

  const finish = () => {
    if (phase !== 'spinning') return
    setPhase('done')
    playSfx('big')
    const [x, y] = centerOf(boxRef.current)
    confetti(x, y, 90, won ? [won.color, '#ffd34d', '#ffffff', '#3e63f2'] : undefined)
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-[#0b1026]/60 p-4 backdrop-blur-[3px]">
      <div className="capi-pop relative w-full max-w-[560px] rounded-[28px] bg-white p-6 text-center shadow-2xl sm:p-8">
        <div className="mx-auto mb-1 flex max-w-sm items-end justify-center gap-3">
          <Capybara pose={phase === 'done' ? 'comemorando' : phase === 'spinning' ? 'pensando' : 'acenando'} size={86} />
          <div className="mb-3 rounded-2xl rounded-bl-sm bg-[#f1f2f5] px-4 py-2.5 text-left text-sm font-semibold">
            {phase === 'idle' && 'Bora sortear a matéria da semana do Ensino Médio?'}
            {phase === 'spinning' && 'Rodando… rodando…'}
            {phase === 'done' && won && (result?.forced ? `${won.name}! Tem prova chegando, então a roleta foi direto nela.` : `Deu ${won.name}! Semana toda nela.`)}
          </div>
        </div>

        {/* roleta */}
        <div ref={boxRef} className="relative mx-auto aspect-square w-full max-w-[340px]">
          {/* ponteiro */}
          <svg viewBox="0 0 40 40" className="absolute top-[-6px] left-1/2 z-10 h-9 w-9 -translate-x-1/2 drop-shadow-md" aria-hidden>
            <path d="M20 38 L6 8 Q20 0 34 8 Z" fill="#121826" />
            <circle cx="20" cy="13" r="4" fill="#ffd34d" />
          </svg>
          <svg viewBox="0 0 200 200" className="essential-motion h-full w-full drop-shadow-[0_14px_24px_rgba(16,24,40,0.25)]" role="img" aria-label="Roleta das matérias">
            <circle cx={R} cy={R} r={R} fill="#121826" />
            <g
              ref={wheelRef}
              style={{ transform: `rotate(${rot}deg)`, transformOrigin: '100px 100px', transition: phase === 'spinning' ? 'transform 5.2s cubic-bezier(.12,.62,.08,1)' : 'none' }}
              onTransitionEnd={finish}
            >
              {n === 1 ? <circle cx={R} cy={R} r={R - 4} fill={subjects[0].color} /> : paths.map((p) => <path key={p.s.id} d={p.d} fill={p.s.color} stroke="#fff" strokeWidth="1.2" />)}
              {paths.map((p) => (
                <g key={`t${p.s.id}`} transform={`translate(${p.tx} ${p.ty}) rotate(${p.mid > 180 ? p.mid + 90 : p.mid - 90})`}>
                  <text textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={n > 8 ? 7 : 8.5} fontWeight="800" fontFamily="Inter, sans-serif" style={{ paintOrder: 'stroke' }} stroke="rgba(0,0,0,.25)" strokeWidth="1.2">
                    {p.s.name.length > 13 ? p.s.name.split(' ')[0] : p.s.name}
                  </text>
                </g>
              ))}
              {/* pinos na borda */}
              {paths.map((_, i) => {
                const [x, y] = polar(i * seg, R - 4)
                return <circle key={`p${i}`} cx={x} cy={y} r="2.2" fill="#ffd34d" />
              })}
            </g>
            <circle cx={R} cy={R} r="16" fill="#fff" stroke="#121826" strokeWidth="3" />
            <circle cx={R} cy={R} r="6" fill="#3e63f2" />
          </svg>
        </div>

        {phase === 'done' && won ? (
          <div className="capi-pop mt-5">
            <div className="mx-auto mb-4 inline-flex items-center gap-2.5 rounded-2xl px-4 py-2.5 text-white" style={{ background: won.color }}>
              <SubjectIcon subject={won as never} size={34} />
              <span className="font-display text-2xl font-extrabold">Semana de {won.name}</span>
            </div>
            <p className="mb-4 text-sm text-muted">O estudo novo do Ensino Médio fica todo nela. Inglês e Faculdade seguem normais, e as revisões das outras matérias continuam, curtinhas.</p>
            <button onClick={() => onDone(won.id)} className="w-full rounded-2xl bg-brand py-3.5 font-display text-lg font-bold text-white shadow-[0_14px_30px_-14px_rgba(62,99,242,0.9)] transition hover:brightness-110">
              Bora!
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            <button
              onClick={spin}
              disabled={phase !== 'idle'}
              className="w-full rounded-2xl bg-brand py-3.5 font-display text-lg font-bold text-white shadow-[0_14px_30px_-14px_rgba(62,99,242,0.9)] transition hover:brightness-110 disabled:opacity-60"
            >
              {phase === 'idle' ? 'Girar a roleta' : 'Girando…'}
            </button>
            {phase === 'idle' && (
              <button onClick={onSkip} className="text-xs font-semibold text-muted hover:text-ink">
                Prefiro escolher eu mesmo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
