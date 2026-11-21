import { useEffect, useRef, useState } from 'react'
/**
 * Mendi, a coruja-buraqueira mascote do Mendonça.
 * Um único desenho com corpo base + expressões + acessórios, em várias poses.
 * (O componente segue se chamando Capybara para não mexer no resto do site.)
 */
export type CapiPose =
  | 'acenando' // boas-vindas
  | 'estudando' // óculos e livro
  | 'comemorando' // chapéu de festa e confete
  | 'pensando' // pergunta
  | 'dormindo' // noite
  | 'relaxando' // laranja na cabeça
  | 'focado' // fones de ouvido
  | 'formado' // subiu de nível
  | 'chorando' // foi mal no desafio

export const CAPI_POSES: CapiPose[] = ['acenando', 'estudando', 'comemorando', 'pensando', 'dormindo', 'relaxando', 'focado', 'formado', 'chorando']

const C = {
  body: '#a7713f',
  bodyDark: '#8a5a2f',
  wing: '#7d4f28',
  belly: '#f6e6c8',
  bar: '#d2a46c',
  disc: '#f2d9ae',
  eye: '#2b1a0f',
  iris: '#ffc83d',
  irisRing: '#e09a12',
  beak: '#f6b43c',
  beakDark: '#d98a12',
  leg: '#e9b56a',
  blush: '#ff8f7e',
  brand: '#3e63f2',
}

type Eyes = 'normal' | 'feliz' | 'fechado' | 'cima' | 'determinado' | 'piscando' | 'triste'
type Mouth = 'sorriso' | 'aberta' | 'reta' | 'o' | 'triste'

const POSE: Record<CapiPose, { eyes: Eyes; mouth: Mouth }> = {
  acenando: { eyes: 'feliz', mouth: 'aberta' },
  estudando: { eyes: 'normal', mouth: 'sorriso' },
  comemorando: { eyes: 'feliz', mouth: 'aberta' },
  pensando: { eyes: 'cima', mouth: 'o' },
  dormindo: { eyes: 'fechado', mouth: 'reta' },
  relaxando: { eyes: 'fechado', mouth: 'sorriso' },
  focado: { eyes: 'determinado', mouth: 'reta' },
  formado: { eyes: 'piscando', mouth: 'sorriso' },
  chorando: { eyes: 'triste', mouth: 'triste' },
}


const EY = 80 // altura dos olhos
const EX = [74, 126] as const

/** Olho grande de coruja: íris amarela, pupila que segue o mouse, pálpebras para cada expressão. */
function Eye({ x, kind, side, look }: { x: number; kind: Eyes; side: 'l' | 'r'; look: [number, number] }) {
  const y = EY
  const lidLine = (d: string) => <path d={d} fill="none" stroke={C.eye} strokeWidth="4.4" strokeLinecap="round" />
  if (kind === 'feliz' || (kind === 'piscando' && side === 'l')) return lidLine(`M${x - 14} ${y + 4} Q${x} ${y - 12} ${x + 14} ${y + 4}`)
  if (kind === 'fechado') return lidLine(`M${x - 14} ${y} Q${x} ${y + 10} ${x + 14} ${y}`)
  const py = kind === 'cima' ? -5 : kind === 'triste' ? 4 : 0
  const lx = look[0] * 5
  const ly = look[1] * 4 + py
  return (
    <g>
      <g className="capi-blink" style={{ transformOrigin: `${x}px ${y}px` }}>
        <circle cx={x} cy={y} r="18" fill="#fff" />
        <circle cx={x + lx * 0.4} cy={y + ly * 0.4} r="15" fill={C.iris} stroke={C.irisRing} strokeWidth="2" />
        <circle cx={x + lx} cy={y + ly} r="8.6" fill={C.eye} />
        <circle cx={x + lx + 3.4} cy={y + ly - 3.6} r="3" fill="#fff" />
        <circle cx={x + lx - 3} cy={y + ly + 3.4} r="1.3" fill="#fff" opacity=".8" />
      </g>
      {/* pálpebra de cima: brava (canto de dentro baixo) ou triste (canto de fora baixo) */}
      {(kind === 'determinado' || kind === 'triste') && <Lid x={x} y={y} low={kind === 'determinado' ? (side === 'l' ? 'r' : 'l') : side} />}
    </g>
  )
}

/** Pálpebra recortando o olho na diagonal: o lado "low" desce mais. */
function Lid({ x, y, low }: { x: number; y: number; low: 'l' | 'r' }) {
  const r = 19
  const pt = (deg: number) => [x + r * Math.cos((deg * Math.PI) / 180), y - r * Math.sin((deg * Math.PI) / 180)] as const
  const [a, b] = low === 'l' ? [pt(190), pt(32)] : [pt(148), pt(-10)]
  return (
    <g>
      <path d={`M${a[0]} ${a[1]} A${r} ${r} 0 0 1 ${b[0]} ${b[1]} Z`} fill={C.disc} />
      <path d={`M${a[0]} ${a[1]} L${b[0]} ${b[1]}`} stroke={C.eye} strokeWidth="3.4" strokeLinecap="round" />
    </g>
  )
}

/** Bico: fechado, aberto (falando/comemorando) ou em "o". */
function Beak({ kind }: { kind: Mouth }) {
  if (kind === 'aberta' || kind === 'o') {
    const big = kind === 'aberta'
    return (
      <g>
        <path d={`M100 ${big ? 116 : 112} L${big ? 92 : 94} 104 Q100 ${big ? 109 : 107} ${big ? 108 : 106} 104 Z`} fill="#b8432f" />
        <path d={`M92 104 Q100 ${big ? 120 : 114} 108 104 Q100 ${big ? 110 : 108} 92 104 Z`} fill={C.beakDark} />
        <path d="M89 95 Q100 88 111 95 L100 106 Z" fill={C.beak} />
        <path d="M94 94 Q100 91 104 93" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    )
  }
  return (
    <g>
      <path d="M89 95 Q100 88 111 95 Q106 104 100 112 Q94 104 89 95 Z" fill={C.beak} />
      <path d="M100 112 Q105 104 111 95 Q106 101 100 103 Z" fill={C.beakDark} opacity=".6" />
      <path d="M94 94 Q100 91 104 93" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="1.6" strokeLinecap="round" />
      {kind === 'triste' && <path d="M92 118 Q100 113 108 118" fill="none" stroke={C.eye} strokeWidth="2.6" strokeLinecap="round" />}
      {kind === 'sorriso' && <path d="M86 112 Q100 122 114 112" fill="none" stroke={C.bodyDark} strokeWidth="2.4" strokeLinecap="round" opacity=".55" />}
    </g>
  )
}

/** Asa com penas em degraus e pintinhas brancas (marca da buraqueira). */
function Wing({ d, dots }: { d: string; dots: [number, number][] }) {
  return (
    <g>
      <path d={d} fill={C.wing} />
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" fill="#fff" opacity=".75" />
      ))}
    </g>
  )
}
const WING_L = 'M58 112 Q30 128 34 166 Q38 182 50 180 Q46 172 50 166 Q44 160 52 154 Q48 146 56 140 Q56 124 58 112 Z'
const WING_R = 'M142 112 Q170 128 166 166 Q162 182 150 180 Q154 172 150 166 Q156 160 148 154 Q152 146 144 140 Q144 124 142 112 Z'
const DOTS_L: [number, number][] = [[46, 134], [42, 150], [50, 124]]
const DOTS_R: [number, number][] = [[154, 134], [158, 150], [150, 124]]
// ---------- Vida: olhos seguem o mouse, bocejo quando você fica parado ----------
let pointer: [number, number] | null = null
let lastMove = 0
if (typeof window !== 'undefined') {
  addEventListener(
    'pointermove',
    (e) => {
      pointer = [e.clientX, e.clientY]
      lastMove = performance.now()
    },
    { passive: true },
  )
  addEventListener('keydown', () => (lastMove = performance.now()), { passive: true })
}
const reduce = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function useAlive(ref: React.RefObject<SVGSVGElement | null>, enabled: boolean) {
  const [look, setLook] = useState<[number, number]>([0, 0])
  const [yawn, setYawn] = useState(false)
  useEffect(() => {
    if (!enabled || reduce()) return
    let raf = 0
    let cur: [number, number] = [0, 0]
    let wander: [number, number] = [0, 0]
    let nextWander = 0
    let yawning = false
    const tick = (now: number) => {
      const el = ref.current
      if (el) {
        const r = el.getBoundingClientRect()
        let target: [number, number]
        if (pointer && now - lastMove < 6000 && r.width) {
          const cx = r.left + r.width / 2
          const cy = r.top + r.height * 0.4
          const dx = pointer[0] - cx
          const dy = pointer[1] - cy
          const d = Math.hypot(dx, dy) || 1
          const m = Math.min(1, d / 220)
          target = [(dx / d) * m, (dy / d) * m]
        } else {
          if (now > nextWander) {
            nextWander = now + 1500 + Math.random() * 3000
            wander = Math.random() < 0.35 ? [0, 0] : [(Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.2]
          }
          target = wander
        }
        cur = [cur[0] + (target[0] - cur[0]) * 0.075, cur[1] + (target[1] - cur[1]) * 0.075]
        setLook((old) => (Math.abs(old[0] - cur[0]) + Math.abs(old[1] - cur[1]) > 0.004 ? [cur[0], cur[1]] : old))
        // bocejo: parado há mais de 40 s (uma vez a cada 40 s)
        const idle = now - lastMove > 40000 && lastMove > 0
        if (idle && !yawning && Math.random() < 0.004) {
          yawning = true
          setYawn(true)
          window.setTimeout(() => {
            yawning = false
            setYawn(false)
          }, 1800)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled, ref])
  return { look, yawn }
}


export function Capybara({ pose = 'acenando', size = 120, className = '', alive = true }: { pose?: CapiPose; size?: number; className?: string; alive?: boolean }) {
  const p = POSE[pose]
  const holdsBook = pose === 'estudando'
  const waving = pose === 'acenando' || pose === 'comemorando' || pose === 'formado'
  const chin = pose === 'pensando'
  const ref = useRef<SVGSVGElement>(null)
  const { look, yawn } = useAlive(ref, alive && pose !== 'dormindo')
  const eyes: Eyes = yawn ? 'fechado' : p.eyes
  const mouth: Mouth = yawn ? 'aberta' : p.mouth

  return (
    <svg ref={ref} width={size} height={size * 1.08} viewBox="0 -14 200 230" className={`capi capi-alive ${className}`} role="img" aria-label={`Mendi, a coruja, ${pose}`}>
      <defs>
        <linearGradient id="capi-hat" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5d8f" />
          <stop offset="1" stopColor="#ffb648" />
        </linearGradient>
        <radialGradient id="owl-shine" cx=".35" cy=".22" r=".65">
          <stop offset="0" stopColor="#fff" stopOpacity=".3" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="owl-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b47c47" />
          <stop offset="1" stopColor="#94602f" />
        </linearGradient>
      </defs>

      {/* sombra */}
      <ellipse cx="100" cy="206" rx="58" ry="7" fill="#0b1026" opacity=".09" />

      {/* extras atrás do corpo */}
      {pose === 'pensando' && (
        <g className="capi-float">
          <circle cx="172" cy="22" r="22" fill="#fff" stroke="#e3e6ee" strokeWidth="2" />
          <circle cx="154" cy="50" r="6" fill="#fff" stroke="#e3e6ee" strokeWidth="2" />
          <circle cx="146" cy="62" r="3.5" fill="#fff" stroke="#e3e6ee" strokeWidth="2" />
          <text x="172" y="32" textAnchor="middle" fontSize="28" fontWeight="800" fill={C.brand} fontFamily="Sora, sans-serif">
            ?
          </text>
        </g>
      )}
      {pose === 'comemorando' && (
        <g className="capi-confetti">
          <rect x="18" y="40" width="8" height="4" rx="1" fill="#ffb648" transform="rotate(30 22 42)" />
          <rect x="174" y="58" width="8" height="4" rx="1" fill="#2fd89a" transform="rotate(-20 178 60)" />
          <rect x="20" y="104" width="7" height="4" rx="1" fill="#5b7cff" transform="rotate(60 23 106)" />
          <rect x="180" y="112" width="7" height="4" rx="1" fill="#ff5d8f" transform="rotate(15 183 114)" />
          <circle cx="40" cy="14" r="3" fill="#ff5d8f" />
          <circle cx="160" cy="6" r="3" fill="#ffb648" />
          <circle cx="188" cy="84" r="2.5" fill="#5b7cff" />
          <circle cx="12" cy="72" r="2.5" fill="#2fd89a" />
        </g>
      )}
      {pose === 'relaxando' && (
        <g className="capi-z" fill="#8b5cf6">
          <path d="M162 40 v-18 l10 -3 v16" fill="none" stroke="#8b5cf6" strokeWidth="2.6" strokeLinecap="round" />
          <ellipse cx="159" cy="40" rx="4.4" ry="3.4" />
          <ellipse cx="169" cy="35" rx="4.4" ry="3.4" />
        </g>
      )}

      <g className="capi-bob">
        <g className="owl-sway">
        {/* pernas compridas (marca da buraqueira) */}
        <g stroke={C.leg} strokeWidth="6" strokeLinecap="round" fill="none">
          <path d="M84 184 V198 M78 201 L84 197 L90 201 M84 197 V202" />
          <path d="M116 184 V198 M110 201 L116 197 L122 201 M116 197 V202" />
        </g>

        {/* corpo (respira) */}
        <g className="capi-breathe">
          <ellipse cx="100" cy="146" rx="56" ry="46" fill="url(#owl-body)" />
          <ellipse cx="100" cy="154" rx="36" ry="34" fill={C.belly} />
          {/* listrinhas do peito */}
          <g fill="none" stroke={C.bar} strokeWidth="2.6" strokeLinecap="round">
            {[
              [86, 138],
              [104, 136],
              [78, 152],
              [96, 152],
              [114, 150],
              [86, 166],
              [104, 166],
              [95, 178],
            ].map(([x, y]) => (
              <path key={`${x}${y}`} d={`M${x - 5} ${y} Q${x} ${y + 4} ${x + 5} ${y}`} />
            ))}
          </g>
          <ellipse cx="100" cy="146" rx="56" ry="46" fill="url(#owl-shine)" />
        </g>

        {/* asa esquerda */}
        {holdsBook ? (
          <Wing d="M56 118 Q36 140 52 170 Q62 178 70 170 Q60 158 64 150 Q58 140 62 124 Z" dots={[[50, 140], [54, 156]]} />
        ) : (
          <g className="owl-wing-l">
            <Wing d={WING_L} dots={DOTS_L} />
          </g>
        )}

        {/* livro */}
        {holdsBook && (
          <g>
            <path d="M100 148 L60 142 L60 184 L100 190 Z" fill={C.brand} />
            <path d="M100 148 L140 142 L140 184 L100 190 Z" fill="#2f4fd0" />
            <path d="M100 151 L65 146 L65 180 L100 185 Z" fill="#fff" />
            <path d="M100 151 L135 146 L135 180 L100 185 Z" fill="#f3f5ff" />
            <path d="M72 156 L92 159 M72 164 L92 167 M72 172 L88 174 M108 159 L128 156 M108 167 L128 164" stroke="#c5ccea" strokeWidth="2" strokeLinecap="round" />
            {/* pontas das asas segurando */}
            <path d="M54 160 Q62 158 68 166 Q62 176 52 172 Z" fill={C.wing} />
            <path d="M146 160 Q138 158 132 166 Q138 176 148 172 Z" fill={C.wing} />
          </g>
        )}

        {/* asa direita */}
        {holdsBook ? (
          <Wing d="M144 118 Q164 140 148 170 Q138 178 130 170 Q140 158 136 150 Q142 140 138 124 Z" dots={[[150, 140], [146, 156]]} />
        ) : waving ? (
          <g className="capi-wave">
            <Wing d="M136 110 Q154 104 164 84 Q170 66 178 54 Q190 54 190 66 Q198 72 192 82 Q198 90 188 96 Q176 120 148 132 Z" dots={[[176, 72], [170, 88], [160, 104]]} />
            <path d="M190 40 Q198 48 196 58 M182 30 Q194 38 196 26" fill="none" stroke={C.wing} strokeWidth="3" strokeLinecap="round" opacity=".4" />
          </g>
        ) : chin ? (
          <Wing d="M142 114 Q160 134 140 142 Q126 140 114 118 Q112 108 120 110 Q130 124 142 114 Z" dots={[[138, 132], [126, 124]]} />
        ) : (
          <g className="owl-wing-r">
            <Wing d={WING_R} dots={DOTS_R} />
          </g>
        )}

        {/* cabeça (inclina de leve na direção do olhar) */}
        <g className="capi-head" style={{ transform: `rotate(${(look[0] * 5).toFixed(2)}deg) translateX(${(look[0] * 1.5).toFixed(2)}px)`, transformOrigin: '100px 126px' }}>
          <g className="owl-tilt">
          {/* topetinho */}
          <g className="capi-ear capi-ear-l" style={{ transformOrigin: '100px 30px' }}>
            <path d="M88 34 Q86 16 96 24 Q98 10 106 22 Q114 14 112 34 Z" fill={C.bodyDark} />
          </g>
          <ellipse cx="100" cy="80" rx="64" ry="54" fill="url(#owl-body)" />
          {/* pintinhas brancas no alto da cabeça */}
          {[
            [70, 44],
            [84, 36],
            [100, 33],
            [116, 36],
            [130, 44],
            [58, 56],
            [142, 56],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="2.4" fill="#fff" opacity=".7" />
          ))}
          {/* disco facial */}
          <circle cx={EX[0]} cy={EY + 2} r="27" fill={C.disc} />
          <circle cx={EX[1]} cy={EY + 2} r="27" fill={C.disc} />
          <ellipse cx="100" cy="98" rx="20" ry="16" fill={C.disc} />
          {/* sobrancelhas brancas em V (marca da buraqueira) */}
          <path d="M44 62 Q70 46 96 70" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <path d="M156 62 Q130 46 104 70" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          {/* "colar" branco no queixo */}
          <path d="M78 120 Q100 132 122 120 Q112 128 100 129 Q88 128 78 120 Z" fill="#fff" opacity=".9" />
          <ellipse cx="100" cy="80" rx="64" ry="54" fill="url(#owl-shine)" />
          <ellipse cx="52" cy="104" rx="8" ry="4.5" fill={C.blush} opacity=".55" />
          <ellipse cx="148" cy="104" rx="8" ry="4.5" fill={C.blush} opacity=".55" />
          <Eye x={EX[0]} kind={eyes} side="l" look={look} />
          <Eye x={EX[1]} kind={eyes} side="r" look={look} />
          <Beak kind={mouth} />
          </g>
        </g>

        {pose === 'chorando' && (
          <g>
            <path className="capi-tear" d="M66 96 Q62 106 66 110 Q70 106 66 96 Z" fill="#7cc4ff" />
            <path className="capi-tear capi-tear-2" d="M134 96 Q130 106 134 110 Q138 106 134 96 Z" fill="#7cc4ff" />
          </g>
        )}
        {/* acessórios da cabeça */}
        {pose === 'estudando' && (
          <g>
            <circle cx={EX[0]} cy={EY} r="21" fill="#fff" fillOpacity=".14" stroke="#23263a" strokeWidth="3.6" />
            <circle cx={EX[1]} cy={EY} r="21" fill="#fff" fillOpacity=".14" stroke="#23263a" strokeWidth="3.6" />
            <path d="M95 78 Q100 73 105 78" fill="none" stroke="#23263a" strokeWidth="3.6" />
            <path d="M53 76 L40 70 M147 76 L160 70" stroke="#23263a" strokeWidth="3.2" strokeLinecap="round" />
          </g>
        )}
        {pose === 'comemorando' && (
          <g>
            <path d="M100 -10 L82 30 Q100 37 118 30 Z" fill="url(#capi-hat)" />
            <path d="M88 16 L112 16 M85 24 L115 24" stroke="#fff" strokeWidth="3" opacity=".6" />
            <circle cx="100" cy="-11" r="6" fill="#ffd34d" />
          </g>
        )}
        {pose === 'dormindo' && (
          <g>
            <path d="M52 46 Q100 -6 150 46 Q100 32 52 46 Z" fill="#5b7cff" />
            <path d="M142 32 Q174 36 176 68" fill="none" stroke="#5b7cff" strokeWidth="10" strokeLinecap="round" />
            <circle cx="176" cy="72" r="8" fill="#fff" />
            <path d="M52 46 Q100 32 150 46" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
            <g className="capi-z" fill="#5b7cff" fontFamily="Sora, sans-serif" fontWeight="800">
              <text x="164" y="10" fontSize="20">
                Z
              </text>
              <text x="182" y="-4" fontSize="14">
                z
              </text>
            </g>
          </g>
        )}
        {pose === 'focado' && (
          <g>
            <path d="M38 84 Q36 16 100 14 Q164 16 162 84" fill="none" stroke="#23263a" strokeWidth="8" strokeLinecap="round" />
            <rect x="24" y="66" width="20" height="38" rx="10" fill={C.brand} />
            <rect x="156" y="66" width="20" height="38" rx="10" fill={C.brand} />
            <rect x="28" y="72" width="6" height="24" rx="3" fill="#fff" opacity=".35" />
          </g>
        )}
        {pose === 'formado' && (
          <g>
            <path d="M56 26 L100 8 L144 26 L100 44 Z" fill="#23263a" />
            <path d="M74 31 L74 41 Q100 51 126 41 L126 31 L100 41 Z" fill="#2f3248" />
            <path d="M140 27 L140 52" stroke="#ffd34d" strokeWidth="3" />
            <circle cx="140" cy="55" r="4.5" fill="#ffd34d" />
          </g>
        )}
        </g>
      </g>
    </svg>
  )
}
