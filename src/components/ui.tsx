import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { tint } from '../lib/colors'

/** Folha de papel com borda fina. Dentro de outra folha, vira só conteúdo (sem caixa dentro de caixa). */
export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`card rounded-lg border border-line bg-paper p-5 ${className}`} style={style}>
      {children}
    </div>
  )
}

type BtnVariant = 'primary' | 'ghost' | 'soft' | 'danger' | 'dark' | 'muted'
const VARIANTS: Record<BtnVariant, string> = {
  primary: 'bg-brand text-white hover:bg-[#a83a15]',
  ghost: 'border border-line bg-transparent text-ink hover:border-ink',
  soft: 'border border-brand/40 text-brand hover:bg-brand-soft',
  danger: 'border border-rose-300/70 text-rose-800 hover:bg-rose-50',
  dark: 'bg-ink text-paper hover:bg-black',
  muted: 'bg-[#efefed] text-ink hover:bg-[#e7e7e4]',
}

export function Btn({ variant = 'ghost', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-45 ${VARIANTS[variant]} ${className}`}
    />
  )
}

/** Etiqueta: fundo levíssimo e um traço na cor à esquerda. */
export function Chip({ color, children, className = '' }: { color: string; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border-l-2 px-2 py-0.5 text-xs font-medium text-ink ${className}`} style={{ background: tint(color, 0.08), borderColor: color }}>
      {children}
    </span>
  )
}

/** Abas sublinhadas, só texto. */
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; icon?: ReactNode }[] }) {
  return (
    <div className="flex flex-wrap gap-x-5 border-b border-line">
      {items.map((it) => {
        const active = it.id === value
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            className={`-mb-px border-b-2 pt-1 pb-2 text-sm font-semibold transition-colors ${active ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

export function Modal({ open, onClose, title, children, width = 'max-w-md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#18181b]/35 p-4" onMouseDown={onClose}>
      <div className={`thin-scroll max-h-[90vh] w-full overflow-y-auto ${width} rounded-lg border border-line bg-paper p-6 shadow-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-line pb-3">
          <h2 className="text-xl">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:text-ink" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] tracking-wider text-muted uppercase">{label}</span>
      {children}
    </label>
  )
}

export const inputCls = 'w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none transition-colors focus:border-ink'

/** Anel de progresso: traço fino, sem brilho. */
export function Ring({ value, size = 150, stroke = 6, color = '#18181b', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const sw = Math.min(stroke, 7)
  const r = (size - sw) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e7e7e4" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="butt" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
