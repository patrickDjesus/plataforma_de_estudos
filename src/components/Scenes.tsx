import type { ReactNode } from 'react'
import { Capybara, type CapiPose } from './Capybara'

/*
 * Cenários ilustrados (mesmo estilo dos cartões de modo das Questões):
 * formas simples, cores claras, a Mendi dentro da cena e animações leves.
 */

const sparkle = (x: number, y: number, r: number, d: number, fill = '#ffe27a') => (
  <path
    key={`${x}-${y}`}
    className="rk-twinkle"
    style={{ animationDelay: `${d}s` }}
    d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`}
    fill={fill}
  />
)

/** Engrenagem: círculo com dentes, gira em volta do próprio centro. */
function Gear({ x, y, r, teeth, fill, hole, reverse = false, dur = 10 }: { x: number; y: number; r: number; teeth: number; fill: string; hole: string; reverse?: boolean; dur?: number }) {
  const tw = Math.max(6, r * 0.32)
  return (
    <g className={reverse ? 'sc-spin-r' : 'sc-spin'} style={{ transformOrigin: `${x}px ${y}px`, animationDuration: `${dur}s` }}>
      {Array.from({ length: teeth }, (_, i) => (
        <rect key={i} x={x - tw / 2} y={y - r - tw * 0.55} width={tw} height={tw * 1.1} rx="2.5" fill={fill} transform={`rotate(${(i * 360) / teeth} ${x} ${y})`} />
      ))}
      <circle cx={x} cy={y} r={r} fill={fill} />
      <circle cx={x} cy={y} r={r * 0.38} fill={hole} />
    </g>
  )
}

const BW = 1200
const BH = 190

/** Faixa de topo da página: título à esquerda, cenário com a Mendi à direita. */
export function SceneBanner({ title, subtitle, from, to, pose, scene, front, children }: { title: string; subtitle?: string; from: string; to: string; pose: CapiPose; scene: ReactNode; front?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-in relative mb-6 h-[190px] overflow-hidden rounded-[26px] text-white shadow-[0_18px_34px_-22px_rgba(16,24,40,0.6)]" style={{ background: `linear-gradient(100deg, ${from}, ${to})` }}>
      <svg viewBox={`0 0 ${BW} ${BH}`} preserveAspectRatio="xMaxYMax slice" className="essential-motion pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {/* bolhas suaves ao fundo */}
        <circle cx="520" cy="-10" r="90" fill="#fff" opacity=".07" />
        <circle cx="660" cy="200" r="70" fill="#fff" opacity=".06" />
        {scene}
        <ellipse cx="1052" cy="184" rx="62" ry="8" fill="#000" opacity=".12" />
        <g transform="translate(978 24)">
          <g className="sc-capi">
            <Capybara pose={pose} size={150} />
          </g>
        </g>
        {front}
      </svg>
      <div className="relative z-10 flex h-full max-w-[56%] flex-col justify-center px-7">
        <h1 className="font-display text-[30px] leading-none font-extrabold drop-shadow-[0_2px_4px_rgba(0,0,0,.15)]">{title}</h1>
        {subtitle && <p className="mt-2.5 text-sm leading-snug font-semibold text-white/90">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

/* ---------- Recuperação: cartões de memória virando ---------- */
const memCard = (cx: number, cy: number, rot: number, extra?: ReactNode, cls?: string) => (
  <g transform={`rotate(${rot} ${cx} ${cy})`}>
    <g className={cls} style={cls ? { transformOrigin: `${cx}px ${cy}px` } : undefined}>
      <rect x={cx - 36} y={cy - 48} width="72" height="96" rx="12" fill="#fff" />
      <rect x={cx - 36} y={cy - 48} width="72" height="16" rx="8" fill="#e8edff" />
      {extra ?? (
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#9fb0ff" fontFamily="Sora, sans-serif" fontWeight="800" fontSize="34">
          ?
        </text>
      )}
    </g>
  </g>
)
export const recoveryScene = (
  <>
    <path d="M560 190 Q760 132 940 160 T1200 140 V190 Z" fill="#fff" opacity=".12" />
    <path d="M700 190 Q880 156 1060 170 T1200 166 V190 Z" fill="#fff" opacity=".14" />
    {memCard(742, 104, -14)}
    {memCard(
      840,
      96,
      2,
      <>
        <text className="sc-faceA" x="840" y="110" textAnchor="middle" fill="#3e63f2" fontFamily="Sora, sans-serif" fontWeight="800" fontSize="34">
          ?
        </text>
        <path className="sc-faceB" d="M824 100 L836 112 L858 88" fill="none" stroke="#21b07a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </>,
      'sc-flip',
    )}
    {/* lâmpada da ideia */}
    <g transform="translate(944 44)">
      <circle className="sc-glow" r="24" fill="#ffe27a" opacity=".35" />
      <circle r="13" fill="#ffe27a" />
      <rect x="-6" y="11" width="12" height="9" rx="2" fill="#fff" />
      <path d="M-4 -2 L0 4 L4 -2" fill="none" stroke="#e8a500" strokeWidth="2" strokeLinecap="round" />
    </g>
    {sparkle(900, 20, 8, 0)}
    {sparkle(700, 40, 6, 0.7, '#fff')}
    {sparkle(1160, 60, 7, 1.2)}
  </>
)

/* ---------- Ajustes: oficina com engrenagens e controles ---------- */
export const settingsScene = (
  <>
    <path d="M560 190 Q760 140 960 162 T1200 146 V190 Z" fill="#fff" opacity=".1" />
    {/* painel de controles */}
    <g transform="translate(610 36)">
      <rect width="118" height="112" rx="16" fill="#fff" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(18 ${26 + i * 31})`}>
          <rect width="82" height="8" rx="4" fill="#e6e9f5" />
          <rect width="82" height="8" rx="4" fill={['#3e63f2', '#ff8a3d', '#21b07a'][i]} opacity=".35" />
          <circle className="sc-knob" style={{ animationDelay: `${i * 0.7}s`, animationDuration: `${2.6 + i * 0.5}s` }} cx="16" cy="4" r="9" fill={['#3e63f2', '#ff8a3d', '#21b07a'][i]} stroke="#fff" strokeWidth="3" />
        </g>
      ))}
    </g>
    <Gear x={828} y={78} r={40} teeth={10} fill="#ffd34d" hole="#5468c9" dur={9} />
    <Gear x={890} y={146} r={24} teeth={8} fill="#fff" hole="#7385e0" reverse dur={5.4} />
    <Gear x={770} y={160} r={16} teeth={7} fill="#ffb3c1" hole="#7385e0" reverse dur={4} />
    {sparkle(940, 30, 7, 0.3, '#fff')}
    {sparkle(1170, 50, 8, 1)}
  </>
)
export const settingsFront = (
  <g transform="translate(14 18)">
  <g className="sc-wrench" style={{ transformOrigin: '1106px 150px' }}>
    <g transform="rotate(-38 1106 130)">
      <rect x="1100" y="98" width="12" height="56" rx="5" fill="#c9ccd6" />
      <path d="M1094 92 a14 14 0 1 1 24 0 l-6 8 h-12 Z" fill="#c9ccd6" />
      <rect x="1102" y="80" width="8" height="12" rx="2" fill="#5468c9" />
    </g>
  </g>
  </g>
)

/* ---------- Caderno: cantinho de leitura (estado vazio) ---------- */
const SHELF: [number, number, number, string][] = [
  [40, 70, 40, '#ff6b7a'],
  [54, 70, 34, '#3e63f2'],
  [68, 70, 44, '#ffc83d'],
  [84, 70, 36, '#8b5cf6'],
  [100, 70, 30, '#21b07a'],
  [44, 132, 34, '#ff8a3d'],
  [58, 132, 42, '#2fb5d6'],
  [74, 132, 30, '#e2551b'],
]
export function NotebookScene() {
  return (
    <svg viewBox="0 0 560 250" className="essential-motion w-full max-w-[560px]" role="img" aria-label="A Mendi lendo no cantinho do caderno">
      <defs>
        <linearGradient id="sc-nb-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc98a" />
          <stop offset="1" stopColor="#ffe3bd" />
        </linearGradient>
        <linearGradient id="sc-nb-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6c9" stopOpacity=".9" />
          <stop offset="1" stopColor="#fff6c9" stopOpacity="0" />
        </linearGradient>
        <clipPath id="sc-nb-clip">
          <rect width="560" height="250" rx="26" />
        </clipPath>
      </defs>
      <g clipPath="url(#sc-nb-clip)">
        <rect width="560" height="250" fill="url(#sc-nb-wall)" />
        {/* estante */}
        {[110, 172].map((y) => (
          <rect key={y} x="30" y={y} width="104" height="8" rx="3" fill="#c99260" />
        ))}
        {SHELF.map(([x, base, h, c], i) => (
          <rect key={`${x}${base}`} className={i === 2 ? 'sc-book' : undefined} x={x} y={base + 40 - h} width="12" height={h} rx="2" fill={c} />
        ))}
        <path d="M100 172 h20 l-3 -16 h-14 Z" fill="#ff8f6b" />
        <path className="sc-sway" style={{ transformOrigin: '110px 156px' }} d="M110 156 C100 146 100 134 106 126 C112 136 113 146 110 156 C116 146 124 140 130 140 C126 150 118 156 110 156 Z" fill="#169a6c" />

        {/* luminária pendurada com luz */}
        <path d="M280 0 V44" stroke="#5a3820" strokeWidth="3" />
        <path className="sc-glow" d="M256 64 L304 64 L360 214 L200 214 Z" fill="url(#sc-nb-light)" />
        <path d="M256 66 Q280 34 304 66 Z" fill="#3e63f2" />
        <circle cx="280" cy="66" r="6" fill="#fff6c9" />

        {/* notas conectadas */}
        <g stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none">
          <path className="sc-draw" d="M440 70 L500 110" pathLength="100" strokeDasharray="100" />
          <path className="sc-draw" style={{ animationDelay: '.6s' }} d="M500 110 L452 152" pathLength="100" strokeDasharray="100" />
          <path className="sc-draw" style={{ animationDelay: '1.2s' }} d="M440 70 L452 152" pathLength="100" strokeDasharray="100" />
        </g>
        {[
          [440, 70, '#ff6b7a'],
          [500, 110, '#3e63f2'],
          [452, 152, '#21b07a'],
        ].map(([x, y, c], i) => (
          <g key={String(c)} className="sc-pop" style={{ animationDelay: `${i * 0.6}s`, transformOrigin: `${x}px ${y}px` }}>
            <rect x={Number(x) - 22} y={Number(y) - 14} width="44" height="28" rx="8" fill="#fff" />
            <rect x={Number(x) - 14} y={Number(y) - 5} width="28" height="4" rx="2" fill={String(c)} />
            <rect x={Number(x) - 14} y={Number(y) + 3} width="18" height="4" rx="2" fill={String(c)} opacity=".45" />
          </g>
        ))}

        {/* chão */}
        <rect y="222" width="560" height="28" fill="#e8a868" />

        {/* Mendi atrás da mesa */}
        <g transform="translate(212 66)">
          <Capybara pose="estudando" size={138} />
        </g>

        {/* mesa */}
        <rect x="160" y="200" width="250" height="12" rx="5" fill="#ffd7a3" />
        <rect x="172" y="212" width="226" height="30" rx="3" fill="#d99a5b" />
        {/* caderno aberto com folha virando */}
        <path d="M318 200 L352 200 L348 190 L320 190 Z" fill="#fff" />
        <path d="M352 200 L386 200 L382 190 L354 190 Z" fill="#fff" />
        <path className="sc-page" style={{ transformOrigin: '352px 195px' }} d="M352 200 L384 200 L380 190 L354 190 Z" fill="#f1f4ff" />
        {/* caneca com vapor */}
        <rect x="190" y="182" width="20" height="18" rx="4" fill="#fff" />
        <path d="M210 186 q8 0 8 6 q0 6 -8 6" fill="none" stroke="#fff" strokeWidth="3" />
        <path className="st-smoke" d="M200 178 C196 172 204 168 200 160" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="2" strokeLinecap="round" />
        {sparkle(390, 40, 7, 0.4, '#fff')}
        {sparkle(170, 34, 6, 1.1)}
      </g>
    </svg>
  )
}

/* ---------- Semana: calendário de parede com dias sendo marcados ---------- */
export const weekScene = (
  <>
    <path d="M560 190 Q760 138 960 160 T1200 144 V190 Z" fill="#fff" opacity=".12" />
    {/* sol */}
    <g className="sc-spin" style={{ transformOrigin: '900px 48px', animationDuration: '24s' }}>
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x="898" y="16" width="4" height="10" rx="2" fill="#fff6d6" opacity=".8" transform={`rotate(${i * 36} 900 48)`} />
      ))}
    </g>
    <circle cx="900" cy="48" r="16" fill="#ffe27a" />
    {/* calendário */}
    <g transform="translate(668 30)">
      <rect x="4" y="6" width="176" height="144" rx="16" fill="#000" opacity=".1" />
      <rect width="176" height="144" rx="16" fill="#fff" />
      <rect width="176" height="34" rx="16" fill="#ff6b7a" />
      <rect y="18" width="176" height="16" fill="#ff6b7a" />
      {/* folha que vira */}
      <g className="sc-tear" style={{ transformOrigin: '88px 0px' }}>
        <rect width="176" height="34" rx="16" fill="#ff8a96" />
        <rect y="18" width="176" height="16" fill="#ff8a96" />
      </g>
      <rect x="36" y="-8" width="8" height="18" rx="4" fill="#5a3820" />
      <rect x="132" y="-8" width="8" height="18" rx="4" fill="#5a3820" />
      {Array.from({ length: 21 }, (_, i) => {
        const c = i % 7
        const r = Math.floor(i / 7)
        const x = 14 + c * 22
        const y = 46 + r * 30
        const done = [0, 1, 2, 4, 7, 8, 9, 11, 14, 15].indexOf(i)
        return (
          <g key={i}>
            <rect x={x} y={y} width="16" height="22" rx="5" fill={c === 6 ? '#fff1f3' : '#f1f4ff'} />
            {done >= 0 && (
              <path className="sc-pop" style={{ animationDelay: `${done * 0.35}s`, transformOrigin: `${x + 8}px ${y + 11}px`, animationDuration: '6s' }} d={`M${x + 3.5} ${y + 11} l3.5 4 l6 -7`} fill="none" stroke="#21b07a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </g>
        )
      })}
    </g>
    {sparkle(870, 120, 8, 0.4)}
    {sparkle(640, 30, 6, 1.1, '#fff')}
    {sparkle(1170, 60, 7, 0.8)}
  </>
)
