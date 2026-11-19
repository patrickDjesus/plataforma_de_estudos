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

export function SubjectIcon({ subject, size = 44, color, iconKey }: { subject?: Pick<Subject, 'name' | 'color' | 'icon'>; size?: number; color?: string; iconKey?: string }) {
  const key = iconKey ?? subject?.icon ?? guessIcon(subject?.name ?? '')
  const Icon = (SUBJECT_ICONS[key] ?? SUBJECT_ICONS.cap).icon
  const c = color ?? subject?.color ?? '#c4471d'
  return (
    <span
      className="subject-icon shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        color: c,
        background: `color-mix(in srgb, ${c} 9%, transparent)`,
        border: `1px solid color-mix(in srgb, ${c} 28%, transparent)`,
      }}
    >
      <Icon size={size * 0.48} strokeWidth={1.8} />
    </span>
  )
}
