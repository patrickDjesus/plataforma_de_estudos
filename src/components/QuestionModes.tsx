import type { ReactNode } from 'react'
import { ClipboardPlus, History } from 'lucide-react'
import { Capybara, type CapiPose } from './Capybara'
import { playSfx } from '../lib/sfx'

export type ModeId = 'rush' | 'simulado' | 'gerar' | 'escrita'

type Mode = { id: ModeId; title: string; tag: string; from: string; to: string; pose: CapiPose; scene: ReactNode }

/* Cenas: desenhos animados por cima/atrás da Capi (viewBox 0 0 200 160, a Capi fica embaixo à direita). */

const RushScene = (
  <>
    {/* riscos de velocidade */}
    {[
      [30, 0],
      [60, 0.25],
      [95, 0.5],
      [125, 0.15],
    ].map(([y, d]) => (
      <rect key={y} className="qm-speed" style={{ animationDelay: `${d}s` }} x="20" y={y} width="60" height="4" rx="2" fill="#fff" opacity=".7" />
    ))}
    {/* raio piscando */}
    <path className="qm-bolt" d="M150 8 L128 52 L146 52 L134 88 L170 38 L152 38 L164 8 Z" fill="#ffe14d" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
    {/* chamas no chão */}
    {[40, 62, 84].map((x, i) => (
      <path key={x} className="rk-flame" style={{ animationDuration: `${0.6 + i * 0.12}s` }} d={`M${x} 158 C${x - 9} 157 ${x - 10} 146 ${x - 4} 138 C${x - 3} 144 ${x} 145 ${x + 1} 148 C${x + 1} 140 ${x + 5} 134 ${x + 3} 126 C${x + 12} 136 ${x + 13} 150 ${x + 7} 156 Z`} fill="#ffd34d" opacity=".9" />
    ))}
  </>
)

const SimuladoScene = (
  <>
    {/* cronômetro */}
    <g className="qm-tick-shake" style={{ transformOrigin: '52px 62px' }}>
      <rect x="45" y="14" width="14" height="10" rx="3" fill="#fff" />
      <rect x="72" y="26" width="10" height="8" rx="3" fill="#fff" transform="rotate(40 77 30)" />
      <circle cx="52" cy="62" r="38" fill="#fff" />
      <circle cx="52" cy="62" r="31" fill="#eef2ff" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x="51" y="34" width="2" height={i % 3 ? 4 : 7} rx="1" fill="#3e63f2" transform={`rotate(${i * 30} 52 62)`} />
      ))}
      <path className="qm-sweep" d="M52 62 L52 34 A28 28 0 0 1 76.2 48 Z" fill="#3e63f2" opacity=".18" style={{ transformOrigin: '52px 62px' }} />
      <rect className="qm-hand" x="50.5" y="36" width="3" height="28" rx="1.5" fill="#ff5a5f" style={{ transformOrigin: '52px 62px' }} />
      <circle cx="52" cy="62" r="4" fill="#121826" />
    </g>
  </>
)

const GerarScene = (
  <>
    {/* folhas saindo voando */}
    {[0, 0.6, 1.2].map((d, i) => (
      <g key={d} className="qm-paper" style={{ animationDelay: `${d}s` }}>
        <rect x="60" y="80" width="30" height="38" rx="4" fill="#fff" transform={`rotate(${-12 + i * 10} 75 99)`} />
        <path d="M66 90 h18 M66 98 h14 M66 106 h18" stroke="#8b5cf6" strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${-12 + i * 10} 75 99)`} />
      </g>
    ))}
    {/* varinha */}
    <g transform="translate(52 22)">
    <g className="qm-wand" style={{ transformOrigin: '118px 120px' }}>
      <rect x="114" y="62" width="7" height="60" rx="3.5" fill="#121826" transform="rotate(-30 118 92)" />
      <rect x="114" y="62" width="7" height="12" rx="3" fill="#fff" transform="rotate(-30 118 92)" />
    </g>
    </g>
    {/* brilhos */}
    {[
      [92, 30, 0, 9],
      [40, 44, 0.5, 7],
      [130, 20, 1, 6],
      [20, 90, 1.4, 5],
    ].map(([x, y, d, r]) => (
      <path key={`${x}${y}`} className="rk-twinkle" style={{ animationDelay: `${d}s` }} d={`M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z`} fill="#ffe14d" />
    ))}
  </>
)

const EscritaScene = (
  <>
    {/* folha com linhas se escrevendo */}
    <g transform="rotate(-6 60 90)">
      <rect x="14" y="34" width="96" height="116" rx="8" fill="#fff" />
      <rect x="14" y="34" width="96" height="14" rx="7" fill="#d9f7ec" />
      {[62, 78, 94, 110, 126].map((y, i) => (
        <path key={y} className="qm-write" style={{ animationDelay: `${i * 0.55}s` }} d={`M26 ${y} q8 -6 16 0 t16 0 t16 0 t${i === 4 ? 8 : 16} 0`} fill="none" stroke="#0f8a63" strokeWidth="3" strokeLinecap="round" pathLength="100" strokeDasharray="100" />
      ))}
    </g>
    {/* lápis */}
    <g className="qm-pencil">
      <g transform="rotate(35 100 100)">
        <rect x="94" y="56" width="12" height="46" rx="2" fill="#ffc83d" />
        <rect x="94" y="56" width="12" height="8" rx="2" fill="#ff8fa3" />
        <rect x="94" y="62" width="12" height="4" fill="#c9ccd6" />
        <path d="M94 102 L100 116 L106 102 Z" fill="#f3d2a2" />
        <path d="M98 111 L100 116 L102 111 Z" fill="#23263a" />
      </g>
    </g>
  </>
)

const MODES: Mode[] = [
  { id: 'rush', title: 'Rush', tag: 'Questões sem parar. Até errar.', from: '#ff9a3d', to: '#e2401b', pose: 'focado', scene: RushScene },
  { id: 'simulado', title: 'Simulado', tag: 'Prova com tempo, nota no final.', from: '#5b7cff', to: '#2a3fb8', pose: 'pensando', scene: SimuladoScene },
  { id: 'gerar', title: 'Gerar lista', tag: 'Questões sob medida, do seu jeito.', from: '#a77bff', to: '#6233d6', pose: 'acenando', scene: GerarScene },
  { id: 'escrita', title: 'Escrita', tag: 'Escreva, a Capi corrige.', from: '#2fcf9b', to: '#0f8a63', pose: 'estudando', scene: EscritaScene },
]

export function modeInfo(id: string) {
  return MODES.find((m) => m.id === id)
}

/** Tela de escolha de modo das Questões, estilo menu de jogo. */
export function QuestionModes({ onPick, onExtra }: { onPick: (id: ModeId) => void; onExtra: (id: 'registrar' | 'historico') => void }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {MODES.map((m, i) => (
          <button
            key={m.id}
            onClick={() => {
              playSfx('whoosh')
              onPick(m.id)
            }}
            onMouseEnter={() => playSfx('blip')}
            title={m.tag}
            className="qm-card group relative h-[128px] overflow-hidden rounded-[18px] p-4 text-left text-white shadow-[0_16px_30px_-18px_rgba(16,24,40,0.7)] outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
            style={{ background: `linear-gradient(135deg, ${m.from}, ${m.to})`, animationDelay: `${i * 0.08}s` }}
          >
            {/* listras andando no fundo */}
            <span className="qm-stripes pointer-events-none absolute inset-0 opacity-[.12]" />
            {/* brilho que passa no hover */}
            <span className="qm-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />

            {/* cena */}
            <svg viewBox="0 0 200 160" className="essential-motion pointer-events-none absolute right-[38px] top-[2px] h-[80px] w-[100px] overflow-visible opacity-95" aria-hidden>
              {m.scene}
            </svg>
            <div className={`qm-capi pointer-events-none absolute -right-2 -bottom-3 ${m.id === 'rush' ? 'qm-run' : ''}`}>
              <Capybara pose={m.pose} size={92} />
            </div>

            <div className="relative z-10 font-display text-[22px] leading-none font-extrabold drop-shadow-[0_2px_3px_rgba(0,0,0,.18)]">{m.title}</div>
            <span className="absolute bottom-3.5 left-4 z-10 rounded-full bg-white/95 px-3 py-1 text-[11px] font-extrabold tracking-wide uppercase shadow transition group-hover:scale-105" style={{ color: m.to }}>
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
