import type { ReactNode } from 'react'
import { ClipboardPlus, History } from 'lucide-react'
import { Capybara, type CapiPose } from './Capybara'
import { playSfx } from '../lib/sfx'

export type ModeId = 'rush' | 'simulado' | 'gerar' | 'codigo'

type Mode = { id: ModeId; title: string; tag: string; about: string; sky: [string, string]; from: string; to: string; ink: string; pose: CapiPose; back: ReactNode; front?: ReactNode }

/*
 * Cada cartão é uma ilustração inteira num SVG só (viewBox 260x520, ancorado embaixo):
 * fundo (cenário) → Mendi → frente (mesa, varinha…). Assim tudo fica alinhado em qualquer tamanho.
 */
const W = 260
const H = 520
/** Céu extra em cima: o cartão é mais alto que largo, e assim nada é cortado nos lados. */
const TOP = -70

const cloud = (x: number, y: number, s = 1, o = 0.85) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff" opacity={o}>
    <ellipse cx="0" cy="0" rx="24" ry="9" />
    <circle cx="-9" cy="-5" r="10" />
    <circle cx="7" cy="-9" r="12" />
  </g>
)
const sparkle = (x: number, y: number, r: number, d: number, fill = '#ffe27a') => (
  <path
    key={`${x}-${y}`}
    className="rk-twinkle"
    style={{ animationDelay: `${d}s` }}
    d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`}
    fill={fill}
  />
)
/** Mesa vista de frente (fica na frente da Mendi, escondendo as perninhas). */
const desk = (top: string, side: string, shade: string) => (
  <g>
    <rect x="34" y="398" width="192" height="13" rx="5" fill={top} />
    <rect x="44" y="411" width="172" height="42" rx="4" fill={side} />
    <rect x="44" y="411" width="172" height="6" fill={shade} opacity=".5" />
    <rect x="56" y="453" width="10" height="26" rx="3" fill={side} />
    <rect x="194" y="453" width="10" height="26" rx="3" fill={side} />
  </g>
)

/* ---------- Rush: pista ao pôr do sol ---------- */
const rushBack = (
  <>
    <defs>
      <linearGradient id="qm-r-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ff9f5a" />
        <stop offset=".6" stopColor="#ffc27a" />
        <stop offset="1" stopColor="#ffd9a0" />
      </linearGradient>
    </defs>
    <rect y={TOP} width={W} height={H - TOP} fill="url(#qm-r-sky)" />
    {/* sol com raios girando */}
    <g className="qm-spin" style={{ transformOrigin: '186px 200px' }}>
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x="183" y="140" width="6" height="20" rx="3" fill="#fff6d6" opacity=".7" transform={`rotate(${i * 30} 186 200)`} />
      ))}
    </g>
    <circle cx="186" cy="200" r="34" fill="#ffe7a3" />
    <circle cx="186" cy="200" r="26" fill="#fff3cc" />
    <g className="qm-drift" style={{ animationDuration: '16s' }}>{cloud(40, 150, 1)}</g>
    <g className="qm-drift" style={{ animationDuration: '26s', animationDelay: '-14s' }}>{cloud(60, 40, 1.2, 0.6)}</g>
    <g className="qm-drift" style={{ animationDuration: '22s', animationDelay: '-8s' }}>{cloud(120, 250, 0.7, 0.7)}</g>
    {/* morros */}
    <path d="M0 330 Q70 290 140 322 T260 306 V380 H0 Z" fill="#ffb07a" />
    <path d="M0 352 Q90 326 170 348 T260 340 V380 H0 Z" fill="#f99566" />
    {/* chão e pista */}
    <rect y="372" width={W} height="148" fill="#f07a4f" />
    <path d="M108 372 L152 372 L250 520 L10 520 Z" fill="#ffb98a" />
    <path d="M108 372 L10 520 M152 372 L250 520" stroke="#fff" strokeWidth="3" opacity=".75" />
    <path className="qm-lane" d="M130 374 L130 520" stroke="#fff" strokeWidth="4" strokeDasharray="12 14" />
    {/* riscos de velocidade */}
    {[
      [292, 0],
      [318, 0.3],
      [344, 0.6],
      [370, 0.15],
    ].map(([y, d]) => (
      <rect key={y} className="qm-speed" style={{ animationDelay: `${d}s` }} x="14" y={y} width="44" height="4" rx="2" fill="#fff" />
    ))}
  </>
)
const rushFront = (
  <>
    <path className="qm-bolt" d="M206 238 L190 270 L203 270 L194 298 L222 258 L208 258 L218 238 Z" fill="#ffe14d" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
    {[
      [86, 440, 0],
      [176, 442, 0.35],
    ].map(([x, y, d]) => (
      <g key={x} className="qm-puff" style={{ animationDelay: `${d}s`, transformOrigin: `${x}px ${y}px` }}>
        <circle cx={x} cy={y} r="9" fill="#fff" opacity=".8" />
        <circle cx={x - 9} cy={y + 3} r="6" fill="#fff" opacity=".7" />
      </g>
    ))}
  </>
)

/* ---------- Simulado: sala de aula ---------- */
const simBack = (
  <>
    <defs>
      <linearGradient id="qm-s-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6f8dff" />
        <stop offset="1" stopColor="#9bb2ff" />
      </linearGradient>
    </defs>
    <rect y={TOP} width={W} height={H - TOP} fill="url(#qm-s-wall)" />
    {/* lousa */}
    <rect x="22" y="116" width="216" height="128" rx="10" fill="#c99260" />
    <rect x="30" y="124" width="200" height="112" rx="6" fill="#24345a" />
    <g fill="#fff" fontFamily="Sora, sans-serif" fontWeight="700">
      <text className="qm-chalk" x="46" y="160" fontSize="17">
        2x + 3 = 11
      </text>
      <text className="qm-chalk" style={{ animationDelay: '.8s' }} x="46" y="192" fontSize="17">
        x = 4
      </text>
    </g>
    <path className="qm-check" d="M112 186 L119 194 L134 176" fill="none" stroke="#7ef0b5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pathLength="30" strokeDasharray="30" />
    <circle cx="196" cy="166" r="16" fill="none" stroke="#ffd34d" strokeWidth="3" opacity=".9" />
    <text x="196" y="172" textAnchor="middle" fill="#ffd34d" fontFamily="Sora, sans-serif" fontWeight="800" fontSize="15">
      A
    </text>
    <rect x="44" y="242" width="172" height="6" rx="3" fill="#a87648" />
    <rect x="70" y="238" width="14" height="5" rx="2" fill="#fff" />
    {/* relógio de parede */}
    <g transform="translate(36 300)">
      <circle r="21" fill="#fff" />
      <circle r="17" fill="#eef2ff" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x="-1" y="-15" width="2" height={i % 3 ? 3 : 5} rx="1" fill="#3e63f2" transform={`rotate(${i * 30})`} />
      ))}
      <rect className="qm-hand" x="-1.2" y="-14" width="2.4" height="14" rx="1.2" fill="#ff5a5f" />
      <rect x="-1.5" y="-10" width="3" height="10" rx="1.5" fill="#121826" transform="rotate(120)" />
      <circle r="2.5" fill="#121826" />
    </g>
    {/* chão */}
    <rect y="372" width={W} height="148" fill="#4a64e0" />
    <path d="M0 400 H260 M0 440 H260 M0 484 H260" stroke="#3d55c9" strokeWidth="2" />
  </>
)
const simFront = (
  <>
    {desk('#ffd7a3', '#e6a964', '#b97a3c')}
    {/* prova em cima da mesa */}
    <path d="M86 399 L136 399 L130 387 L92 387 Z" fill="#fff" />
    <path d="M97 391 H125 M95 395 H118" stroke="#3e63f2" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="146" y="392" width="34" height="4" rx="2" fill="#ffc83d" transform="rotate(-8 163 394)" />
  </>
)

/* ---------- Gerar lista: noite mágica ---------- */
const STARS: [number, number, number][] = [
  [30, 120, 0],
  [84, 170, 0.6],
  [150, 112, 1.1],
  [232, 250, 0.3],
  [24, 260, 1.4],
  [120, 230, 0.9],
  [210, 120, 1.7],
  [60, 320, 0.4],
  [196, 10, 0.2],
  [40, 40, 1.2],
  [228, 60, 0.7],
  [110, 70, 1.6],
]
const magicBack = (
  <>
    <defs>
      <linearGradient id="qm-g-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5a35c9" />
        <stop offset=".6" stopColor="#8a64f2" />
        <stop offset="1" stopColor="#b796ff" />
      </linearGradient>
      <radialGradient id="qm-g-glow">
        <stop offset="0" stopColor="#ffe14d" stopOpacity=".55" />
        <stop offset="1" stopColor="#ffe14d" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect y={TOP} width={W} height={H - TOP} fill="url(#qm-g-sky)" />
    {STARS.map(([x, y, d]) => (
      <circle key={`${x}${y}`} className="qm-blink" style={{ animationDelay: `${d}s` }} cx={x} cy={y} r="2" fill="#fff" />
    ))}
    {/* lua */}
    <circle cx="206" cy="180" r="26" fill="#fff3c4" />
    <circle cx="218" cy="170" r="22" fill="#7c58e8" />
    {/* morros */}
    <path d="M0 360 Q80 318 150 346 T260 334 V400 H0 Z" fill="#7a54de" />
    <rect y="384" width={W} height="136" fill="#6542cf" />
    <path d="M0 384 Q130 368 260 384" fill="#6542cf" />
    {/* círculo mágico no chão */}
    <ellipse cx="130" cy="440" rx="96" ry="26" fill="url(#qm-g-glow)" />
    <ellipse className="qm-dash" cx="130" cy="440" rx="80" ry="17" fill="none" stroke="#ffe14d" strokeWidth="2.5" strokeDasharray="8 9" />
    <ellipse cx="130" cy="440" rx="60" ry="11" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" />
  </>
)
const magicFront = (
  <>
    {/* folhas de questão saindo da varinha */}
    {[0, 0.6, 1.2].map((d, i) => (
      <g key={d} className="qm-paper" style={{ animationDelay: `${d}s` }}>
        <g transform={`translate(${190 + i * 4} 280) rotate(${-14 + i * 12})`}>
          <rect x="-13" y="-17" width="26" height="34" rx="4" fill="#fff" />
          <path d="M-7 -8 h14 M-7 -1 h10 M-7 6 h14" stroke="#7c58e8" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      </g>
    ))}
    <g className="qm-wand" style={{ transformOrigin: '186px 360px' }}>
      <rect x="183" y="300" width="7" height="64" rx="3.5" fill="#2a1d55" transform="rotate(18 186 332)" />
      <rect x="183" y="300" width="7" height="12" rx="3" fill="#fff" transform="rotate(18 186 332)" />
    </g>
    {sparkle(178, 290, 9, 0)}
    {sparkle(222, 312, 6, 0.6)}
    {sparkle(40, 380, 7, 1.1, '#fff')}
    {sparkle(224, 410, 5, 1.5)}
  </>
)

/* ---------- Escrita: cantinho de estudo ---------- */
const BOOKS: [number, number, string][] = [
  [26, 36, '#ff6b7a'],
  [38, 30, '#ffc83d'],
  [50, 40, '#3e63f2'],
  [62, 34, '#8b5cf6'],
]
const writeBack = (
  <>
    <defs>
      <linearGradient id="qm-e-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3fcf9e" />
        <stop offset="1" stopColor="#86e8c4" />
      </linearGradient>
      <clipPath id="qm-e-win">
        <rect x="160" y="128" width="72" height="88" rx="6" />
      </clipPath>
    </defs>
    <rect y={TOP} width={W} height={H - TOP} fill="url(#qm-e-wall)" />
    {/* janela */}
    <rect x="154" y="122" width="84" height="100" rx="10" fill="#fff" />
    <g clipPath="url(#qm-e-win)">
      <rect x="160" y="128" width="72" height="88" fill="#bfe6ff" />
      <circle cx="214" cy="150" r="10" fill="#ffe27a" />
      <g className="qm-drift" style={{ animationDuration: '12s' }}>{cloud(150, 186, 0.6, 1)}</g>
    </g>
    <path d="M196 128 V216 M160 172 H232" stroke="#fff" strokeWidth="5" />
    {/* prateleira com livros */}
    <rect x="18" y="200" width="96" height="7" rx="3" fill="#c99260" />
    {BOOKS.map(([x, h, c]) => (
      <rect key={x} x={x} y={200 - h} width="10" height={h} rx="2" fill={c} />
    ))}
    <rect x="74" y="168" width="10" height="32" rx="2" fill="#fff" transform="rotate(14 79 200)" />
    <path d="M96 200 h14 l-3 -14 h-8 Z" fill="#ff8f6b" />
    <path className="qm-sway" style={{ transformOrigin: '103px 186px' }} d="M103 186 C96 176 96 168 100 162 C104 168 106 176 103 186 C108 178 114 174 118 174 C114 182 108 186 103 186 Z" fill="#169a6c" />
    {/* monitor com código se digitando */}
    <g transform="rotate(-4 52 290)">
      <rect x="10" y="244" width="86" height="66" rx="8" fill="#23263a" />
      <rect x="15" y="249" width="76" height="56" rx="4" fill="#16181d" />
      {[
        [262, '#7cc4ff', 34],
        [272, '#ffd34d', 46],
        [282, '#7ef0b5', 28],
        [292, '#ff8fa3', 40],
      ].map(([y, c, w], i) => (
        <path key={String(y)} className="qm-write" style={{ animationDelay: `${i * 0.55}s` }} d={`M${20 + (i % 2) * 6} ${y} h${w}`} stroke={String(c)} strokeWidth="3.4" strokeLinecap="round" pathLength="100" strokeDasharray="100" />
      ))}
      <rect className="qm-blink" x="72" y="288" width="3" height="8" fill="#fff" />
      <rect x="46" y="310" width="14" height="14" fill="#23263a" />
      <rect x="32" y="322" width="42" height="5" rx="2.5" fill="#23263a" />
    </g>
    {/* chão */}
    <rect y="372" width={W} height="148" fill="#22b07f" />
    <rect y="372" width={W} height="8" fill="#1a9a6e" />
    {/* vaso de planta */}
    <g className="qm-sway" style={{ transformOrigin: '226px 420px', animationDelay: '.6s' }}>
      <path d="M226 420 C210 404 208 388 214 374 C222 388 226 402 226 420 Z" fill="#0f8a63" />
      <path d="M226 420 C240 402 244 388 240 372 C230 386 226 402 226 420 Z" fill="#169a6c" />
      <path d="M226 420 C224 396 228 380 226 362 C232 380 232 400 226 420 Z" fill="#2fcf9b" />
    </g>
    <path d="M210 418 h32 l-4 30 h-24 Z" fill="#ff8f6b" />
  </>
)
const writeFront = (
  <g className="qm-float">
    <rect x="166" y="236" width="56" height="34" rx="12" fill="#fff" />
    <path d="M206 270 l6 10 l2 -10 Z" fill="#fff" />
    <text x="194" y="259" textAnchor="middle" fill="#0f8a63" fontFamily="ui-monospace, monospace" fontWeight="800" fontSize="16">
      {'</>'}
    </text>
  </g>
)

const MODES: Mode[] = [
  { id: 'rush', title: 'Rush', tag: 'Questões sem parar. Até errar.', about: 'Errou? Eu explico na hora e a mesma ideia volta umas questões depois, até você dominar.', sky: ['#e2551b', '#ffb36b'], from: '#ff9a3d', to: '#e2401b', ink: '#e2401b', pose: 'focado', back: rushBack, front: rushFront },
  { id: 'simulado', title: 'Simulado', tag: 'Prova com tempo, nota no final.', about: 'Como prova de verdade: só múltipla escolha, tempo marcado e nada de dica.', sky: ['#3e63f2', '#8aa4ff'], from: '#5b7cff', to: '#2a3fb8', ink: '#2a3fb8', pose: 'pensando', back: simBack, front: simFront },
  { id: 'gerar', title: 'Gerar lista', tag: 'Questões sob medida.', about: 'Escolha a matéria, o tópico e o nível. A lista sai do jeito que você precisa.', sky: ['#4a28b8', '#8a64f2'], from: '#a77bff', to: '#6233d6', ink: '#6233d6', pose: 'acenando', back: magicBack, front: magicFront },
  { id: 'codigo', title: 'Código', tag: 'Lógica, desafios e dúvidas.', about: 'Desafios de lógica, seu código revisado linha por linha e dúvidas de programação.', sky: ['#0f8a63', '#5fdcb0'], from: '#2fcf9b', to: '#0f8a63', ink: '#0f8a63', pose: 'focado', back: writeBack, front: writeFront },
]

export function modeInfo(id: string) {
  return MODES.find((m) => m.id === id)
}

/** Tela de escolha de modo das Questões, estilo menu de jogo: cada cartão é uma ilustração. */
export function QuestionModes({ onPick, onExtra }: { onPick: (id: ModeId) => void; onExtra: (id: 'registrar' | 'historico') => void }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {MODES.map((m, i) => (
          <button
            key={m.id}
            onClick={() => {
              playSfx('whoosh')
              onPick(m.id)
            }}
            onMouseEnter={() => playSfx('blip')}
            className="qm-card group relative flex h-[clamp(440px,calc(100vh-230px),640px)] flex-col justify-start overflow-hidden rounded-[26px] p-5 text-left text-white shadow-[0_18px_34px_-20px_rgba(16,24,40,0.65)] ring-1 ring-black/5 outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <svg viewBox={`0 ${TOP} ${W} ${H - TOP}`} preserveAspectRatio="xMidYMax slice" className="essential-motion pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              {m.back}
              <g transform="translate(52 268)">
                <g className={`qm-capi ${m.id === 'rush' ? 'qm-run' : ''}`}>
                  <Capybara pose={m.pose} size={156} />
                </g>
              </g>
              {m.front}
            </svg>
            {/* brilho que passa no hover */}
            <span className="qm-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent" />

            <div className="relative z-10 font-display text-[28px] leading-none font-extrabold drop-shadow-[0_2px_4px_rgba(0,0,0,.18)]">{m.title}</div>
            <div className="relative z-10 mt-2 text-[13px] leading-snug font-semibold text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,.15)]">{m.tag}</div>

            <span className="absolute inset-x-4 bottom-4 z-10 rounded-2xl bg-white py-2.5 text-center text-[13px] font-extrabold tracking-wide uppercase shadow-[0_8px_16px_-8px_rgba(0,0,0,.4)] transition group-hover:-translate-y-0.5" style={{ color: m.ink }}>
              Jogar ▸
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => onExtra('registrar')} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          <ClipboardPlus size={15} /> Registrar extras
        </button>
        <button onClick={() => onExtra('historico')} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          <History size={15} /> Histórico
        </button>
      </div>
    </div>
  )
}

/* ---------- Cenários das faixas (560×210), animados, com a Mendi de verdade ---------- */
const OWL = (pose: CapiPose, x: number, y: number, cls?: string) => (
  <g transform={`translate(${x} ${y})`}>
    <g className={cls}>
      <Capybara pose={pose} size={150} />
    </g>
  </g>
)
const BANNER_SCENE: Record<ModeId, ReactNode> = {
  rush: (
    <>
      <g className="mb-spin" style={{ transformOrigin: '300px 60px' }}>
        <path d="M300 8v14M300 98v14M248 60h14M338 60h14M263 23l10 10M327 87l10 10M263 97l10-10M327 33l10-10" stroke="#fff6d6" strokeWidth="5" strokeLinecap="round" opacity=".75" />
      </g>
      <circle cx="300" cy="60" r="30" fill="#ffe7a3" />
      <circle cx="300" cy="60" r="22" fill="#fff3cc" />
      <g className="mb-drift"><g fill="#fff" opacity=".85"><ellipse cx="60" cy="40" rx="30" ry="11" /><circle cx="48" cy="33" r="13" /><circle cx="68" cy="29" r="15" /></g></g>
      <g className="mb-drift" style={{ animationDuration: '28s', animationDelay: '-12s' }}><g fill="#fff" opacity=".6"><ellipse cx="40" cy="96" rx="22" ry="8" /><circle cx="32" cy="91" r="9" /><circle cx="46" cy="88" r="11" /></g></g>
      <path d="M0 150 Q120 112 240 140 T560 126 V210 H0Z" fill="#fff" opacity=".16" />
      <path d="M0 176 Q160 154 300 170 T560 162 V210 H0Z" fill="#fff" opacity=".22" />
      <path d="M420 172 L464 172 L542 210 L342 210Z" fill="#fff" opacity=".35" />
      <path className="mb-lane" d="M442 174 L442 210" stroke="#fff" strokeWidth="4" strokeDasharray="9 8" />
      {[[112, 0], [132, 0.3], [152, 0.6]].map(([y, d]) => (
        <rect key={y} className="mb-spd" style={{ animationDelay: `${d}s` }} x="304" y={y} width="46" height="5" rx="2.5" fill="#fff" />
      ))}
      <path className="mb-flash" d="M532 22 L514 58 L528 58 L518 90 L548 46 L534 46 L544 22Z" fill="#ffe14d" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
      {OWL('focado', 366, 36, 'mb-run')}
    </>
  ),
  simulado: (
    <>
      <rect x="150" y="26" width="196" height="118" rx="10" fill="#c99260" />
      <rect x="158" y="34" width="180" height="102" rx="6" fill="#24345a" />
      <path className="mb-chalk" d="M176 66 h20 M204 66 h10 M222 66 h30 M262 66 h10 M280 66 h22" stroke="#fff" strokeWidth="5" strokeLinecap="round" pathLength={100} />
      <path className="mb-chalk" style={{ animationDelay: '.7s' }} d="M176 98 h12 M198 98 h10 M218 98 h14" stroke="#fff" strokeWidth="5" strokeLinecap="round" pathLength={100} />
      <path className="mb-chalk" style={{ animationDelay: '1.4s' }} d="M246 98 l8 8 l16 -18" fill="none" stroke="#7ef0b5" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength={100} />
      <g className="mb-show" style={{ animationDelay: '1.8s' }}>
        <circle cx="312" cy="84" r="15" fill="none" stroke="#ffd34d" strokeWidth="3" />
        <text x="312" y="90" textAnchor="middle" fontFamily="Sora, sans-serif" fontSize="15" fontWeight="800" fill="#ffd34d">A</text>
      </g>
      <rect x="170" y="144" width="156" height="6" rx="3" fill="#a87648" />
      <g transform="translate(520 54)">
        <circle r="24" fill="#fff" />
        <circle r="19" fill="#eef2ff" />
        <path d="M0 -17v4M0 13v4M-17 0h4M13 0h4" stroke="#3e63f2" strokeWidth="2.4" strokeLinecap="round" />
        <g className="mb-hand"><path d="M0 0V-15" stroke="#ff5a5f" strokeWidth="2.4" strokeLinecap="round" /></g>
        <path d="M0 0L7 6" stroke="#121826" strokeWidth="3" strokeLinecap="round" />
        <circle r="2.6" fill="#121826" />
      </g>
      {OWL('pensando', 372, 20)}
      <rect x="356" y="166" width="180" height="12" rx="5" fill="#ffd7a3" />
      <rect x="366" y="178" width="160" height="34" rx="4" fill="#e6a964" />
      <path d="M412 166 L452 166 L448 156 L416 156Z" fill="#fff" />
      <rect x="462" y="158" width="32" height="4" rx="2" fill="#ffc83d" transform="rotate(-8 478 160)" />
    </>
  ),
  gerar: (
    <>
      {[[190, 30, 0, 2.4], [240, 80, 0.5, 2], [330, 22, 1, 2.6], [220, 140, 1.5, 2], [540, 120, 0.8, 2.2], [380, 60, 1.9, 1.8], [300, 130, 1.2, 1.8]].map(([x, y, d, r]) => (
        <circle key={`${x}${y}`} className="mb-tw" style={{ animationDelay: `${d}s` }} cx={x} cy={y} r={r} fill="#fff" />
      ))}
      <circle cx="290" cy="64" r="26" fill="#fff3c4" />
      <circle cx="302" cy="54" r="22" fill="#7656e6" />
      <path d="M0 184 Q200 160 560 176 V210 H0Z" fill="#000" opacity=".12" />
      <ellipse className="mb-glow" cx="446" cy="198" rx="96" ry="14" fill="#ffe14d" opacity=".5" />
      <ellipse className="mb-ring" cx="446" cy="198" rx="84" ry="11" fill="none" stroke="#ffe14d" strokeWidth="2.5" strokeDasharray="8 9" />
      {[0, 0.8, 1.6].map((d, i) => (
        <g key={d} className="mb-paper" style={{ animationDelay: `${d}s` }}>
          <g transform={`translate(${500 + i * 4} 70) rotate(${-14 + i * 12})`}>
            <rect x="-13" y="-17" width="26" height="34" rx="4" fill="#fff" />
            <path d="M-7 -8h14M-7 -1h10M-7 6h14" stroke="#7c58e8" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        </g>
      ))}
      {OWL('acenando', 372, 34)}
      <g className="mb-wand" style={{ transformOrigin: '500px 120px' }}>
        <rect x="497" y="64" width="7" height="58" rx="3.5" fill="#2a1d55" transform="rotate(18 500 93)" />
        <path d="M505 52 l2.6 6 6 2.6 -6 2.6 -2.6 6 -2.6 -6 -6 -2.6 6 -2.6z" fill="#ffe14d" />
      </g>
    </>
  ),
  codigo: (
    <>
      <rect x="186" y="20" width="96" height="90" rx="10" fill="#fff" />
      <rect x="193" y="27" width="82" height="76" rx="6" fill="#bfe6ff" />
      <circle cx="258" cy="46" r="9" fill="#ffe27a" />
      <g className="mb-cloud"><g fill="#fff"><ellipse cx="200" cy="82" rx="16" ry="6" /><circle cx="194" cy="78" r="7" /><circle cx="205" cy="75" r="8" /></g></g>
      <path d="M234 27v76M193 64h82" stroke="#fff" strokeWidth="5" />
      <g transform="translate(272 92)">
        <rect width="120" height="84" rx="10" fill="#23263a" />
        <rect x="7" y="7" width="106" height="70" rx="5" fill="#16181d" />
        {[[22, '#7cc4ff', 46, 16], [36, '#ffd34d', 60, 26], [50, '#7ef0b5', 38, 26], [64, '#ff8fa3', 52, 16]].map(([y, c, w, x], i) => (
          <path key={String(y)} className="mb-type" style={{ animationDelay: `${i * 0.6}s` }} d={`M${x} ${y} h${w}`} stroke={String(c)} strokeWidth="4.5" strokeLinecap="round" pathLength={100} />
        ))}
        <rect className="mb-cur" x="76" y="58" width="4" height="12" fill="#fff" />
        <rect x="52" y="84" width="16" height="16" fill="#23263a" />
        <rect x="36" y="98" width="48" height="6" rx="3" fill="#23263a" />
      </g>
      <g className="mb-sway" style={{ transformOrigin: '540px 196px' }}>
        <path d="M540 196 C524 178 522 162 528 148 C536 162 540 178 540 196Z M540 196 C556 176 560 160 556 146 C546 160 540 178 540 196Z" fill="#0f8a63" />
        <path d="M540 196 C538 172 542 156 540 140 C546 158 546 178 540 196Z" fill="#7ef0b5" />
      </g>
      <path d="M524 194 h32 l-4 18 h-24Z" fill="#ff8f6b" />
      {OWL('estudando', 388, 36)}
      <g className="mb-bub">
        <rect x="490" y="22" width="56" height="32" rx="11" fill="#fff" />
        <path d="M506 54 l-4 9 10 -9Z" fill="#fff" />
        <text x="518" y="44" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="15" fontWeight="800" fill="#0f8a63">{'</>'}</text>
      </g>
    </>
  ),
}

/** Faixa do topo dentro de cada modo: cenário animado com a Mendi. */
export function ModeBanner({ id, onBack, onSwitch }: { id: ModeId; onBack: () => void; onSwitch: (id: ModeId) => void }) {
  const m = MODES.find((x) => x.id === id)!
  return (
    <div className="page-in relative mb-6 min-h-[210px] overflow-hidden rounded-[26px] text-white shadow-[0_18px_34px_-22px_rgba(16,24,40,0.6)]" style={{ background: `linear-gradient(100deg, ${m.sky[0]}, ${m.sky[1]})` }}>
      <svg
        viewBox="0 0 560 210"
        preserveAspectRatio="xMaxYMax meet"
        className="essential-motion pointer-events-none absolute right-0 bottom-0 h-full w-[600px] max-w-[70%]"
        style={{ maskImage: 'linear-gradient(to right, transparent, #000 28%)', WebkitMaskImage: 'linear-gradient(to right, transparent, #000 28%)' }}
        aria-hidden
      >
        {BANNER_SCENE[id]}
      </svg>
      <div className="relative z-10 flex min-h-[210px] max-w-[620px] flex-col justify-between gap-3 p-6">
        <button onClick={onBack} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-2 text-[13px] font-bold backdrop-blur transition hover:bg-white/30">
          ← Modos
        </button>
        <div>
          <h1 className="font-display text-[42px] leading-none font-extrabold drop-shadow-[0_2px_4px_rgba(0,0,0,.15)]">{m.title}</h1>
          <p className="mt-2.5 max-w-md text-[15px] leading-snug font-semibold text-white/90">{m.about}</p>
        </div>
        <nav aria-label="Outros modos" className="flex flex-wrap gap-2">
          {MODES.map((x) =>
            x.id === id ? (
              <span key={x.id} className="rounded-full bg-white px-3.5 py-1.5 text-xs font-extrabold" style={{ color: x.ink }}>
                {x.title}
              </span>
            ) : (
              <button key={x.id} onClick={() => onSwitch(x.id)} className="rounded-full border-[1.5px] border-white/55 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white hover:text-ink">
                {x.title}
              </button>
            ),
          )}
        </nav>
      </div>
    </div>
  )
}
