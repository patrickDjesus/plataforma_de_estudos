import { useEffect, useId, useRef } from 'react'
import { ChevronsDown, ChevronsUp, Crown, Shield } from 'lucide-react'
import { MASTER_POS, POINTS, TIERS, divisionOf, rankName, sizeOf, tierOf, type RankState } from '../lib/rank'
import { useRank } from '../db/rank'
import { showMascot } from '../lib/mascotBus'

/** Emblema do rank: escudo metálico; asas a partir de Platina e coroa no Mestre. */
export function RankEmblem({ pos, size = 56, showDivision = true }: { pos: number; size?: number; showDivision?: boolean }) {
  const id = useId().replace(/:/g, '')
  const tier = tierOf(pos)
  const ti = TIERS.indexOf(tier)
  const div = divisionOf(pos)
  const shield = 'M50 12 L82 23 V50 C82 74 67 88 50 96 C33 88 18 74 18 50 V23 Z'
  const inner = 'M50 20 L75 28.5 V50 C75 69 63.5 80.5 50 87 C36.5 80.5 25 69 25 50 V28.5 Z'
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 100 110" role="img" aria-label={rankName(pos)} className="shrink-0 drop-shadow-[0_6px_10px_rgba(16,24,40,0.25)]">
      <defs>
        <linearGradient id={`m${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tier.light} />
          <stop offset="0.55" stopColor={tier.dark} />
          <stop offset="1" stopColor={tier.light} />
        </linearGradient>
        <linearGradient id={`i${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tier.dark} />
          <stop offset="1" stopColor={`color-mix(in srgb, ${tier.dark} 55%, #000)`} />
        </linearGradient>
      </defs>
      {ti >= 4 && (
        <g fill={`url(#m${id})`} stroke={`color-mix(in srgb, ${tier.dark} 60%, #000)`} strokeWidth="1.5">
          <path d="M20 34 C6 34 2 46 3 58 C9 52 13 52 19 54 C11 60 10 66 12 74 C17 66 21 64 24 64 Z" />
          <path d="M80 34 C94 34 98 46 97 58 C91 52 87 52 81 54 C89 60 90 66 88 74 C83 66 79 64 76 64 Z" />
        </g>
      )}
      {ti === 6 && (
        <path d="M30 16 L36 2 L44 12 L50 0 L56 12 L64 2 L70 16 Z" fill="#ffd34d" stroke="#b8860b" strokeWidth="1.5" strokeLinejoin="round" />
      )}
      <path d={shield} fill={`url(#m${id})`} stroke={`color-mix(in srgb, ${tier.dark} 55%, #000)`} strokeWidth="2" />
      <path d={inner} fill={`url(#i${id})`} />
      {/* brilho */}
      <path d="M28 30 L50 22.5 V40 C42 40 34 44 28 50 Z" fill="#fff" opacity="0.18" />
      {/* pedra central: círculo → losango → estrela */}
      {ti <= 1 && <circle cx="50" cy="52" r="11" fill={`url(#m${id})`} stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />}
      {(ti === 2 || ti === 3) && <path d="M50 37 L63 52 L50 67 L37 52 Z" fill={`url(#m${id})`} stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5" />}
      {ti >= 4 && (
        <path
          d="M50 35 L54.5 46.5 L66.5 47 L57 54.5 L60.5 66.5 L50 59.5 L39.5 66.5 L43 54.5 L33.5 47 L45.5 46.5 Z"
          fill={`url(#m${id})`}
          stroke="#fff"
          strokeOpacity="0.6"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )}
      {showDivision && div && (
        <g>
          <path d="M30 92 H70 L66 100 L70 108 H30 L34 100 Z" fill={`color-mix(in srgb, ${tier.dark} 80%, #000)`} />
          <text x="50" y="104" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">
            {div}
          </text>
        </g>
      )}
    </svg>
  )
}

/** Avisa (com a Capi) quando o rank sobe ou cai desde a última visita. */
export function useRankWatcher(rank: RankState, ready: boolean) {
  const latest = useRef(rank.pos)
  const baseline = useRef<number | null>(null) // rank antes da mudança ainda não anunciada
  const timer = useRef<number | undefined>(undefined)
  latest.current = rank.pos
  useEffect(() => {
    if (!ready) return
    const KEY = 'mendonca-rank-pos'
    let seen: number | null = null
    try {
      const v = localStorage.getItem(KEY)
      seen = v === null ? null : Number(v)
      localStorage.setItem(KEY, String(rank.pos))
    } catch {
      return
    }
    if (seen === null || Number.isNaN(seen) || seen === rank.pos) return
    if (baseline.current === null) baseline.current = seen
    window.clearTimeout(timer.current)
    // Espera o "bom dia" da Capi e anuncia o rank mais recente (se mudou várias vezes, uma mensagem só)
    timer.current = window.setTimeout(() => {
      const from = baseline.current!
      baseline.current = null
      const pos = latest.current
      if (pos === from) return
      const name = rankName(pos)
      showMascot(
        pos > from
          ? { pose: 'comemorando', title: `Subiu para ${name}! 🎉`, text: 'Seu esforço está aparecendo. Bora manter o ritmo!', autoHideMs: 8000 }
          : { pose: 'chorando', title: `Caiu para ${name}`, text: 'Acontece! Uns blocos cumpridos e você volta rapidinho. Eu acredito em você.', autoHideMs: 8000 },
      )
    }, 6500)
  }, [rank.pos, ready])
}

export function RankLine({ rank }: { rank: RankState }) {
  return (
    <span className="tabular-nums">
      <b style={{ color: tierOf(rank.pos).dark }}>{rankName(rank.pos)}</b>
      {' · '}
      {rank.pos >= MASTER_POS ? `${rank.points} pts` : `${rank.points}/${sizeOf(rank.pos)} pts`}
    </span>
  )
}

const fmtWhen = (ms: number) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

export function RankSection() {
  const rank = useRank()
  const tier = tierOf(rank.pos)
  const size = sizeOf(rank.pos)
  const isMaster = rank.pos >= MASTER_POS
  const recent = [...rank.log].reverse().slice(0, 20)
  const rules: [string, string][] = [
    ['Bloco de estudo concluído', `+${POINTS.block}`],
    ['Revisão concluída', `+${POINTS.review}`],
    ['Desafio ou questões', `até +${POINTS.challengeMax} (+${POINTS.challengeBonus} com 85%+)`],
    ['Flashcards', `+1 por cartão (até ${POINTS.cardPerDay}/dia)`],
    ['Semana com 80%+ do plano', `+${POINTS.goodWeek}`],
    ['Bloco perdido', `${POINTS.missed}`],
    ['Semana com menos de 30%', `${POINTS.badWeek}`],
  ]
  return (
    <div className="space-y-5">
      {/* Rank atual */}
      <div
        className="relative overflow-hidden rounded-[22px] p-6 text-white"
        style={{ background: `radial-gradient(120% 120% at 0% 0%, color-mix(in srgb, ${tier.dark} 70%, #fff) 0%, ${tier.dark} 45%, color-mix(in srgb, ${tier.dark} 55%, #0b1026) 100%)` }}
      >
        <span className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center gap-6">
          <RankEmblem pos={rank.pos} size={120} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold tracking-wider text-white/70 uppercase">Seu rank</div>
            <div className="font-display text-4xl font-extrabold">{rankName(rank.pos)}</div>
            <div className="mt-3 max-w-md">
              <div className="mb-1 flex justify-between text-sm font-semibold">
                <span>{rank.points} pts</span>
                <span className="text-white/75">{isMaster ? 'Topo da escada' : `${size - rank.points} para ${rankName(rank.pos + 1)}`}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${isMaster ? 100 : Math.max(2, (rank.points / size) * 100)}%` }} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-white/15 px-2.5 py-1">🏆 Melhor: {rankName(rank.best.pos)}</span>
              {!isMaster && rank.points === 0 && rank.pos > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                  <Shield size={12} /> Escudo ativo: a próxima perda rebaixa
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Escada */}
      <div className="rounded-[18px] border border-line p-5">
        <h3 className="mb-4 font-sans text-sm font-semibold">Escada de ranks</h3>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {TIERS.map((t, i) => {
            const pos = i * 3 + (i === TIERS.length - 1 ? 0 : 2)
            const here = tierOf(rank.pos).id === t.id
            const reached = rank.best.pos >= i * 3
            return (
              <div key={t.id} className={`flex flex-col items-center rounded-2xl p-2 text-center transition ${here ? 'bg-brand-soft ring-2 ring-brand' : ''} ${reached ? '' : 'opacity-35 grayscale'}`}>
                <RankEmblem pos={pos} size={52} showDivision={false} />
                <div className="mt-1 text-xs font-bold">{t.name}</div>
                <div className="text-[10px] text-muted">{Number.isFinite(t.size) ? `3 × ${t.size} pts` : 'sem limite'}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {/* Histórico */}
        <div className="rounded-[18px] border border-line p-5">
          <h3 className="mb-3 font-sans text-sm font-semibold">Últimas pontuações</h3>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Conclua blocos, revisões e desafios para começar a subir.</p>
          ) : (
            <ul className="space-y-1.5">
              {recent.map((e, k) => (
                <li key={k} className="flex items-center gap-2 text-sm">
                  <span className={`w-10 shrink-0 text-right font-extrabold tabular-nums ${e.delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {e.delta > 0 ? `+${e.delta}` : e.delta}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{e.label}</span>
                  {e.change && (
                    <span className={`flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${e.change === 'subiu' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {e.change === 'subiu' ? <ChevronsUp size={12} /> : <ChevronsDown size={12} />}
                      {rankName(e.after.pos)}
                    </span>
                  )}
                  <span className="shrink-0 text-[11px] text-muted">{fmtWhen(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* Regras */}
        <div className="rounded-[18px] border border-line p-5">
          <h3 className="mb-3 flex items-center gap-2 font-sans text-sm font-semibold">
            <Crown size={16} /> Como ganhar pontos
          </h3>
          <ul className="space-y-1.5 text-sm">
            {rules.map(([a, b]) => (
              <li key={a} className="flex justify-between gap-3">
                <span>{a}</span>
                <b className={b.startsWith('-') ? 'text-rose-600' : 'text-emerald-600'}>{b}</b>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Ao chegar a 0 pontos, um escudo segura a divisão; só a próxima perda rebaixa. Ferro III é o piso. O rank é só visual: não muda seu planejamento.
          </p>
        </div>
      </div>
    </div>
  )
}
