import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { tint } from '../lib/colors'

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-[22px] border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)] ${className}`} style={style}>
      {children}
    </div>
  )
}

type BtnVariant = 'primary' | 'ghost' | 'soft' | 'danger' | 'dark' | 'muted'
const VARIANTS: Record<BtnVariant, string> = {
  primary: 'bg-brand text-white shadow-[0_6px_16px_-6px_rgba(62,99,242,0.7)] hover:brightness-110',
  ghost: 'bg-white border border-line text-ink hover:bg-slate-50',
  soft: 'bg-brand-soft text-brand hover:brightness-95',
  danger: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
  dark: 'bg-[#16181d] text-white hover:bg-black',
  muted: 'bg-[#f1f2f5] text-ink hover:bg-[#e8e9ee]',
}

export function Btn({ variant = 'ghost', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:ring-4 focus-visible:ring-brand/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  )
}

/** Etiqueta com fundo pastel e borda na cor (como a legenda de matérias). */
export function Chip({ color, children, className = '' }: { color: string; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${className}`}
      style={{ background: tint(color, 0.1), borderColor: tint(color, 0.35), color: `color-mix(in srgb, ${color} 80%, #000)` }}
    >
      {children}
    </span>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; icon?: ReactNode }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const active = it.id === value
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              active ? 'bg-brand text-white shadow-[0_6px_14px_-6px_rgba(62,99,242,0.8)]' : 'border border-line bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {it.icon}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1026]/40 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className={`thin-scroll max-h-[90vh] w-full overflow-y-auto ${width} rounded-[24px] bg-white p-6 shadow-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-slate-100" aria-label="Fechar">
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
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full rounded-xl border border-line bg-[#f8f9fb] px-3 py-2.5 text-sm outline-none transition focus:border-brand/50 focus:bg-white focus:ring-4 focus:ring-brand/10'

/** Cabeçalho de página: ícone em círculo, título e subtítulo. */
export function PageHeader({ icon, title, subtitle, actions }: { icon: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f1f2f5] text-ink">{icon}</div>
        <div>
          <h1 className="text-[22px] font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** Anel de progresso circular. */
export function Ring({ value, size = 150, stroke = 12, color = '#3e63f2', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f4" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
