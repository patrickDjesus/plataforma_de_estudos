import { useId, type ReactNode } from 'react'
import { TIERS, divisionOf, tierOf } from '../lib/rank'

/* Arte dos ranks no estilo dos ícones de matéria (quadradinho arredondado, cor chapada com leve
 * relevo, desenho branco), mas com símbolo próprio por rank e animações que crescem com ele:
 * brilho passando (Bronze+), faíscas (Ouro+), luz correndo na moldura (Prata+), fogo no Mestre. */

type TierId = (typeof TIERS)[number]['id']

const COLOR: Record<TierId, { base: string; light: string }> = {
  ferro: { base: '#7b8290', light: '#c3c8cf' },
  bronze: { base: '#c0703a', light: '#f0b583' },
  prata: { base: '#8f9db3', light: '#eef2f7' },
  ouro: { base: '#e0a21a', light: '#ffe8a3' },
  platina: { base: '#14a898', light: '#a6f2e6' },
  diamante: { base: '#3e63f2', light: '#c4d6ff' },
  mestre: { base: '#8b5cf6', light: '#e3d0ff' },
}

/** Cor base de um rank. */
export const tierColor = (pos: number) => COLOR[tierOf(pos).id].base

const SHIELD = 'M50 22 L71 29 V48 C71 63 62 72 50 78 C38 72 29 63 29 48 V29 Z'

/** Estrelinha de 4 pontas que pisca. */
function Twinkle({ x, y, r, delay = 0, color = '#fff' }: { x: number; y: number; r: number; delay?: number; color?: string }) {
  return (
    <path
      className="rk-twinkle"
      style={{ animationDelay: `${delay}s` }}
      d={`M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z`}
      fill={color}
    />
  )
}

/** Folhinhas de louro (chapadas) num arco de um lado. */
function Leaves({ side }: { side: 1 | -1 }) {
  return (
    <g fill="#fff" opacity="0.9" transform={side === -1 ? 'translate(100 0) scale(-1 1)' : undefined}>
      {[
        [24, 66, -35],
        [20, 56, -10],
        [20, 45, 15],
      ].map(([x, y, a]) => (
        <ellipse key={y} cx={x} cy={y} rx="3.2" ry="6.5" transform={`rotate(${a} ${x} ${y})`} />
      ))}
    </g>
  )
}

/** Asinha chapada (Prata e Mestre). */
function Wing({ side }: { side: 1 | -1 }) {
  return (
    <path
      d="M30 40 C20 38 13 33 10 26 C16 28 21 28 25 27 C18 25 14 21 13 16 C19 20 25 22 30 23 Z"
      fill="#fff"
      opacity="0.92"
      transform={side === -1 ? 'translate(100 0) scale(-1 1)' : undefined}
    />
  )
}

/** Desenho branco de cada rank: começa simples e vai ganhando detalhes. */
function Glyph({ tier, light }: { tier: TierId; light: string }) {
  switch (tier) {
    case 'ferro':
      return (
        <g>
          <path d={SHIELD} fill="#fff" />
          <rect x="47.5" y="33" width="5" height="34" rx="2.5" fill="#000" opacity="0.12" />
        </g>
      )
    case 'bronze':
      return (
        <g>
          <path d={SHIELD} fill="#fff" />
          <path d="M38 44 L50 52 L62 44" fill="none" stroke="#000" strokeOpacity="0.16" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    case 'prata':
      return (
        <g>
          <Wing side={1} />
          <Wing side={-1} />
          <path d={SHIELD} fill="#fff" />
          <path d="M39 40 L50 47 L61 40 M39 51 L50 58 L61 51" fill="none" stroke="#000" strokeOpacity="0.16" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    case 'ouro':
      return (
        <g>
          <Leaves side={1} />
          <Leaves side={-1} />
          <path d={SHIELD} fill="#fff" />
          <path d="M50 35 L53.6 43 L62 43.6 L55.6 49 L57.8 57.4 L50 52.8 L42.2 57.4 L44.4 49 L38 43.6 L46.4 43 Z" fill={light} stroke="#000" strokeOpacity="0.12" strokeWidth="1" />
        </g>
      )
    case 'platina':
      return (
        <g className="rk-bob">
          {/* cristal alongado com facetas */}
          <path d="M50 14 L64 30 V62 L50 84 L36 62 V30 Z" fill="#fff" />
          <path d="M50 14 L64 30 L50 38 L36 30 Z" fill="#000" opacity="0.05" />
          <path d="M64 30 V62 L50 84 V38 Z" fill="#000" opacity="0.13" />
          <path d="M36 62 L50 84 L64 62" fill="none" stroke="#000" strokeOpacity="0.08" strokeWidth="1.2" />
          <path d="M42 32 V54" stroke={light} strokeWidth="3" strokeLinecap="round" />
        </g>
      )
    case 'diamante':
      return (
        <g className="rk-bob">
          {/* brilhante lapidado */}
          <path d="M31 36 L40 24 H60 L69 36 L50 78 Z" fill="#fff" />
          <path d="M31 36 H69" stroke="#000" strokeOpacity="0.12" strokeWidth="1.2" />
          <path d="M40 24 L45 36 L50 24 L55 36 L60 24" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="1.2" />
          <path d="M45 36 L50 78 L55 36 Z" fill="#000" opacity="0.06" />
          <path d="M55 36 L69 36 L50 78 Z" fill="#000" opacity="0.13" />
          <path d="M38 30 L42 26" stroke={light} strokeWidth="3" strokeLinecap="round" />
        </g>
      )
    case 'mestre':
      return (
        <g className="rk-bob">
          <Wing side={1} />
          <Wing side={-1} />
          {/* coroa */}
          <path d="M30 64 L27 34 L40 46 L50 26 L60 46 L73 34 L70 64 Z" fill="#fff" />
          <rect x="30" y="64" width="40" height="8" rx="3" fill="#fff" />
          <path d="M50 64 V72 M40 64 V72 M60 64 V72" stroke="#000" strokeOpacity="0.1" strokeWidth="1.2" />
          <circle cx="50" cy="54" r="4.4" fill={light} stroke="#000" strokeOpacity="0.15" />
          <circle cx="38.5" cy="57" r="2.6" fill={light} />
          <circle cx="61.5" cy="57" r="2.6" fill={light} />
          <circle cx="27" cy="33" r="2.6" fill="#fff" />
          <circle cx="50" cy="25" r="3" fill="#fff" />
          <circle cx="73" cy="33" r="2.6" fill="#fff" />
        </g>
      )
  }
}

/** Emblema do rank. `animated` liga brilho e faíscas. */
export function RankEmblem({ pos, size = 56, showDivision = true, animated = true }: { pos: number; size?: number; showDivision?: boolean; animated?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const tier = tierOf(pos)
  const ti = TIERS.indexOf(tier)
  const { base, light } = COLOR[tier.id]
  const div = divisionOf(pos)
  const badge = Math.max(14, Math.round(size * 0.3))
  const dark = `color-mix(in srgb, ${base} 68%, #000)`

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Rank ${tier.name}${div ? ` ${div}` : ''}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="essential-motion overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={`bg${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={base} />
            <stop offset="1" stopColor={dark} />
          </linearGradient>
          <linearGradient id={`hl${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`sh${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`cl${id}`}>
            <rect x="4" y="4" width="92" height="92" rx="28" />
          </clipPath>
          <filter id={`ds${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodColor="#000" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* azulejo com o mesmo relevo dos ícones de matéria */}
        <rect x="4" y="4" width="92" height="92" rx="28" fill={`url(#bg${id})`} />
        <g clipPath={`url(#cl${id})`}>
          <rect x="7" y="7" width="86" height="44" rx="25" fill={`url(#hl${id})`} />
          <rect x="4" y="90" width="92" height="6" fill="#000" opacity="0.14" />
          {/* brilho passando: do Bronze em diante, mais rápido nos ranks altos */}
          {animated && ti >= 1 && (
            <rect className="rk-shine" style={{ animationDuration: `${7 - ti * 0.7}s`, animationDelay: `${ti * 0.3}s` }} x="10" y="-10" width="18" height="120" fill={`url(#sh${id})`} />
          )}
        </g>

        <g filter={`url(#ds${id})`}>
          <Glyph tier={tier.id} light={light} />
        </g>

        {/* faíscas: do Ouro em diante */}
        {animated &&
          ti >= 3 &&
          (
            [
              [16, 18, 0, 5],
              [86, 22, 0.8, 4],
              [84, 82, 1.5, 4.5],
              [14, 78, 2.1, 3.5],
            ] as const
          )
            .slice(0, ti === 3 ? 2 : ti === 6 ? 4 : 3)
            .map(([x, y, d, r]) => <Twinkle key={`${x}${y}`} x={x} y={y} r={r} delay={d} color={ti === 6 ? light : '#fff'} />)}
      </svg>

      {showDivision && div && (
        <span
          className="absolute grid place-items-center rounded-full bg-white font-display font-extrabold tabular-nums shadow-[0_1px_3px_rgba(16,24,40,0.25)]"
          style={{ right: -size * 0.06, bottom: -size * 0.06, minWidth: badge, height: badge, padding: `0 ${badge * 0.22}px`, fontSize: badge * 0.48, color: dark }}
        >
          {div}
        </span>
      )}
    </span>
  )
}

const FLAME = 'M0 0 C -9 -2 -12 -14 -6 -24 C -5 -18 -2 -16 0 -13 C 0 -23 4 -31 2 -42 C 11 -31 15 -16 9 -5 C 6 -1 3 0 0 0 Z'

/** Pontos ao longo do contorno de um quadrado arredondado (para fogo e brasas). */
function edgePoints(n: number, inset: number): { x: number; y: number; a: number }[] {
  const pts: { x: number; y: number; a: number }[] = []
  const lo = inset
  const hi = 200 - inset
  const len = (hi - lo) * 4
  for (let i = 0; i < n; i++) {
    const d = (i / n) * len
    const side = Math.floor(d / (hi - lo))
    const t = (d % (hi - lo)) / (hi - lo)
    const v = lo + t * (hi - lo)
    if (side === 0) pts.push({ x: v, y: lo, a: 0 })
    else if (side === 1) pts.push({ x: hi, y: v, a: 90 })
    else if (side === 2) pts.push({ x: 200 - v, y: hi, a: 180 })
    else pts.push({ x: lo, y: 200 - v, a: 270 })
  }
  return pts
}

/** Moldura em volta do emblema: fundo clarinho na cor do rank que ganha vida conforme sobe. */
export function RankFrame({ pos, size, children }: { pos: number; size: number; children: ReactNode }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const tier = tierOf(pos)
  const ti = TIERS.indexOf(tier)
  const { base, light } = COLOR[tier.id]

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} className="essential-motion absolute inset-0 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={`fo${id}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#d10000" />
            <stop offset="0.35" stopColor="#ff3d00" />
            <stop offset="0.75" stopColor="#ff8a00" />
            <stop offset="1" stopColor="#ffc93d" />
          </linearGradient>
          <linearGradient id={`fp${id}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#7c3aed" />
            <stop offset="1" stopColor="#e879f9" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Mestre: fogo saindo das bordas */}
        {ti === 6 && (
          <g>
            {edgePoints(24, 16).map(({ x, y, a }, i) => {
              const s = a === 0 ? 0.95 : a === 180 ? 0.5 : 0.7
              return (
                <g key={i} transform={`translate(${x} ${y}) rotate(${a}) scale(${s})`}>
                  <path className="rk-flame" style={{ animationDelay: `${(i * 0.13) % 0.9}s`, animationDuration: `${0.7 + (i % 4) * 0.12}s` }} d={FLAME} fill={i % 3 === 0 ? `url(#fp${id})` : `url(#fo${id})`} />
                  <g transform="translate(1 -3) scale(0.5)">
                    <path className="rk-flame" style={{ animationDelay: `${(i * 0.21) % 0.8}s` }} d={FLAME} fill="#ffe27a" />
                  </g>
                </g>
              )
            })}
            {Array.from({ length: 9 }, (_, i) => (
              <circle key={`e${i}`} className="rk-ember" style={{ animationDelay: `${(i * 0.37) % 2.2}s` }} cx={30 + i * 17} cy={14} r={1.6 + (i % 3) * 0.6} fill={i % 2 ? '#ffd34d' : '#ff8a00'} />
            ))}
          </g>
        )}

        {/* Aura que pulsa: do Ouro em diante */}
        {ti >= 3 && <rect className="rk-pulse" x="6" y="6" width="188" height="188" rx="62" fill="none" stroke={base} strokeOpacity="0.35" strokeWidth="6" />}

        {/* fundo clarinho + contorno */}
        <rect x="12" y="12" width="176" height="176" rx="56" fill={`color-mix(in srgb, ${base} 12%, #fff)`} stroke={`color-mix(in srgb, ${base} 35%, #fff)`} strokeWidth="3" />

        {/* contorno pontilhado que anda: Platina e Diamante */}
        {(ti === 4 || ti === 5) && (
          <rect className="rk-dash" style={{ animationDuration: '14s' }} x="5" y="5" width="190" height="190" rx="64" fill="none" stroke={base} strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" pathLength="100" strokeDasharray="0.6 2.4" />
        )}

        {/* luz correndo no contorno: da Prata em diante, mais rápida e longa nos ranks altos */}
        {ti >= 2 && (
          <rect
            className="rk-dash"
            style={{ animationDuration: `${Math.max(2.4, 6 - ti * 0.6)}s` }}
            x="12"
            y="12"
            width="176"
            height="176"
            rx="56"
            fill="none"
            stroke={ti >= 5 ? '#fff' : light}
            strokeWidth="5"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${ti >= 5 ? 14 : 9} ${ti >= 5 ? 86 : 91}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}
