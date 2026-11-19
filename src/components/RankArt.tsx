import { useId, type ReactNode } from 'react'
import { TIERS, divisionOf, rankName, tierOf } from '../lib/rank'

/* Arte dos ranks: emblemas com volume (metal chanfrado, gemas lapidadas, brilho)
 * e a moldura animada que cresce com o rank — parada no Ferro, em chamas no Mestre. */

type TierId = (typeof TIERS)[number]['id']

const PAL: Record<TierId, { rim: [string, string, string]; field: [string, string]; gem?: [string, string, string]; boss?: [string, string] }> = {
  ferro: { rim: ['#d6dae0', '#6b717b', '#33373e'], field: ['#757b85', '#2f333a'], boss: ['#c9ced6', '#4d525a'] },
  bronze: { rim: ['#ffd7ad', '#b8682f', '#552a0c'], field: ['#9c5524', '#43200a'], boss: ['#ffcf9c', '#8a4f22'] },
  prata: { rim: ['#ffffff', '#b9c4d2', '#5d6a7c'], field: ['#7d8ca1', '#2c384c'], gem: ['#ffffff', '#a9bdd6', '#465c7c'] },
  ouro: { rim: ['#fff4b8', '#e2a51c', '#7a4f00'], field: ['#b0740a', '#4f2f00'], gem: ['#ffc2c2', '#e0283c', '#5e000d'] },
  platina: { rim: ['#e6fffa', '#4fd1b8', '#0f5e52'], field: ['#1c8a7a', '#083832'], gem: ['#dcfff4', '#2fe0a8', '#04573f'] },
  diamante: { rim: ['#f7efe6', '#7ea6ff', '#1f3aa6'], field: ['#2f4fd0', '#0d1a5a'], gem: ['#ffffff', '#c4e3ff', '#3f78ff'] },
  mestre: { rim: ['#f7e9ff', '#b47aff', '#3f1189'], field: ['#5a21b4', '#1a0842'], gem: ['#ffe8ff', '#e05cff', '#5c0096'] },
}

// ---------- utilidades de cor e geometria ----------
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
function mix(a: string, b: string, t: number) {
  const [x, y] = [hex(a), hex(b)]
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
/** Tom de uma faceta pela direção: luz vindo de cima à esquerda. */
function facetColor(angle: number, [light, mid, dark]: [string, string, string]) {
  const s = (Math.cos(angle - (-3 * Math.PI) / 4) + 1) / 2 // 1 = de frente para a luz
  return s > 0.5 ? mix(mid, light, (s - 0.5) * 2) : mix(dark, mid, s * 2)
}
const poly = (pts: [number, number][]) => pts.map((p) => p.map((v) => v.toFixed(2)).join(',')).join(' ')
const ring = (n: number, r: number, cx: number, cy: number, rot = -Math.PI / 2, rx = r): [number, number][] =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (2 * Math.PI * i) / n
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * r]
  })

/** Gema lapidada: facetas triangulares sombreadas + mesa + reflexo. */
function Gem({ cx, cy, pts, colors, table = 0.45, sparkle }: { cx: number; cy: number; pts: [number, number][]; colors: [string, string, string]; table?: number; sparkle?: boolean }) {
  const inner = pts.map(([x, y]) => [cx + (x - cx) * table, cy + (y - cy) * table] as [number, number])
  return (
    <g>
      {pts.map((p, i) => {
        const q = pts[(i + 1) % pts.length]
        const a = Math.atan2((p[1] + q[1]) / 2 - cy, (p[0] + q[0]) / 2 - cx)
        return <polygon key={i} points={poly([p, q, inner[(i + 1) % pts.length], inner[i]])} fill={facetColor(a, colors)} />
      })}
      {inner.map((p, i) => {
        const q = inner[(i + 1) % inner.length]
        const a = Math.atan2((p[1] + q[1]) / 2 - cy, (p[0] + q[0]) / 2 - cx)
        return <polygon key={`t${i}`} points={poly([p, q, [cx, cy]])} fill={mix(facetColor(a, colors), colors[0], 0.35)} />
      })}
      <polygon points={poly(pts)} fill="none" stroke={mix(colors[2], '#000000', 0.35)} strokeWidth="1" strokeLinejoin="round" />
      <ellipse cx={cx - (cx - pts[0][0]) * 0.1 - 3} cy={cy - 4} rx="2.6" ry="1.4" fill="#fff" opacity="0.85" transform={`rotate(-35 ${cx - 3} ${cy - 4})`} />
      {sparkle && <Sparkle x={cx + 6} y={cy - 7} r={5} delay={0.4} />}
    </g>
  )
}

function Sparkle({ x, y, r, delay = 0, color = '#ffffff' }: { x: number; y: number; r: number; delay?: number; color?: string }) {
  return (
    <path
      className="rk-twinkle"
      style={{ animationDelay: `${delay}s` }}
      d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`}
      fill={color}
    />
  )
}

function Rivet({ x, y, id }: { x: number; y: number; id: string }) {
  return (
    <g>
      <circle cx={x} cy={y + 0.6} r="2.6" fill="#000" opacity="0.35" />
      <circle cx={x} cy={y} r="2.6" fill={`url(#rv${id})`} />
    </g>
  )
}

/** Ramos de louro ao longo de uma curva (quadrática). */
function Laurel({ p0, p1, p2, fill, n = 7, size = 1 }: { p0: [number, number]; p1: [number, number]; p2: [number, number]; fill: string; n?: number; size?: number }) {
  const at = (t: number) => [0, 1].map((k) => (1 - t) ** 2 * p0[k] + 2 * (1 - t) * t * p1[k] + t * t * p2[k]) as [number, number]
  const leaves: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const t = 0.12 + (i / (n - 1)) * 0.82
    const [x, y] = at(t)
    const [x2, y2] = at(t + 0.01)
    const tang = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI
    for (const side of [-1, 1]) {
      const ang = tang + side * 38
      const rad = (ang * Math.PI) / 180
      const lx = x + Math.cos(rad) * 4.2 * size
      const ly = y + Math.sin(rad) * 4.2 * size
      leaves.push(<ellipse key={`${i}${side}`} cx={lx} cy={ly} rx={5 * size} ry={2.1 * size} transform={`rotate(${ang} ${lx} ${ly})`} fill={fill} stroke="#00000033" strokeWidth="0.5" />)
    }
  }
  return (
    <g>
      <path d={`M${p0[0]} ${p0[1]} Q${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`} fill="none" stroke={fill} strokeWidth={1.4 * size} />
      {leaves}
    </g>
  )
}

/** Asa de penas (lado esquerdo; o direito é espelhado). */
function Wing({ fill, stroke, big }: { fill: string; stroke: string; big?: boolean }) {
  const angles = big ? [-2, -18, -34, -50, -66] : [-6, -24, -42, -60]
  const scales = big ? [0.62, 0.8, 0.98, 1.08, 1] : [0.62, 0.82, 0.98, 0.9]
  return (
    <g transform="translate(31 50)">
      {angles.map((a, i) => (
        <path
          key={i}
          transform={`rotate(${a}) scale(${scales[i]})`}
          d="M0 0 C -6 -5 -24 -8 -42 -4 C -38 -1.5 -39 0.5 -34 2.5 C -22 5.5 -9 4.5 0 0 Z M-8 -0.5 L-36 -2"
          fill={fill}
          stroke={stroke}
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
      ))}
    </g>
  )
}

const OUTER = 'M60 14 L94 26 V56 C94 84 78 100 60 110 C42 100 26 84 26 56 V26 Z'
const FIELD = 'M60 21 L87 30.5 V56 C87 79 74 92.5 60 101 C46 92.5 33 79 33 56 V30.5 Z'
const ENGRAVE = 'M60 27 L81 34.5 V56 C81 75 70 86 60 93 C50 86 39 75 39 56 V34.5 Z'

/** Emblema do rank com volume, detalhes e gema. `animated` liga o brilho. */
export function RankEmblem({ pos, size = 56, showDivision = true, animated = true }: { pos: number; size?: number; showDivision?: boolean; animated?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const tier = tierOf(pos)
  const ti = TIERS.indexOf(tier)
  const p = PAL[tier.id]
  const div = divisionOf(pos)
  const [rl, rm, rd] = p.rim
  const W = 148
  const H = 142

  return (
    <svg
      width={size}
      height={(size * H) / W}
      viewBox={`-14 -6 ${W} ${H}`}
      role="img"
      aria-label={rankName(pos)}
      className={`shrink-0 overflow-visible ${animated ? 'essential-motion' : ''}`}
      style={{ filter: `drop-shadow(0 ${size / 18}px ${size / 12}px rgba(16,24,40,.35))` }}
    >
      <defs>
        <linearGradient id={`rim${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={rl} />
          <stop offset="0.3" stopColor={rm} />
          <stop offset="0.55" stopColor={rd} />
          <stop offset="0.78" stopColor={rm} />
          <stop offset="1" stopColor={rl} />
        </linearGradient>
        <radialGradient id={`fld${id}`} cx="0.4" cy="0.25" r="0.85">
          <stop offset="0" stopColor={mix(p.field[0], '#ffffff', 0.18)} />
          <stop offset="0.55" stopColor={p.field[0]} />
          <stop offset="1" stopColor={p.field[1]} />
        </radialGradient>
        <linearGradient id={`bev${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id={`rv${id}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor={rm} />
          <stop offset="1" stopColor={rd} />
        </radialGradient>
        <radialGradient id={`boss${id}`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor={p.boss?.[0] ?? rl} />
          <stop offset="1" stopColor={p.boss?.[1] ?? rd} />
        </radialGradient>
        <linearGradient id={`shine${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`gold${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6c2" />
          <stop offset="0.45" stopColor="#f2b51e" />
          <stop offset="1" stopColor="#8a5600" />
        </linearGradient>
        <linearGradient id={`rib${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(rd, '#ffffff', 0.15)} />
          <stop offset="1" stopColor={mix(rd, '#000000', 0.45)} />
        </linearGradient>
        <clipPath id={`clip${id}`}>
          <path d={OUTER} />
        </clipPath>
      </defs>

      {/* Asas (Platina em diante) */}
      {ti >= 4 && (
        <g>
          <Wing fill={`url(#rim${id})`} stroke={mix(rd, '#000000', 0.3)} big={ti === 6} />
          <g transform="translate(120 0) scale(-1 1)">
            <Wing fill={`url(#rim${id})`} stroke={mix(rd, '#000000', 0.3)} big={ti === 6} />
          </g>
        </g>
      )}

      {/* Louros (Ouro e Mestre) */}
      {(ti === 3 || ti === 6) && (
        <g>
          <Laurel p0={[54, 116]} p1={[16, 110]} p2={[18, 50]} fill={`url(#gold${id})`} />
          <Laurel p0={[66, 116]} p1={[104, 110]} p2={[102, 50]} fill={`url(#gold${id})`} />
        </g>
      )}

      {/* Escudo: aro metálico, chanfro, campo e gravação */}
      <path d={OUTER} fill={`url(#rim${id})`} stroke={mix(rd, '#000000', 0.4)} strokeWidth="1.5" strokeLinejoin="round" />
      <path d={OUTER} fill="none" stroke={`url(#bev${id})`} strokeWidth="2.2" transform="translate(60 62) scale(0.965) translate(-60 -62)" />
      <path d={FIELD} fill={`url(#fld${id})`} stroke={mix(rd, '#000000', 0.5)} strokeWidth="1.2" />
      <path d={ENGRAVE} fill="none" stroke={rl} strokeOpacity="0.35" strokeWidth="0.9" />
      <path d="M36 32 L60 23.5 V45 C50 45 41 50 36 58 Z" fill="#fff" opacity="0.13" />

      {/* Rebites (Ferro e Bronze) */}
      {ti <= 1 && [
        [36, 34],
        [84, 34],
        [40, 78],
        [80, 78],
        [60, 95],
      ].map(([x, y]) => <Rivet key={`${x}${y}`} x={x} y={y} id={id} />)}

      {/* Centro: bossa de metal (Ferro/Bronze) ou gema lapidada */}
      {ti === 0 && (
        <g>
          <circle cx="60" cy="58" r="13" fill="#000" opacity="0.3" transform="translate(0 1.5)" />
          <circle cx="60" cy="58" r="13" fill={`url(#boss${id})`} stroke={rd} strokeWidth="1" />
          <circle cx="60" cy="58" r="7" fill="none" stroke={rd} strokeOpacity="0.5" strokeWidth="1" />
        </g>
      )}
      {ti === 1 && (
        <g>
          <circle cx="60" cy="58" r="15" fill="#000" opacity="0.3" transform="translate(0 1.5)" />
          <circle cx="60" cy="58" r="15" fill={`url(#rim${id})`} stroke={rd} strokeWidth="1" />
          <circle cx="60" cy="58" r="10.5" fill={`url(#boss${id})`} stroke={rd} strokeWidth="0.8" />
          <path d="M60 50.5 L62 56 L67.5 58 L62 60 L60 65.5 L58 60 L52.5 58 L58 56 Z" fill={rd} opacity="0.55" />
        </g>
      )}
      {ti === 2 && p.gem && <Gem cx={60} cy={58} pts={[[60, 41], [75, 58], [60, 75], [45, 58]]} colors={p.gem} table={0.4} />}
      {ti === 3 && p.gem && <Gem cx={60} cy={58} pts={ring(8, 16, 60, 58, -Math.PI / 2, 13)} colors={p.gem} sparkle={animated} />}
      {ti === 4 && p.gem && (
        <Gem cx={60} cy={58} pts={[[52, 42], [68, 42], [76, 50], [76, 66], [68, 74], [52, 74], [44, 66], [44, 50]]} colors={p.gem} table={0.55} sparkle={animated} />
      )}
      {ti === 5 && p.gem && <Gem cx={60} cy={56} pts={[[48, 46], [60, 40], [72, 46], [78, 54], [60, 78], [42, 54]]} colors={p.gem} table={0.5} sparkle={animated} />}
      {ti === 6 && p.gem && (
        <Gem cx={60} cy={58} pts={ring(10, 19, 60, 58).map(([x, y], i) => (i % 2 ? [60 + (x - 60) * 0.5, 58 + (y - 58) * 0.5] : [x, y]) as [number, number])} colors={p.gem} table={0.35} sparkle={animated} />
      )}

      {/* Coroa (Mestre) */}
      {ti === 6 && (
        <g>
          <path d="M36 24 L33 4 L45 13 L52 -1 L60 11 L68 -1 L75 13 L87 4 L84 24 Z" fill={`url(#gold${id})`} stroke="#7a4a00" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M36 24 H84 L83 19 H37 Z" fill="#7a4a00" opacity="0.35" />
          {[
            [33, 4, '#ff3d6e'],
            [52, -1, '#4fc3ff'],
            [68, -1, '#4fc3ff'],
            [87, 4, '#ff3d6e'],
            [60, 17, '#ff3d6e'],
          ].map(([x, y, c]) => (
            <g key={`${x}${y}`}>
              <circle cx={x as number} cy={y as number} r="2.8" fill={c as string} stroke="#fff" strokeWidth="0.8" />
              <circle cx={(x as number) - 0.9} cy={(y as number) - 0.9} r="0.9" fill="#fff" />
            </g>
          ))}
        </g>
      )}

      {/* Brilho que passa pelo escudo (Prata em diante) */}
      {animated && ti >= 2 && (
        <g clipPath={`url(#clip${id})`}>
          <rect className="rk-shine" style={{ animationDuration: `${7 - ti * 0.6}s` }} x="22" y="0" width="22" height="120" fill={`url(#shine${id})`} transform="skewX(-18)" />
        </g>
      )}

      {/* Faixa com a divisão */}
      {showDivision && div && (
        <g>
          <path d="M30 104 L36 112 L30 120 H44 Z" fill={mix(rd, '#000000', 0.55)} />
          <path d="M90 104 L84 112 L90 120 H76 Z" fill={mix(rd, '#000000', 0.55)} />
          <path d="M38 102 H82 L86 111 L82 120 H38 L34 111 Z" fill={`url(#rib${id})`} stroke={mix(rd, '#000000', 0.5)} strokeWidth="1" />
          <path d="M38 102 H82 L84 106 H36 Z" fill="#fff" opacity="0.2" />
          <text x="60" y="115.5" textAnchor="middle" fontSize="12" fontWeight="900" fill="#fff" fontFamily="system-ui, sans-serif" letterSpacing="1">
            {div}
          </text>
        </g>
      )}
    </svg>
  )
}

// ---------- Moldura animada ----------

const FLAME = 'M0 0 C -9 -2 -12 -14 -6 -24 C -5 -18 -2 -16 0 -13 C 0 -23 4 -31 2 -42 C 11 -31 15 -16 9 -5 C 6 -1 3 0 0 0 Z'

/** Moldura em volta do emblema: muda e "ganha vida" conforme o rank sobe. */
export function RankFrame({ pos, size, children }: { pos: number; size: number; children: ReactNode }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const tier = tierOf(pos)
  const ti = TIERS.indexOf(tier)
  const [rl, rm, rd] = PAL[tier.id].rim
  const glow = ti >= 3
  const deg = (a: number) => (a * Math.PI) / 180
  const onCircle = (a: number, r: number): [number, number] => [100 + Math.cos(deg(a)) * r, 100 + Math.sin(deg(a)) * r]

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} className="essential-motion absolute inset-0 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={`fr${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={rl} />
            <stop offset="0.35" stopColor={rm} />
            <stop offset="0.6" stopColor={rd} />
            <stop offset="1" stopColor={rl} />
          </linearGradient>
          <radialGradient id={`gl${id}`}>
            <stop offset="0.68" stopColor={rm} stopOpacity="0" />
            <stop offset="0.82" stopColor={rm} stopOpacity="0.7" />
            <stop offset="1" stopColor={rm} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`fo${id}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#d10000" />
            <stop offset="0.35" stopColor="#ff3d00" />
            <stop offset="0.75" stopColor="#ff8a00" />
            <stop offset="1" stopColor="#ffc93d" />
          </linearGradient>
          <linearGradient id={`fp${id}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#c026ff" />
            <stop offset="1" stopColor="#ff5ad1" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id={`gd${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff6c2" />
            <stop offset="0.5" stopColor="#f2b51e" />
            <stop offset="1" stopColor="#8a5600" />
          </linearGradient>
        </defs>

        {/* Aura (Ouro em diante): pulsa */}
        {glow && <circle className="rk-pulse" cx="100" cy="100" r={ti === 6 ? 108 : 100} fill={`url(#gl${id})`} />}

        {/* Mestre: fogo em volta */}
        {ti === 6 && (
          <g>
            {Array.from({ length: 26 }, (_, i) => {
              const a = -90 + i * (360 / 26)
              const top = Math.cos(deg(a + 90))
              const s = 0.55 + Math.max(0, top) * 0.85
              const [x, y] = onCircle(a, 82)
              return (
                <g key={i} transform={`translate(${x} ${y}) rotate(${a + 90}) scale(${s})`}>
                  <path className="rk-flame" style={{ animationDelay: `${(i * 0.13) % 0.9}s`, animationDuration: `${0.7 + (i % 4) * 0.12}s` }} d={FLAME} fill={i % 3 === 0 ? `url(#fp${id})` : `url(#fo${id})`} />
                  <g transform="translate(1 -3) scale(0.5)">
                    <path className="rk-flame" style={{ animationDelay: `${(i * 0.21) % 0.8}s` }} d={FLAME} fill="#ffe27a" />
                  </g>
                </g>
              )
            })}
            {Array.from({ length: 10 }, (_, i) => {
              const [x, y] = onCircle(-150 + i * 13, 90)
              return <circle key={`e${i}`} className="rk-ember" style={{ animationDelay: `${(i * 0.37) % 2.2}s` }} cx={x} cy={y} r={1.6 + (i % 3) * 0.6} fill={i % 2 ? '#ffd34d' : '#ff8a00'} />
            })}
          </g>
        )}

        {/* Louros da moldura (Ouro) */}
        {ti === 3 && (
          <g>
            <Laurel p0={onCircle(95, 92)} p1={[22, 186]} p2={onCircle(190, 92)} fill={`url(#gd${id})`} n={8} size={1.4} />
            <Laurel p0={onCircle(85, 92)} p1={[178, 186]} p2={onCircle(-10, 92)} fill={`url(#gd${id})`} n={8} size={1.4} />
          </g>
        )}

        {/* Cristais orbitando (Diamante) */}
        {ti === 5 && (
          <g className="rk-spin" style={{ animationDuration: '18s' }}>
            {Array.from({ length: 8 }, (_, i) => {
              const [x, y] = onCircle(i * 45, 94)
              return (
                <g key={i} transform={`translate(${x} ${y}) rotate(${i * 45 + 90})`}>
                  <path d="M0 -9 L5 0 L0 9 L-5 0 Z" fill="#dff0ff" stroke="#3f78ff" strokeWidth="1" />
                  <path d="M0 -9 L5 0 L0 0 Z" fill="#fff" />
                </g>
              )
            })}
          </g>
        )}

        {/* Anel de runas (Platina e Diamante) */}
        {(ti === 4 || ti === 5) && (
          <circle className="rk-spin-rev" cx="100" cy="100" r="96" fill="none" stroke={rl} strokeOpacity="0.75" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
        )}

        {/* Anel principal */}
        <circle cx="100" cy="100" r="84" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth={ti === 0 ? 6 : 10} transform="translate(0 2)" />
        <circle cx="100" cy="100" r="84" fill="none" stroke={`url(#fr${id})`} strokeWidth={ti === 0 ? 6 : 10} />
        {ti >= 1 && <circle cx="100" cy="100" r="79" fill="none" stroke={rd} strokeOpacity="0.5" strokeWidth="1" />}
        {ti >= 1 && <circle cx="100" cy="100" r="89" fill="none" stroke={rl} strokeOpacity="0.7" strokeWidth="1" />}

        {/* Rebites do anel (Bronze) */}
        {ti === 1 &&
          Array.from({ length: 12 }, (_, i) => {
            const [x, y] = onCircle(i * 30, 84)
            return <circle key={i} cx={x} cy={y} r="2.6" fill={rl} stroke={rd} strokeWidth="0.8" />
          })}

        {/* Reflexo girando no anel (Prata em diante) */}
        {ti >= 2 && (
          <circle
            className="rk-spin"
            style={{ animationDuration: `${Math.max(2.2, 6 - ti * 0.6)}s` }}
            cx="100"
            cy="100"
            r="84"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.85"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${ti >= 5 ? 70 : 45} 600`}
          />
        )}

        {/* Faíscas (Ouro em diante) */}
        {ti >= 3 &&
          [
            [28, 40, 0],
            [170, 52, 0.7],
            [160, 160, 1.3],
            [36, 150, 1.9],
            [100, 8, 1.1],
          ]
            .slice(0, ti === 3 ? 3 : 5)
            .map(([x, y, d]) => <Sparkle key={`${x}${y}`} x={x} y={y} r={ti >= 5 ? 7 : 5.5} delay={d} color={ti === 6 ? '#ffe9a8' : '#ffffff'} />)}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}
