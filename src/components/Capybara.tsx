import { useEffect, useRef, useState } from 'react'
/**
 * Capi, a capivara mascote do Mendonça.
 * Um único desenho com corpo base + expressões + acessórios, em várias poses.
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
  head: '#c99260',
  body: '#b9804e',
  belly: '#e6bd8f',
  muzzle: '#a06a3f',
  dark: '#7a4e2d',
  earIn: '#5a3820',
  eye: '#2b1a0f',
  blush: '#ff8f7e',
  brand: '#c4471d',
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

function Eye({ x, kind, side, look }: { x: number; kind: Eyes; side: 'l' | 'r'; look: [number, number] }) {
  const y = 60
  const arc = (dy: number) => <path d={`M${x - 7} ${y + 2} Q${x} ${y + dy} ${x + 7} ${y + 2}`} fill="none" stroke={C.eye} strokeWidth="3.6" strokeLinecap="round" />
  if (kind === 'feliz' || (kind === 'piscando' && side === 'l')) return arc(-7)
  if (kind === 'fechado') return arc(5)
  if (kind === 'triste')
    return (
      <g>
        <path d={`M${x - 8} ${y + 3} Q${x} ${y - 5} ${x + 8} ${y + 3}`} fill="none" stroke={C.eye} strokeWidth="3.6" strokeLinecap="round" />
        <path d={side === 'l' ? `M${x - 9} ${y - 10} L${x + 5} ${y - 14}` : `M${x + 9} ${y - 10} L${x - 5} ${y - 14}`} stroke={C.eye} strokeWidth="3" strokeLinecap="round" />
      </g>
    )
  const py = kind === 'cima' ? y - 4 : y
  return (
    <g>
      {kind === 'determinado' && (
        <path d={side === 'l' ? `M${x - 9} ${y - 13} L${x + 7} ${y - 9}` : `M${x + 9} ${y - 13} L${x - 7} ${y - 9}`} stroke={C.eye} strokeWidth="3.4" strokeLinecap="round" />
      )}
      {/* pupila: segue o mouse (look) e pisca (capi-blink) */}
      <g className="capi-blink" style={{ transformOrigin: `${x}px ${py}px` }}>
        <circle cx={x + look[0] * 3.5} cy={py + look[1] * 3} r="6.8" fill={C.eye} />
        <circle cx={x + look[0] * 3.5 + 2.2} cy={py + look[1] * 3 - 2.4} r="2.3" fill="#fff" />
      </g>
    </g>
  )
}

function Mouth({ kind }: { kind: Mouth }) {
  if (kind === 'aberta')
    return (
      <g>
        <path d="M89 109 Q100 126 111 109 Z" fill="#5a2418" />
        <path d="M94 117 Q100 123 106 117 Q100 114 94 117 Z" fill="#ff8a8a" />
      </g>
    )
  if (kind === 'o') return <ellipse cx="100" cy="114" rx="4.5" ry="5" fill="#5a2418" />
  if (kind === 'triste') return <path d="M90 117 Q100 107 110 117" fill="none" stroke={C.eye} strokeWidth="3.2" strokeLinecap="round" />
  if (kind === 'reta') return <path d="M92 112 L108 112" stroke={C.eye} strokeWidth="3" strokeLinecap="round" />
  return <path d="M89 109 Q100 118 111 109" fill="none" stroke={C.eye} strokeWidth="3" strokeLinecap="round" />
}

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
        cur = [cur[0] + (target[0] - cur[0]) * 0.12, cur[1] + (target[1] - cur[1]) * 0.12]
        setLook((old) => (Math.abs(old[0] - cur[0]) + Math.abs(old[1] - cur[1]) > 0.01 ? [cur[0], cur[1]] : old))
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
    <svg ref={ref} width={size} height={size * 1.08} viewBox="0 -14 200 230" className={`capi capi-alive ${className}`} role="img" aria-label={`Capi, a capivara, ${pose}`}>
      <defs>
        <linearGradient id="capi-hat" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5d8f" />
          <stop offset="1" stopColor="#ffb648" />
        </linearGradient>
        <radialGradient id="capi-shine" cx=".35" cy=".25" r=".6">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* sombra */}
      <ellipse cx="100" cy="206" rx="62" ry="7" fill="#0b1026" opacity=".08" />

      {/* extras atrás do corpo */}
      {pose === 'pensando' && (
        <g className="capi-float">
          <circle cx="160" cy="34" r="22" fill="#fff" stroke="#e3e6ee" strokeWidth="2" />
          <circle cx="140" cy="62" r="6" fill="#fff" stroke="#e3e6ee" strokeWidth="2" />
          <circle cx="132" cy="74" r="3.5" fill="#fff" stroke="#e3e6ee" strokeWidth="2" />
          <text x="160" y="44" textAnchor="middle" fontSize="28" fontWeight="800" fill={C.brand} fontFamily="Fraunces, serif">
            ?
          </text>
        </g>
      )}
      {pose === 'comemorando' && (
        <g className="capi-confetti">
          <rect x="22" y="40" width="8" height="4" rx="1" fill="#ffb648" transform="rotate(30 26 42)" />
          <rect x="168" y="58" width="8" height="4" rx="1" fill="#2fd89a" transform="rotate(-20 172 60)" />
          <rect x="30" y="100" width="7" height="4" rx="1" fill="#d2643a" transform="rotate(60 33 102)" />
          <rect x="172" y="110" width="7" height="4" rx="1" fill="#ff5d8f" transform="rotate(15 175 112)" />
          <circle cx="44" cy="20" r="3" fill="#ff5d8f" />
          <circle cx="156" cy="18" r="3" fill="#ffb648" />
          <circle cx="182" cy="84" r="2.5" fill="#d2643a" />
          <circle cx="16" cy="72" r="2.5" fill="#2fd89a" />
        </g>
      )}

      <g className="capi-bob">
        {/* corpo (respira) */}
        <g className="capi-breathe">
          <ellipse cx="100" cy="156" rx="60" ry="46" fill={C.body} />
          <ellipse cx="100" cy="164" rx="36" ry="31" fill={C.belly} />
        </g>
        <ellipse cx="76" cy="199" rx="16" ry="8" fill={C.dark} />
        <ellipse cx="124" cy="199" rx="16" ry="8" fill={C.dark} />

        {/* braço esquerdo */}
        {holdsBook ? (
          <ellipse cx="62" cy="160" rx="10" ry="17" fill={C.dark} transform="rotate(-35 62 160)" />
        ) : (
          <ellipse cx="54" cy="156" rx="10" ry="19" fill={C.dark} transform="rotate(18 54 156)" />
        )}

        {/* livro */}
        {holdsBook && (
          <g>
            <path d="M100 150 L62 144 L62 186 L100 192 Z" fill={C.brand} />
            <path d="M100 150 L138 144 L138 186 L100 192 Z" fill="#2f4fd0" />
            <path d="M100 153 L67 148 L67 182 L100 187 Z" fill="#fff" />
            <path d="M100 153 L133 148 L133 182 L100 187 Z" fill="#fbf5f1" />
            <path d="M74 158 L94 161 M74 166 L94 169 M74 174 L90 176 M106 161 L126 158 M106 169 L126 166" stroke="#c5ccea" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        {/* braço direito */}
        {holdsBook ? (
          <ellipse cx="138" cy="160" rx="10" ry="17" fill={C.dark} transform="rotate(35 138 160)" />
        ) : waving ? (
          <g className="capi-wave">
            <ellipse cx="156" cy="112" rx="10" ry="21" fill={C.dark} transform="rotate(-32 156 112)" />
            <path d="M172 82 Q180 88 178 98 M180 74 Q192 84 188 100" fill="none" stroke={C.dark} strokeWidth="3" strokeLinecap="round" opacity=".45" />
          </g>
        ) : chin ? (
          <ellipse cx="126" cy="132" rx="10" ry="18" fill={C.dark} transform="rotate(-50 126 132)" />
        ) : (
          <ellipse cx="146" cy="156" rx="10" ry="19" fill={C.dark} transform="rotate(-18 146 156)" />
        )}

        {/* cabeça (inclina de leve na direção do olhar) */}
        <g className="capi-head" style={{ transform: `rotate(${(look[0] * 2.5).toFixed(2)}deg)`, transformOrigin: '100px 128px' }}>
          <g className="capi-ear capi-ear-l" style={{ transformOrigin: '60px 44px' }}>
            <ellipse cx="60" cy="36" rx="9" ry="10" fill={C.dark} />
            <ellipse cx="60" cy="37" rx="4" ry="5" fill={C.earIn} />
          </g>
          <g className="capi-ear capi-ear-r" style={{ transformOrigin: '140px 44px' }}>
            <ellipse cx="140" cy="36" rx="9" ry="10" fill={C.dark} />
            <ellipse cx="140" cy="37" rx="4" ry="5" fill={C.earIn} />
          </g>
          <rect x="44" y="28" width="112" height="100" rx="38" fill={C.head} />
          <rect x="44" y="28" width="112" height="100" rx="38" fill="url(#capi-shine)" />
          <path d="M93 30 Q97 21 100 30 Q104 20 108 30" fill="none" stroke={C.dark} strokeWidth="2.5" strokeLinecap="round" />
          <rect x="56" y="70" width="88" height="62" rx="30" fill={C.muzzle} />
          <path d="M78 81 Q100 72 122 81 Q124 92 113 94 L87 94 Q76 92 78 81 Z" fill="#5e3a22" />
          <path d="M85 85 Q89 89 94 86" fill="none" stroke={C.eye} strokeWidth="3" strokeLinecap="round" />
          <path d="M115 85 Q111 89 106 86" fill="none" stroke={C.eye} strokeWidth="3" strokeLinecap="round" />
          <path d="M84 79 Q92 76 98 77" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M100 94 L100 107" stroke="#5e3a22" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="55" cy="80" rx="7" ry="4.5" fill={C.blush} opacity=".5" />
          <ellipse cx="145" cy="80" rx="7" ry="4.5" fill={C.blush} opacity=".5" />
          <Mouth kind={mouth} />
          <Eye x={76} kind={eyes} side="l" look={look} />
          <Eye x={124} kind={eyes} side="r" look={look} />
          {yawn && <ellipse cx="100" cy="116" rx="7" ry="9" fill="#5a2418" />}
        </g>

        {pose === 'chorando' && (
          <g>
            <path className="capi-tear" d="M70 66 Q66 76 70 80 Q74 76 70 66 Z" fill="#7cc4ff" />
            <path className="capi-tear capi-tear-2" d="M130 66 Q126 76 130 80 Q134 76 130 66 Z" fill="#7cc4ff" />
            <ellipse cx="70" cy="64" rx="9" ry="3" fill="#7cc4ff" opacity=".55" />
            <ellipse cx="130" cy="64" rx="9" ry="3" fill="#7cc4ff" opacity=".55" />
          </g>
        )}
        {/* acessórios da cabeça */}
        {pose === 'estudando' && (
          <g>
            <circle cx="76" cy="58" r="13" fill="#fff" fillOpacity=".18" stroke="#23263a" strokeWidth="3.2" />
            <circle cx="124" cy="58" r="13" fill="#fff" fillOpacity=".18" stroke="#23263a" strokeWidth="3.2" />
            <path d="M89 57 Q100 51 111 57" fill="none" stroke="#23263a" strokeWidth="3.2" />
          </g>
        )}
        {pose === 'comemorando' && (
          <g>
            <path d="M100 -6 L82 36 Q100 42 118 36 Z" fill="url(#capi-hat)" />
            <path d="M88 22 L112 22 M85 30 L115 30" stroke="#fff" strokeWidth="3" opacity=".6" />
            <circle cx="100" cy="-7" r="6" fill="#ffd34d" />
          </g>
        )}
        {pose === 'dormindo' && (
          <g>
            <path d="M58 44 Q100 -8 146 44 Q100 30 58 44 Z" fill="#d2643a" />
            <path d="M138 30 Q170 34 172 66" fill="none" stroke="#d2643a" strokeWidth="10" strokeLinecap="round" />
            <circle cx="172" cy="70" r="8" fill="#fff" />
            <path d="M58 44 Q100 30 146 44" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
            <g className="capi-z" fill="#d2643a" fontFamily="Fraunces, serif" fontWeight="800">
              <text x="160" y="10" fontSize="20">
                Z
              </text>
              <text x="178" y="-4" fontSize="14">
                z
              </text>
            </g>
          </g>
        )}
        {pose === 'relaxando' && (
          <g className="capi-float">
            <circle cx="100" cy="15" r="16" fill="#ffa53a" />
            <circle cx="94" cy="9" r="5" fill="#fff" opacity=".35" />
            <ellipse cx="108" cy="-1" rx="8" ry="4" fill="#3fbf6a" transform="rotate(-25 108 -1)" />
          </g>
        )}
        {pose === 'focado' && (
          <g>
            <path d="M46 66 Q46 6 100 6 Q154 6 154 66" fill="none" stroke="#23263a" strokeWidth="8" strokeLinecap="round" />
            <rect x="32" y="50" width="18" height="34" rx="9" fill={C.brand} />
            <rect x="150" y="50" width="18" height="34" rx="9" fill={C.brand} />
            <rect x="36" y="56" width="6" height="22" rx="3" fill="#fff" opacity=".35" />
          </g>
        )}
        {pose === 'formado' && (
          <g>
            <path d="M58 26 L100 9 L142 26 L100 43 Z" fill="#23263a" />
            <path d="M76 30 L76 40 Q100 50 124 40 L124 30 L100 40 Z" fill="#2f3248" />
            <path d="M138 27 L138 50" stroke="#ffd34d" strokeWidth="3" />
            <circle cx="138" cy="53" r="4.5" fill="#ffd34d" />
          </g>
        )}
      </g>
    </svg>
  )
}
