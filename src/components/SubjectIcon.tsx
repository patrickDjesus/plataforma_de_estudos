import {
  Atom,
  BookOpen,
  Brain,
  Calculator,
  Code2,
  Dna,
  FlaskConical,
  Globe2,
  GraduationCap,
  Landmark,
  Languages,
  Leaf,
  Music,
  Palette,
  PenTool,
  Scale,
  Sigma,
  Stethoscope,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { useId, type ReactNode } from 'react'
import type { Subject } from '../db/types'

export const SUBJECT_ICONS: Record<string, { icon: LucideIcon; label: string; keywords: string[] }> = {
  sigma: { icon: Sigma, label: 'Matemática', keywords: ['calc', 'cálc', 'matem', 'algebra', 'álgebra', 'estat', 'geometr', 'limite'] },
  calculator: { icon: Calculator, label: 'Contas', keywords: ['contab', 'financ', 'aritm'] },
  atom: { icon: Atom, label: 'Física', keywords: ['fís', 'fis', 'mecân', 'eletro', 'ótica'] },
  flask: { icon: FlaskConical, label: 'Química', keywords: ['quím', 'quim'] },
  dna: { icon: Dna, label: 'Biologia', keywords: ['bio', 'genét', 'anatom'] },
  leaf: { icon: Leaf, label: 'Ecologia', keywords: ['ecolog', 'ambient', 'botân'] },
  landmark: { icon: Landmark, label: 'História', keywords: ['hist', 'socio', 'filos'] },
  globe: { icon: Globe2, label: 'Geografia', keywords: ['geog', 'atual'] },
  languages: { icon: Languages, label: 'Idiomas', keywords: ['ingl', 'engl', 'espan', 'franc', 'alem', 'idioma', 'japon', 'ital'] },
  book: { icon: BookOpen, label: 'Leitura', keywords: ['portug', 'liter', 'gramát', 'redaç', 'leitura'] },
  pen: { icon: PenTool, label: 'Escrita', keywords: ['escrita', 'design', 'desenho'] },
  code: { icon: Code2, label: 'Programação', keywords: ['algorit', 'progra', 'código', 'software', 'dados', 'comput', 'web', 'estrutura'] },
  brain: { icon: Brain, label: 'Psicologia', keywords: ['psico', 'neuro', 'lógica'] },
  scale: { icon: Scale, label: 'Direito', keywords: ['direit', 'lei', 'jurid'] },
  stethoscope: { icon: Stethoscope, label: 'Saúde', keywords: ['medic', 'saúde', 'enferm', 'fisiol'] },
  trending: { icon: TrendingUp, label: 'Economia', keywords: ['econ', 'admin', 'market', 'negóc'] },
  palette: { icon: Palette, label: 'Artes', keywords: ['arte', 'pintur'] },
  music: { icon: Music, label: 'Música', keywords: ['músic', 'music'] },
  cap: { icon: GraduationCap, label: 'Geral', keywords: [] },
}

/** Escolhe um ícone pelo nome da matéria quando o usuário não escolheu. */
export function guessIcon(name: string): string {
  const n = name.toLowerCase()
  for (const [key, def] of Object.entries(SUBJECT_ICONS)) if (def.keywords.some((k) => n.includes(k))) return key
  return 'cap'
}

/**
 * Desenhos próprios (estilo "selo" com volume) para os ícones mais comuns.
 * Coordenadas num quadro 48×48; `c` é a cor da matéria, usada nos detalhes.
 */
const ART: Record<string, (c: string) => ReactNode> = {
  sigma: (c) => (
    <>
      <rect x="15" y="9.5" width="18" height="25.5" rx="4" fill="#fff" />
      <rect x="18" y="12.5" width="12" height="6.5" rx="1.8" fill="#2b1a22" />
      <path d="M25.5 15.8h2.6" stroke="#7ef0b5" strokeWidth="1.7" strokeLinecap="round" />
      {[19.6, 24, 28.4].map((x) => [24, 29.6].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.9" fill={x === 28.4 && y === 24 ? '#ffc83d' : c} />))}
    </>
  ),
  atom: () => (
    <>
      <g fill="none" stroke="#fff" strokeWidth="2.4">
        <ellipse cx="24" cy="22.5" rx="12.5" ry="4.8" />
        <ellipse cx="24" cy="22.5" rx="12.5" ry="4.8" transform="rotate(60 24 22.5)" />
        <ellipse cx="24" cy="22.5" rx="12.5" ry="4.8" transform="rotate(-60 24 22.5)" />
      </g>
      <circle cx="24" cy="22.5" r="3.8" fill="#ffd34d" />
      <circle cx="22.9" cy="21.4" r="1.2" fill="#fff" />
      <circle cx="36.3" cy="22.5" r="1.9" fill="#fff" />
    </>
  ),
  flask: () => (
    <>
      <rect x="19" y="8" width="10" height="3" rx="1.5" fill="#fff" />
      <path d="M20.5 10.5h7v8l6.7 11.2a3 3 0 0 1-2.6 4.5H16.4a3 3 0 0 1-2.6-4.5L20.5 18.5z" fill="#fff" />
      <path d="M17.2 25.5h13.6l3.4 4.2a3 3 0 0 1-2.6 4.5H16.4a3 3 0 0 1-2.6-4.5z" fill="#3fbf6a" />
      <circle cx="20.5" cy="30" r="1.5" fill="#fff" opacity=".85" />
      <circle cx="26" cy="28.4" r="1.1" fill="#fff" opacity=".85" />
      <circle cx="30.5" cy="6.5" r="1.6" fill="#fff" opacity=".8" />
    </>
  ),
  dna: (c) => (
    <>
      <path d="M18 9c0 7 12 8 12 14.5S18 31 18 38" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 9c0 7-12 8-12 14.5S30 31 30 38" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".75" />
      <path d="M20 13h8M22.5 18h3M22.5 29h3M20 34h8" stroke="#ffd34d" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="23.5" r="2" fill={c} stroke="#fff" strokeWidth="1.4" />
    </>
  ),
  leaf: (c) => (
    <>
      <path d="M13 35c0-13.5 8-22.5 23-22.5 0 14.5-9 22.5-23 22.5z" fill="#fff" />
      <path d="M14.5 33.5l13.5-13.5M19.5 28.5h6M23.5 24.5v-5.5M24.5 23.5h5" stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M35 28c1.6 2 2.4 3.4 2.4 4.6a2.4 2.4 0 0 1-4.8 0c0-1.2.8-2.6 2.4-4.6z" fill="#bfe6ff" />
    </>
  ),
  globe: () => (
    <>
      <circle cx="24" cy="22.5" r="12.5" fill="#bfe6ff" />
      <path d="M14.4 19.5c2.6-2 5.6-2 7.1 0s0 4 1.5 5.5-1 4.5-3.5 5.5c-3-1.5-5.6-5-5.1-11z" fill="#3fbf6a" />
      <path d="M26 11.5c3 .3 6.6 2.5 8.1 5.6-2 1-4 0-5.5 1.5s0 3.5 2 4.5c-1 2.5-3 4.6-5 5.6-1-2.5.5-5-1.5-6.6s-2.5-4-.5-6 2-3 2.4-4.6z" fill="#3fbf6a" />
      <circle cx="24" cy="22.5" r="12.5" fill="none" stroke="#fff" strokeWidth="2.4" />
      <ellipse cx="19" cy="16.5" rx="4" ry="2" fill="#fff" opacity=".55" />
    </>
  ),
  landmark: (c) => (
    <>
      <path d="M11 18L24 9.5 37 18z" fill="#fff" />
      <circle cx="24" cy="14.6" r="1.7" fill={c} />
      <rect x="12" y="18.6" width="24" height="3.2" rx="1" fill="#fff" />
      {[14, 20.2, 26.4, 30.6].map((x) => (
        <rect key={x} x={x} y="22.6" width="3.4" height="9" rx="1" fill="#fff" />
      ))}
      <rect x="11" y="32" width="26" height="4" rx="1.4" fill="#fff" />
    </>
  ),
  languages: (c) => (
    <>
      <path d="M14 10.5h20a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5h-9l-6.5 5.5 1-5.5H14a5 5 0 0 1-5-5v-9a5 5 0 0 1 5-5z" fill="#fff" />
      <path d="M17.5 15v9.5M17.5 19.8h5.2M22.7 15v9.5M27.6 19.5v5" stroke={c} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="27.6" cy="15.8" r="1.6" fill={c} />
      <path d="M32.5 16.5l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" fill="#ffd34d" />
    </>
  ),
  book: (c) => (
    <>
      <path d="M24 14c-3-2.4-7-3.4-12-3v21c5-.4 9 .6 12 3z" fill="#fff" />
      <path d="M24 14c3-2.4 7-3.4 12-3v21c-5-.4-9 .6-12 3z" fill="#f3f4f8" />
      <path d="M15 16.5c2.6-.2 4.8.3 6.5 1.3M15 21c2.6-.2 4.8.3 6.5 1.3M27 17.8c1.7-1 3.9-1.5 6.5-1.3M27 22.3c1.7-1 3.9-1.5 6.5-1.3" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M31 9v8l2-1.6 2 1.6V9" fill="#ff5a6a" />
    </>
  ),
  brain: (c) => (
    <>
      <path d="M24 12.5c-1.7-2.4-6-2.6-7.4.3-2.8-.2-4.6 2.4-3.8 5-2.4 1.4-2.4 5 0 6.4-1 3 1.2 5.8 4.2 5.4 1.2 2.8 5.4 3 7 .6 1.6 2.4 5.8 2.2 7-.6 3 .4 5.2-2.4 4.2-5.4 2.4-1.4 2.4-5 0-6.4.8-2.6-1-5.2-3.8-5-1.4-2.9-5.7-2.7-7.4-.3z" fill="#fff" />
      <path d="M24 13v18.5M18.5 17.5c1.6.6 2.4 2 2.2 3.6M17 24.5c1.8-.4 3.4.4 4 2M29.5 17.5c-1.6.6-2.4 2-2.2 3.6M31 24.5c-1.8-.4-3.4.4-4 2" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M36 9.5l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" fill="#ffd34d" />
    </>
  ),
  scale: (c) => (
    <>
      <path d="M24 9v24M16 34h16M13 15h22" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="24" cy="11" r="2.4" fill="#ffd34d" />
      <path d="M13 15l-4.5 9h9zM35 15l-4.5 9h9z" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 24a4.5 3 0 0 0 9 0zM30.5 24a4.5 3 0 0 0 9 0z" fill="#fff" />
      <rect x="18" y="33" width="12" height="3.5" rx="1.5" fill={c} stroke="#fff" strokeWidth="1.4" />
    </>
  ),
  code: () => (
    <>
      <rect x="10" y="11" width="28" height="23" rx="5" fill="#16181d" />
      <rect x="10" y="11" width="28" height="6" rx="3" fill="#262a36" />
      <circle cx="14" cy="14" r="1.1" fill="#ff5f57" />
      <circle cx="17.4" cy="14" r="1.1" fill="#febc2e" />
      <circle cx="20.8" cy="14" r="1.1" fill="#28c840" />
      <path d="M19 22l-3 3 3 3M29 22l3 3-3 3M25.5 20.5l-3 9" fill="none" stroke="#7ef0b5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
}
ART.calculator = ART.sigma

/** Ícone da matéria: selo com volume (sombra, brilho) e um desenho próprio quando existe. */
export function SubjectIcon({ subject, size = 44, color, iconKey }: { subject?: Pick<Subject, 'name' | 'color' | 'icon'>; size?: number; color?: string; iconKey?: string }) {
  const id = useId().replace(/:/g, '')
  const key = iconKey ?? subject?.icon ?? guessIcon(subject?.name ?? '')
  const Icon = (SUBJECT_ICONS[key] ?? SUBJECT_ICONS.cap).icon
  const c = color ?? subject?.color ?? '#3e63f2'
  const art = ART[key]
  const small = size < 30
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className="shrink-0" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`si-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${c} 82%, #fff)` }} />
          <stop offset="1" style={{ stopColor: c }} />
        </linearGradient>
      </defs>
      <rect x="2" y="5" width="44" height="41" rx="13" style={{ fill: `color-mix(in srgb, ${c} 62%, #000)` }} />
      <rect x="2" y="2" width="44" height="41" rx="13" fill={`url(#si-${id})`} />
      {!small && <ellipse cx="15" cy="8.5" rx="9" ry="3.2" fill="#fff" opacity=".28" />}
      {!small && <ellipse cx="24" cy="37" rx="11" ry="2.2" fill="#000" opacity=".14" />}
      {art ? (
        art(c)
      ) : (
        <foreignObject x="10" y="8.5" width="28" height="28">
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#fff' }}>
            <Icon size={22} strokeWidth={2.4} />
          </div>
        </foreignObject>
      )}
    </svg>
  )
}
