import type { ReactNode } from 'react'
import { Award, Crown, Gem, Medal, Shield, Star, Trophy, type LucideIcon } from 'lucide-react'
import { TIERS, divisionOf, tierOf } from '../lib/rank'

/* Arte dos ranks no mesmo estilo dos ícones de matéria: quadradinho arredondado
 * com a cor do rank e um ícone branco simples. A divisão (III, II, I) fica num selo no canto. */

type TierId = (typeof TIERS)[number]['id']

const LOOK: Record<TierId, { color: string; icon: LucideIcon }> = {
  ferro: { color: '#7b8290', icon: Shield },
  bronze: { color: '#c0703a', icon: Medal },
  prata: { color: '#94a3b8', icon: Award },
  ouro: { color: '#e0a21a', icon: Trophy },
  platina: { color: '#14b8a6', icon: Star },
  diamante: { color: '#3e63f2', icon: Gem },
  mestre: { color: '#8b5cf6', icon: Crown },
}

/** Cor base de um rank (para quem precisar pintar algo combinando). */
export const tierColor = (pos: number) => LOOK[tierOf(pos).id].color

/** Emblema do rank: ícone de rank no estilo dos ícones de matéria. */
export function RankEmblem({ pos, size = 56, showDivision = true }: { pos: number; size?: number; showDivision?: boolean; animated?: boolean }) {
  const tier = tierOf(pos)
  const { color, icon: Icon } = LOOK[tier.id]
  const div = divisionOf(pos)
  const badge = Math.max(14, Math.round(size * 0.3))
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Rank ${tier.name}${div ? ` ${div}` : ''}`}>
      <span
        className="subject-icon h-full w-full"
        style={{ borderRadius: size * 0.3, background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 70%, #000))` }}
      >
        <Icon size={size * 0.5} strokeWidth={2.2} />
      </span>
      {showDivision && div && (
        <span
          className="absolute grid place-items-center rounded-full bg-white font-display font-extrabold tabular-nums shadow-[0_1px_3px_rgba(16,24,40,0.25)]"
          style={{ right: -size * 0.06, bottom: -size * 0.06, minWidth: badge, height: badge, padding: `0 ${badge * 0.22}px`, fontSize: badge * 0.48, color: `color-mix(in srgb, ${color} 80%, #000)` }}
        >
          {div}
        </span>
      )}
    </span>
  )
}

/** Moldura discreta em volta do emblema: um fundo clarinho na cor do rank. */
export function RankFrame({ pos, size, children }: { pos: number; size: number; children: ReactNode }) {
  const color = tierColor(pos)
  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: `color-mix(in srgb, ${color} 12%, #fff)`,
        boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      {children}
    </span>
  )
}
