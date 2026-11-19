import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Card } from './ui'

/**
 * Peças do visual de "painel" do Início, reaproveitadas no resto do site:
 * cabeçalho com números (PageHeader + HeroStat), painel com barra lateral escura (DashShell),
 * caixas internas (Panel) e o botão de ação com seta (ActionBox).
 */

/** Quadradinho colorido com degradê e ícone branco. */
export function TileIcon({ color, children, size = 48 }: { color: string; children: ReactNode; size?: number }) {
  return (
    <span className="subject-icon shrink-0 rounded-[14px]" style={{ width: size, height: size, background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 72%, #000))` }}>
      <span className="relative z-10 flex">{children}</span>
    </span>
  )
}

/** Número do cabeçalho: ícone + valor + rótulo (a 1ª palavra ao lado do número, o resto embaixo). */
export function HeroStat({ tile, value, label, caption, accent }: { tile: ReactNode; value: ReactNode; label?: string; caption?: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3">
      {tile}
      <div className="leading-tight">
        {caption && <div className="text-xs text-muted">{caption}</div>}
        <div className="font-display text-lg font-bold tabular-nums" style={accent ? { color: accent } : undefined}>
          {value}
          {label && <span className="ml-1.5 font-sans text-sm font-medium text-ink">{label.split(' ')[0]}</span>}
        </div>
        {label && <div className="text-xs text-muted">{label.split(' ').slice(1).join(' ') || ' '}</div>}
      </div>
    </div>
  )
}

/** Cabeçalho de página no estilo do Início: cartão branco com ícone, título e números à direita. */
export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
  color = '#3e63f2',
  stats,
  back,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  actions?: ReactNode
  color?: string
  stats?: ReactNode
  back?: ReactNode
}) {
  return (
    <Card className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-4 px-6 py-5">
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-4">
        <TileIcon color={color} size={56}>
          {icon}
        </TileIcon>
        <div className="min-w-0">
          {back}
          <h1 className="truncate text-xl font-bold">{title}</h1>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {stats}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </Card>
  )
}

export function SideItem({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; badge?: number }) {
  return (
    <button onClick={onClick} className={`relative flex w-full flex-col items-center gap-1 px-1 py-1.5 text-center text-[11px] leading-tight font-semibold transition ${active ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>
      <span className={`grid h-10 w-10 place-items-center rounded-full transition ${active ? 'bg-gradient-to-br from-[#5b7cff] to-[#3e63f2] shadow-[0_0_18px_rgba(91,124,255,0.6)]' : 'bg-white/5'}`}>{icon}</span>
      {label}
      {!!badge && <span className="absolute top-0.5 right-3 min-w-[18px] rounded-full bg-rose-500 px-1 text-[10px] leading-[18px] font-bold text-white tabular-nums">{badge}</span>}
    </button>
  )
}

export interface ShellItem<T extends string> {
  id: T
  label: string
  icon: ReactNode
  badge?: number
}

/** Painel branco com a barra lateral escura do Início; no celular a barra vira abas no topo. */
export function DashShell<T extends string>({
  items,
  value,
  onChange,
  footer,
  children,
  minHeight = 560,
  flush = false,
}: {
  items: ShellItem<T>[]
  value: T
  onChange: (v: T) => void
  footer?: ReactNode
  children: ReactNode
  minHeight?: number
  /** Sem espaçamento interno (o conteúdo cuida das bordas). */
  flush?: boolean
}) {
  return (
    <>
      <div className="thin-scroll -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:hidden">
        {items.map((it) => (
          <button key={it.id} onClick={() => onChange(it.id)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ${value === it.id ? 'bg-brand text-white' : 'bg-white text-slate-600'}`}>
            {it.label}
          </button>
        ))}
      </div>
      <div className="flex overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_8px_24px_-12px_rgba(16,24,40,0.08)]" style={{ minHeight }}>
        <aside className="hidden w-[84px] shrink-0 flex-col items-center gap-1 bg-[#1c1d22] py-4 sm:flex">
          {items.map((it) => (
            <SideItem key={it.id} active={value === it.id} onClick={() => onChange(it.id)} icon={it.icon} label={it.label} badge={it.badge} />
          ))}
          {footer && <div className="mt-auto flex w-full flex-col items-center gap-1 border-t border-white/10 pt-3">{footer}</div>}
        </aside>
        <div key={value} className={`dash-body page-in min-w-0 flex-1 ${flush ? 'dash-flush flex flex-col' : 'p-4 sm:p-6'}`}>
          {children}
        </div>
      </div>
    </>
  )
}

/** Caixa interna com borda fina e título pequeno com ícone (como "Tarefas do dia"). */
export function Panel({ title, icon, children, right, className = '' }: { title: ReactNode; icon?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col rounded-[18px] border border-line p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-sans text-sm font-semibold">
          {icon} {title}
        </h3>
        {right}
      </div>
      {children}
    </div>
  )
}

/** Faixa de ação azul-clarinha com a bolinha de seta. */
export function ActionBox({ label, onClick, className = 'mt-5' }: { label: ReactNode; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={`group flex w-full items-center justify-between rounded-2xl bg-brand-soft px-4 py-3.5 text-left text-sm font-bold text-ink transition hover:brightness-95 ${className}`}>
      {label}
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-white transition group-hover:translate-x-0.5">
        <ArrowRight size={16} />
      </span>
    </button>
  )
}

/** Contador em pílula (ex.: "3 para hoje"). */
export function CountPill({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'rose' | 'emerald' }) {
  const cls = tone === 'rose' ? 'bg-rose-50 text-rose-600' : tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-soft text-brand'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${cls}`}>{children}</span>
}
