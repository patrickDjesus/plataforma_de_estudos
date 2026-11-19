import { useId, type CSSProperties, type ReactNode } from 'react'
import { TIERS, divisionOf, tierOf } from '../lib/rank'

/* Emblemas dos ranks em vetor chapado com facetas (luz vindo de cima à esquerda), cada um com
 * símbolo e ornamentos próprios: Ferro (elmo), Bronze (estrela e louros), Prata (livro e asas),
 * Ouro (troféu e louros), Platina (coroa e cristais), Diamante (diamante e estilhaços),
 * Mestre (coroa, cristais e anel orbitando). Todos se mexem um pouco; os ranks altos, mais. */

type TierId = (typeof TIERS)[number]['id']
/** [luz, médio, sombra, fundo] */
type Pal = [string, string, string, string]

const PAL: Record<TierId, Pal> = {
  ferro: ['#e2e5ea', '#a7adb7', '#6d737e', '#3c414b'],
  bronze: ['#f8c49b', '#dc8a52', '#a9592c', '#5c2c13'],
  prata: ['#f6f8fb', '#cdd4de', '#909aab', '#4a5262'],
  ouro: ['#ffeaa3', '#f7bf2f', '#c98a10', '#6e4a06'],
  platina: ['#d2fcff', '#62e2ee', '#1fa5bf', '#0c5566'],
  diamante: ['#d5e4ff', '#6fa3ff', '#2f60e8', '#16307a'],
  mestre: ['#efdcff', '#b884ff', '#7c3aed', '#3a1476'],
}
const FIELD = '#1b1e29'

/** Cor principal de um rank. */
export const tierColor = (pos: number) => PAL[tierOf(pos).id][1]

type Pt = [number, number]
const pts = (p: Pt[]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
const rad = (a: number) => (a * Math.PI) / 180
const hexPts = (cx: number, cy: number, r: number): Pt[] => [-90, -30, 30, 90, 150, 210].map((a) => [cx + Math.cos(rad(a)) * r, cy + Math.sin(rad(a)) * r])
const mirror = (p: Pt[]): Pt[] => p.map(([x, y]) => [120 - x, y])

/** Escolhe o tom de uma faceta pela direção dela (luz de cima à esquerda). */
function shade(angle: number, p: Pal) {
  const b = Math.cos(rad(angle + 120))
  return b > 0.5 ? p[0] : b > -0.1 ? p[1] : b > -0.7 ? p[2] : p[3]
}

/** Moldura hexagonal facetada com miolo escuro. */
function HexFrame({ p, r = 40, w = 9, cy = 60 }: { p: Pal; r?: number; w?: number; cy?: number }) {
  const o = hexPts(60, cy, r)
  const i = hexPts(60, cy, r - w)
  return (
    <g>
      {o.map((_, k) => {
        const n = (k + 1) % 6
        return <polygon key={k} points={pts([o[k], o[n], i[n], i[k]])} fill={shade(-60 + k * 60, p)} />
      })}
      <polygon points={pts(i)} fill={FIELD} />
      <polygon points={pts(hexPts(60, cy, r - w - 2.5))} fill="none" stroke={p[3]} strokeOpacity="0.9" strokeWidth="1.5" />
      <polygon points={pts(o)} fill="none" stroke={p[0]} strokeOpacity="0.55" strokeWidth="1" />
    </g>
  )
}

/** Estrela de 4 pontas facetada. */
function Star4({ x, y, r, p, cls, style }: { x: number; y: number; r: number; p: Pal; cls?: string; style?: CSSProperties }) {
  const k = r * 0.24
  return (
    <g className={cls} style={style}>
      <polygon points={pts([[x, y - r], [x + k, y - k], [x, y], [x - k, y - k]])} fill={p[0]} />
      <polygon points={pts([[x + r, y], [x + k, y - k], [x, y], [x + k, y + k]])} fill={p[1]} />
      <polygon points={pts([[x, y + r], [x + k, y + k], [x, y], [x - k, y + k]])} fill={p[2]} />
      <polygon points={pts([[x - r, y], [x - k, y - k], [x, y], [x - k, y + k]])} fill={p[1]} />
    </g>
  )
}

/** Brilhinho que pisca. */
function Twinkle({ x, y, r, delay = 0, color = '#fff' }: { x: number; y: number; r: number; delay?: number; color?: string }) {
  const k = r * 0.2
  return <polygon className="rk-twinkle" style={{ animationDelay: `${delay}s` }} points={pts([[x, y - r], [x + k, y - k], [x + r, y], [x + k, y + k], [x, y + r], [x - k, y + k], [x - r, y], [x - k, y - k]])} fill={color} />
}

/** Folhas angulosas de louro num arco dos dois lados. */
function Laurel({ p, n, r, from, to, size, cy = 64 }: { p: Pal; n: number; r: number; from: number; to: number; size: number; cy?: number }) {
  const leaves = Array.from({ length: n }, (_, i) => {
    const a = from + ((to - from) * i) / (n - 1)
    return { x: 60 + Math.cos(rad(a)) * r, y: cy + Math.sin(rad(a)) * r, rot: a + 158 }
  })
  const leaf = (s: number): Pt[] => [[0, 0], [s * 0.38, -s * 0.5], [0, -s * 1.2], [-s * 0.38, -s * 0.5]]
  const one = (flip: boolean) => (
    <g transform={flip ? 'translate(120 0) scale(-1 1)' : undefined}>
      {leaves.map(({ x, y, rot }, i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
          <polygon points={pts(leaf(size))} fill={i % 2 ? p[1] : p[2]} />
          <polygon points={pts([[0, 0], [0, -size * 1.2], [-size * 0.38, -size * 0.5]])} fill={p[0]} opacity="0.75" />
        </g>
      ))}
    </g>
  )
  return { left: one(false), right: one(true) }
}

/** Estilhaço de cristal: duas faces (clara e escura) a partir de uma base. */
function Shard({ base, tip, w, p, light = 0, dark = 2 }: { base: Pt; tip: Pt; w: number; p: Pal; light?: number; dark?: number }) {
  const dx = tip[0] - base[0]
  const dy = tip[1] - base[1]
  const len = Math.hypot(dx, dy)
  const nx = (-dy / len) * w
  const ny = (dx / len) * w
  const mid: Pt = [base[0] + dx * 0.55, base[1] + dy * 0.55]
  return (
    <g>
      <polygon points={pts([base, [mid[0] + nx, mid[1] + ny], tip])} fill={p[light]} />
      <polygon points={pts([base, tip, [mid[0] - nx, mid[1] - ny]])} fill={p[dark]} />
    </g>
  )
}

/** Leque de estilhaços: lado esquerdo e o espelho dele. */
function shardWings(p: Pal, list: [Pt, Pt, number][]) {
  const side = (flip: boolean) => (
    <g>
      {list.map(([b, t, w], i) => (
        <Shard key={i} base={flip ? mirror([b])[0] : b} tip={flip ? mirror([t])[0] : t} w={w} p={p} light={flip ? 1 : 0} dark={flip ? 3 : 2} />
      ))}
    </g>
  )
  return { left: side(false), right: side(true) }
}

/** Grupo que balança em torno de um ponto (asas, louros). */
function Sway({ on, x, y, deg, children }: { on: boolean; x: number; y: number; deg: number; children: ReactNode }) {
  return (
    <g className={on ? 'rk-flap' : undefined} style={{ transformOrigin: `${x}px ${y}px`, ['--rk-a' as string]: `${deg}deg` } as CSSProperties}>
      {children}
    </g>
  )
}

function Emblem({ tier, id, animated }: { tier: TierId; id: string; animated: boolean }) {
  const p = PAL[tier]
  const a = (cls: string) => (animated ? cls : undefined)
  const defs = (clip: ReactNode) => (
    <defs>
      <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0.9" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`g${id}`}>
        <stop offset="0" stopColor={p[1]} stopOpacity="0.75" />
        <stop offset="1" stopColor={p[1]} stopOpacity="0" />
      </radialGradient>
      <clipPath id={`c${id}`}>{clip}</clipPath>
    </defs>
  )
  const shine = animated && (
    <g clipPath={`url(#c${id})`}>
      <rect className="rk-shine" style={{ animationDuration: '3.2s' }} x="14" y="0" width="22" height="130" fill={`url(#s${id})`} />
    </g>
  )
  const glow = (r: number, cy = 62) => animated && <circle className="rk-glow" cx="60" cy={cy} r={r} fill={`url(#g${id})`} />
  const hexClip = <polygon points={pts(hexPts(60, 60, 40))} />

  switch (tier) {
    case 'ferro':
      return (
        <g>
          {defs(hexClip)}
          {[false, true].map((f) => {
            const plate: Pt[] = [[30, 64], [18, 72], [20, 96], [36, 102], [40, 88]]
            const edge: Pt[] = [[30, 64], [40, 88], [36, 102]]
            return (
              <g key={String(f)}>
                <polygon points={pts(f ? mirror(plate) : plate)} fill={f ? p[2] : p[1]} />
                <polygon points={pts(f ? mirror(edge) : edge)} fill={p[3]} />
              </g>
            )
          })}
          <HexFrame p={p} />
          {hexPts(60, 60, 35.5).map(([x, y], k) => (
            <circle key={k} cx={x} cy={y} r="1.6" fill={p[3]} />
          ))}
          {/* elmo */}
          <g className={a('rk-bob')}>
            <path d="M60 41 C49 41 44 49 44 59 V72 L51 77 V68 H57 V79 H63 V68 H69 V77 L76 72 V59 C76 49 71 41 60 41 Z" fill={p[0]} />
            <path d="M60 41 C71 41 76 49 76 59 V72 L69 77 V68 H63 V79 H60 Z" fill={p[1]} />
            <rect x="47" y="58" width="26" height="5" rx="1.5" fill={FIELD} />
            <rect x="57.5" y="58" width="5" height="16" fill={FIELD} />
            <path d="M60 41 V52" stroke={p[2]} strokeWidth="2.4" strokeLinecap="round" />
          </g>
          {shine}
        </g>
      )

    case 'bronze': {
      const l = Laurel({ p, n: 5, r: 40, from: 100, to: 200, size: 15, cy: 62 })
      return (
        <g>
          {defs(hexClip)}
          <Sway on={animated} x={30} y={94} deg={-7}>{l.left}</Sway>
          <Sway on={animated} x={90} y={94} deg={7}>{l.right}</Sway>
          <HexFrame p={p} />
          <circle cx="60" cy="60" r="21" fill="none" stroke={p[1]} strokeWidth="3" />
          <circle cx="60" cy="60" r="21" fill="none" stroke={p[0]} strokeOpacity="0.6" strokeWidth="1" />
          <Star4 x={60} y={60} r={15} p={p} cls={a('rk-breathe')} />
          {shine}
        </g>
      )
    }

    case 'prata': {
      const w = shardWings(p, [
        [[30, 44], [6, 24], 5],
        [[30, 56], [3, 46], 5],
        [[32, 68], [7, 68], 4.5],
        [[36, 80], [16, 88], 4],
      ])
      return (
        <g>
          {defs(hexClip)}
          <Sway on={animated} x={32} y={62} deg={-13}>{w.left}</Sway>
          <Sway on={animated} x={88} y={62} deg={13}>{w.right}</Sway>
          <HexFrame p={p} />
          {/* livro aberto */}
          <polygon points={pts([[43, 57], [59, 61], [59, 79], [43, 75]])} fill={p[0]} />
          <polygon points={pts([[77, 57], [61, 61], [61, 79], [77, 75]])} fill={p[1]} />
          <path d="M47 63 L56 65.5 M47 67.5 L56 70 M64 65.5 L73 63 M64 70 L73 67.5" stroke={p[2]} strokeWidth="1.3" strokeLinecap="round" />
          <polygon points={pts([[43, 75], [59, 79], [61, 79], [77, 75], [77, 78], [60, 82], [43, 78]])} fill={p[2]} />
          <Star4 x={60} y={46} r={6.5} p={p} cls={a('rk-breathe')} />
          {shine}
        </g>
      )
    }

    case 'ouro': {
      const l = Laurel({ p, n: 6, r: 41, from: 96, to: 215, size: 16, cy: 62 })
      return (
        <g>
          {defs(hexClip)}
          {glow(54)}
          <Sway on={animated} x={28} y={96} deg={-9}>{l.left}</Sway>
          <Sway on={animated} x={92} y={96} deg={9}>{l.right}</Sway>
          <HexFrame p={p} />
          {/* troféu */}
          <g className={a('rk-bob')}>
            <path d="M51 66 C46 66 44 62 45 57 L49 57 M69 66 C74 66 76 62 75 57 L71 57" fill="none" stroke={p[2]} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M49 50 H71 V60 C71 68 66 72 60 72 C54 72 49 68 49 60 Z" fill={p[0]} />
            <path d="M60 50 H71 V60 C71 68 66 72 60 72 Z" fill={p[1]} />
            <rect x="57.5" y="72" width="5" height="6" fill={p[2]} />
            <polygon points={pts([[52, 78], [68, 78], [70, 83], [50, 83]])} fill={p[1]} />
            <polygon points={pts([[60, 78], [68, 78], [70, 83], [60, 83]])} fill={p[2]} />
          </g>
          {animated && <Twinkle x={60} y={42} r={4.5} color={p[0]} />}
          {animated && <Twinkle x={96} y={28} r={4} delay={1.1} color={p[0]} />}
          {shine}
        </g>
      )
    }

    case 'platina': {
      const w = shardWings(p, [
        [[38, 70], [8, 30], 6],
        [[40, 78], [8, 60], 6],
        [[44, 86], [16, 90], 5],
        [[42, 62], [24, 34], 4],
      ])
      const crown: Pt[] = [[38, 62], [44, 44], [52, 55], [60, 38], [68, 55], [76, 44], [82, 62], [80, 74], [40, 74]]
      return (
        <g>
          {defs(<polygon points={pts(crown)} />)}
          {glow(56)}
          <Sway on={animated} x={42} y={80} deg={-9}>{w.left}</Sway>
          <Sway on={animated} x={78} y={80} deg={9}>{w.right}</Sway>
          <polygon points={pts([[34, 46], [48, 32], [52, 36], [40, 48]])} fill={p[1]} />
          <polygon points={pts([[86, 46], [72, 32], [68, 36], [80, 48]])} fill={p[2]} />
          <g className={a('rk-bob')}>
            <polygon points={pts(crown)} fill={p[1]} />
            <polygon points={pts([[60, 38], [68, 55], [76, 44], [82, 62], [80, 74], [60, 74]])} fill={p[2]} />
            <polygon points={pts([[38, 62], [44, 44], [52, 55], [60, 38], [60, 52]])} fill={p[0]} opacity="0.55" />
            <polygon points={pts([[60, 57], [67, 64], [60, 71], [53, 64]])} fill={FIELD} />
            <polygon points={pts([[60, 59.5], [64.5, 64], [60, 68.5], [55.5, 64]])} fill={p[0]} className={a('rk-breathe')} />
          </g>
          <polygon points={pts([[40, 80], [60, 94], [80, 80], [80, 86], [60, 100], [40, 86]])} fill={p[1]} />
          <polygon points={pts([[60, 94], [80, 80], [80, 86], [60, 100]])} fill={p[2]} />
          <Star4 x={60} y={20} r={8} p={p} cls={a('rk-breathe')} />
          {animated && <Twinkle x={20} y={22} r={3.5} delay={0.6} color={p[0]} />}
          {animated && <Twinkle x={100} y={40} r={3} delay={1.6} color={p[0]} />}
          {shine}
        </g>
      )
    }

    case 'diamante': {
      const w = shardWings(p, [
        [[44, 86], [6, 40], 6],
        [[46, 92], [10, 70], 6],
        [[50, 96], [26, 98], 5],
        [[42, 74], [20, 22], 5],
      ])
      return (
        <g>
          {defs(<polygon points={pts([[42, 44], [78, 44], [88, 56], [60, 92], [32, 56]])} />)}
          {glow(58)}
          <Sway on={animated} x={48} y={92} deg={-9}>{w.left}</Sway>
          <Sway on={animated} x={72} y={92} deg={9}>{w.right}</Sway>
          <g className={a('rk-bob')}>
            <polygon points={pts([[42, 44], [52, 44], [48, 56], [32, 56]])} fill={p[0]} />
            <polygon points={pts([[52, 44], [68, 44], [60, 56], [48, 56]])} fill={p[1]} />
            <polygon points={pts([[52, 44], [60, 56], [48, 56]])} fill={p[0]} />
            <polygon points={pts([[68, 44], [78, 44], [88, 56], [72, 56]])} fill={p[2]} />
            <polygon points={pts([[68, 44], [72, 56], [60, 56]])} fill={p[1]} />
            <polygon points={pts([[32, 56], [48, 56], [60, 92]])} fill={p[1]} />
            <polygon points={pts([[48, 56], [60, 56], [60, 92]])} fill={p[0]} />
            <polygon points={pts([[60, 56], [72, 56], [60, 92]])} fill={p[2]} />
            <polygon points={pts([[72, 56], [88, 56], [60, 92]])} fill={p[3]} />
          </g>
          <Star4 x={60} y={26} r={8} p={p} cls={a('rk-breathe')} />
          {animated && <Twinkle x={46} y={50} r={4} color="#fff" />}
          {animated && <Twinkle x={100} y={30} r={3.5} delay={0.9} color={p[0]} />}
          {animated && <Twinkle x={18} y={54} r={3} delay={1.7} color={p[0]} />}
          {shine}
        </g>
      )
    }

    case 'mestre': {
      const gold = PAL.ouro
      const crystals: [Pt, Pt, number][] = [
        [[46, 94], [28, 58], 7],
        [[74, 94], [92, 58], 7],
        [[52, 97], [43, 48], 8.5],
        [[68, 97], [77, 48], 8.5],
        [[60, 102], [60, 40], 11],
      ]
      const front = 'M20 70 A40 12 0 0 0 100 70'
      const back = 'M20 70 A40 12 0 0 1 100 70'
      return (
        <g>
          {defs(<polygon points={pts([[60, 42], [67, 70], [60, 100], [53, 70]])} />)}
          {glow(60, 64)}
          <g transform="rotate(-14 60 70)">
            <path d={back} fill="none" stroke={p[2]} strokeWidth="6" strokeLinecap="round" opacity="0.7" />
          </g>
          <g className={a('rk-breathe')}>
            {crystals.map(([b, t, w], i) => (
              <Shard key={i} base={b} tip={t} w={w} p={p} light={i === 4 ? 0 : 1} dark={i === 4 ? 1 : 2} />
            ))}
          </g>
          <g transform="rotate(-14 60 70)">
            <path d={front} fill="none" stroke={p[1]} strokeWidth="6" strokeLinecap="round" />
            <path d={front} fill="none" stroke={p[0]} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
            {animated && <path className="rk-dash" style={{ animationDuration: '1.4s' }} d={front} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" pathLength="100" strokeDasharray="18 82" />}
          </g>
          <g className={a('rk-bob')}>
            <polygon points={pts([[42, 36], [40, 18], [50, 27], [60, 12], [70, 27], [80, 18], [78, 36]])} fill={gold[1]} />
            <polygon points={pts([[60, 12], [70, 27], [80, 18], [78, 36], [60, 36]])} fill={gold[2]} />
            <polygon points={pts([[42, 36], [40, 18], [50, 27], [60, 12], [60, 22]])} fill={gold[0]} opacity="0.6" />
            <rect x="40" y="36" width="40" height="5" fill={gold[2]} />
            <rect x="40" y="36" width="20" height="5" fill={gold[1]} />
            <polygon points={pts([[60, 25], [63, 29], [60, 33], [57, 29]])} fill={p[1]} />
          </g>
          <Star4 x={60} y={4} r={6} p={p} cls={a('rk-breathe')} />
          {animated &&
            (
              [
                [14, 40, 0, 4],
                [106, 36, 0.7, 4.5],
                [100, 98, 1.3, 3.5],
                [20, 100, 1.9, 3],
                [88, 12, 2.4, 3],
              ] as const
            ).map(([x, y, d, r]) => <Twinkle key={`${x}${y}`} x={x} y={y} r={r} delay={d} color={p[0]} />)}
          {shine}
        </g>
      )
    }
  }
}

/** Emblema do rank. `animated` liga os movimentos (desligado nos ranks ainda não alcançados). */
export function RankEmblem({ pos, size = 56, showDivision = true, animated = true }: { pos: number; size?: number; showDivision?: boolean; animated?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const tier = tierOf(pos)
  const p = PAL[tier.id]
  const div = divisionOf(pos)
  const h = Math.max(13, Math.round(size * 0.2))
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Rank ${tier.name}${div ? ` ${div}` : ''}`}>
      <svg viewBox="0 0 120 120" width={size} height={size} className="essential-motion overflow-visible" aria-hidden>
        <Emblem tier={tier.id} id={id} animated={animated} />
      </svg>
      {showDivision && div && (
        <span
          className="absolute left-1/2 grid -translate-x-1/2 place-items-center rounded-full font-display font-extrabold tracking-wider text-white tabular-nums"
          style={{ bottom: -h * 0.35, height: h, minWidth: h * 1.7, padding: `0 ${h * 0.35}px`, fontSize: h * 0.58, background: FIELD, boxShadow: `inset 0 0 0 1.5px ${p[1]}` }}
        >
          {div}
        </span>
      )}
    </span>
  )
}

/** Espaço em volta do emblema (o brilho já vem no próprio emblema). */
export function RankFrame({ size, children }: { pos: number; size: number; children: ReactNode }) {
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      {children}
    </div>
  )
}
