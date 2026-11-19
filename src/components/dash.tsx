import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

/**
 * Linguagem visual de "caderno": título grande com serifa, números em colunas separadas por fio,
 * seções numeradas sublinhadas e blocos marcados por um fio de tinta no topo (em vez de caixas com sombra).
 */

const today = () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

/** Rótulo pequeno em fonte de máquina de escrever. */
export function Kicker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`font-mono text-[11px] tracking-[0.12em] text-muted uppercase ${className}`}>{children}</div>
}

/** Ícone de linha na cor, sem fundo. */
export function TileIcon({ color, children, size = 40 }: { color: string; children: ReactNode; size?: number }) {
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-md border" style={{ width: size, height: size, color, borderColor: `color-mix(in srgb, ${color} 30%, transparent)` }}>
      {children}
    </span>
  )
}

/** Um número do cabeçalho: valor grande, legenda curta embaixo. */
export function HeroStat({ value, label, accent }: { tile?: ReactNode; value: ReactNode; label?: string; caption?: string; accent?: string }) {
  return (
    <div className="px-5 py-1 first:pl-0 last:pr-0">
      <div className="font-display text-[30px] leading-none font-semibold tabular-nums" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {label && <Kicker className="mt-1.5 whitespace-nowrap">{label}</Kicker>}
    </div>
  )
}

/** Cabeçalho de página: data, título grande e os números do lado, fechado por um fio de tinta. */
export function PageHeader({
  title,
  subtitle,
  actions,
  stats,
  back,
}: {
  icon?: ReactNode
  color?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  stats?: ReactNode
  back?: ReactNode
}) {
  return (
    <header className="mb-7 border-b-2 border-ink pb-5">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="min-w-0">
          {back ?? <Kicker>{today()}</Kicker>}
          <h1 className="mt-1.5 text-[40px] leading-[1.02] sm:text-[46px]">{title}</h1>
          {subtitle && <p className="mt-2 max-w-xl text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          {stats && <div className="flex flex-wrap divide-x divide-line">{stats}</div>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  )
}

export interface ShellItem<T extends string> {
  id: T
  label: string
  icon?: ReactNode
  badge?: number
}

/** Seções da página como um índice numerado e sublinhado. */
export function DashShell<T extends string>({
  items,
  value,
  onChange,
  footer,
  children,
}: {
  items: ShellItem<T>[]
  value: T
  onChange: (v: T) => void
  footer?: ReactNode
  children: ReactNode
  minHeight?: number
  flush?: boolean
}) {
  return (
    <>
      <nav className="thin-scroll mb-7 flex items-end gap-x-7 overflow-x-auto border-b border-line">
        {items.map((it, i) => {
          const on = value === it.id
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={`-mb-px flex shrink-0 items-baseline gap-2 border-b-2 pt-1 pb-2.5 text-[15px] font-semibold transition-colors ${on ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}
            >
              <span aria-hidden className={`font-mono text-[11px] ${on ? 'text-brand' : ''}`}>{String(i + 1).padStart(2, '0')}</span>
              {it.label}
              {!!it.badge && <sup className="font-mono text-[11px] font-semibold text-brand">{it.badge}</sup>}
            </button>
          )
        })}
        {footer && <div className="ml-auto flex shrink-0 gap-4 pb-2.5 text-sm">{footer}</div>}
      </nav>
      <div key={value} className="dash-body page-in">
        {children}
      </div>
    </>
  )
}

/** Link discreto para o rodapé do índice. */
export function SideItem({ onClick, label }: { active?: boolean; onClick: () => void; icon?: ReactNode; label: string; badge?: number }) {
  return (
    <button onClick={onClick} className="font-semibold text-muted underline decoration-line decoration-2 underline-offset-4 hover:text-ink hover:decoration-ink">
      {label}
    </button>
  )
}

/** Bloco de conteúdo: fio de tinta no topo e título em caixa-alta pequena. */
export function Panel({ title, children, right, className = '' }: { title: ReactNode; icon?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col border-t border-ink pt-3 ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-ink uppercase">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

/** Ação em forma de link sublinhado com seta. */
export function ActionBox({ label, onClick, className = 'mt-5' }: { label: ReactNode; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={`group inline-flex items-center gap-2 self-start text-left text-sm font-semibold text-ink underline decoration-brand/40 decoration-2 underline-offset-[5px] hover:decoration-brand ${className}`}>
      {label}
      <ArrowRight size={15} className="text-brand transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

/** Contagem curta ao lado de um título. */
export function CountPill({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'rose' | 'emerald' }) {
  const cls = tone === 'rose' ? 'text-rose-700' : tone === 'emerald' ? 'text-[#4d7a57]' : 'text-brand'
  return <span className={`font-mono text-[11px] tracking-wider uppercase tabular-nums ${cls}`}>{children}</span>
}
