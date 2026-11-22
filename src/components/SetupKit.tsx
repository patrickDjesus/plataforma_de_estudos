import { useId, type ReactNode } from 'react'

/*
 * Peças das telas de configuração dos modos (Rush, Simulado, Gerar lista):
 * passos em cartões à esquerda e um resumo escuro com o botão grande à direita.
 */

export function SetupLayout({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="min-w-0 flex-[999_1_560px] space-y-5">{children}</div>
      <aside className="min-w-0 flex-[1_1_320px] lg:sticky lg:top-24">{aside}</aside>
    </div>
  )
}

export function StepCard({ n, title, color, right, children }: { n: number | string; title: string; color: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[22px] border border-line bg-white p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="grid h-[30px] w-[30px] place-items-center rounded-full text-sm font-extrabold text-white" style={{ background: color }}>
          {n}
        </span>
        <h2 className="font-display text-[19px] font-bold">{title}</h2>
        {right && <span className="ml-auto text-[13px] font-semibold text-muted">{right}</span>}
      </div>
      {children}
    </section>
  )
}

/** Bloco grande de escolha: borda e fundo na cor do modo quando marcado. */
export function ChoiceTile({ on, color, soft, onClick, children, className = '' }: { on: boolean; color: string; soft: string; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-2xl border-2 text-left transition hover:-translate-y-0.5 ${on ? 'shadow-[0_8px_16px_-12px_rgba(16,24,40,.45)]' : 'border-line bg-white hover:border-slate-300'} ${className}`}
      style={on ? { borderColor: color, background: soft } : undefined}
    >
      {children}
    </button>
  )
}

/** Resumo do lado direito: cabeçalho escuro, linhas e o botão de começar. */
export function SummaryCard({
  kicker,
  accent,
  title,
  sub,
  rows = [],
  cta,
  from,
  to,
  onStart,
  note,
  extra,
}: {
  kicker: string
  accent: string
  title: ReactNode
  sub?: ReactNode
  rows?: { label: string; value: ReactNode }[]
  cta: ReactNode
  from: string
  to: string
  onStart: (el: HTMLElement) => void
  note?: ReactNode
  extra?: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-line bg-white">
      <div className="bg-[#16181d] px-5 pt-5 pb-4 text-white">
        <div className="text-[11px] font-extrabold tracking-[.12em] uppercase" style={{ color: accent }}>
          {kicker}
        </div>
        <div className="mt-1.5 font-display text-[22px] leading-tight font-extrabold">{title}</div>
        {sub && <div className="mt-1 text-[13px] text-[#c9cede]">{sub}</div>}
      </div>
      {rows.length > 0 && (
        <dl className="px-5 py-1.5">
          {rows.map((r, i) => (
            <div key={r.label} className={`flex items-center justify-between gap-3 py-3 text-sm ${i < rows.length - 1 ? 'border-b border-[#eef0f4]' : ''}`}>
              <dt className="text-muted">{r.label}</dt>
              <dd className="m-0 text-right font-extrabold">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="px-5 pt-1.5 pb-5">
        {extra}
        <button
          type="button"
          onClick={(e) => onStart(e.currentTarget)}
          className="act-btn flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-lg font-extrabold text-white"
          style={{ background: `linear-gradient(145deg, ${from}, ${to})`, boxShadow: `0 14px 26px -14px ${to}` }}
        >
          {cta}
        </button>
        {note && <p className="mt-2.5 text-center text-xs text-muted">{note}</p>}
      </div>
    </div>
  )
}

/** Interruptor liga/desliga. */
export function Toggle({ on, onChange, color, label }: { on: boolean; onChange: (v: boolean) => void; color: string; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="relative h-[26px] w-11 shrink-0 rounded-full transition" style={{ background: on ? color : '#d6d9e2' }}>
      <span className={`absolute top-[3px] left-[3px] h-5 w-5 rounded-full bg-white shadow transition ${on ? 'translate-x-[18px]' : ''}`} />
    </button>
  )
}

/* ---------- Selos ilustrados (mesmo estilo dos ícones de matéria) ---------- */
const BADGES: Record<string, { c1: string; c2: string; dk: string; art: ReactNode }> = {
  combo: {
    c1: '#ffb648',
    c2: '#ff4d2e',
    dk: '#b8320f',
    art: (
      <>
        <path d="M24 36c-6 0-9.6-3.9-9.6-9.2 0-4.4 2.8-7.4 5-9.8.4 2.6 1.8 4.2 3.5 5 0-4.6 2.2-9 5.9-12-.3 4.4 2 6.8 3.8 9.3 1.4 2 2 4.1 2 6.6C34.6 32 30 36 24 36z" fill="#fff" />
        <path d="M24 36c-2.5 0-4.3-1.7-4.3-4.1 0-2.4 1.8-4 4.3-6.5 2.5 2.5 4.3 4.1 4.3 6.5 0 2.4-1.8 4.1-4.3 4.1z" fill="#ffc83d" />
      </>
    ),
  },
  boss: {
    c1: '#7b5cf0',
    c2: '#3b1f9e',
    dk: '#24125f',
    art: (
      <>
        <path d="M12.5 31L11 15l7.5 6L24 10l5.5 11 7.5-6-1.5 16z" fill="#ffd34d" />
        <path d="M12.5 31h23v4.5h-23z" fill="#fff" />
        <circle cx="24" cy="24.5" r="2.2" fill="#ff5a6a" />
        <circle cx="17" cy="26" r="1.4" fill="#fff" />
        <circle cx="31" cy="26" r="1.4" fill="#fff" />
      </>
    ),
  },
  volta: {
    c1: '#7d97ff',
    c2: '#3e63f2',
    dk: '#2a3fb8',
    art: (
      <>
        <path d="M33.5 21a10 10 0 0 0-18-5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M14.5 10.5v6.5h6.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.5 25a10 10 0 0 0 18 5" fill="none" stroke="#ffd34d" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M33.5 35.5V29H27" fill="none" stroke="#ffd34d" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  clock: {
    c1: '#7d97ff',
    c2: '#3e63f2',
    dk: '#2a3fb8',
    art: (
      <>
        <circle cx="24" cy="23" r="12" fill="#fff" />
        <path d="M24 15v8l5 3" fill="none" stroke="#3e63f2" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="21" y="7" width="6" height="3.4" rx="1.4" fill="#fff" />
      </>
    ),
  },
  nohint: {
    c1: '#ffb648',
    c2: '#ff8a1f',
    dk: '#b85a00',
    art: (
      <>
        <path d="M24 9a9 9 0 0 0-5 16.5V29h10v-3.5A9 9 0 0 0 24 9z" fill="#fff" />
        <rect x="19.5" y="30.5" width="9" height="4" rx="1.6" fill="#fff" />
        <path d="M12 12l24 24" stroke="#d9480f" strokeWidth="3.2" strokeLinecap="round" />
      </>
    ),
  },
  notebook: {
    c1: '#ff7a88',
    c2: '#d92f45',
    dk: '#9e1d2f',
    art: (
      <>
        <rect x="14" y="9" width="21" height="27" rx="3.5" fill="#fff" />
        <path d="M14 9h4v27h-4z" fill="#ffd3d8" />
        <path d="M22 16h9M22 21h9M22 26h6" stroke="#d92f45" strokeWidth="2.2" strokeLinecap="round" />
      </>
    ),
  },
}

export function Badge({ kind, size = 44 }: { kind: keyof typeof BADGES | string; size?: number }) {
  const id = useId().replace(/:/g, '')
  const b = BADGES[kind]
  if (!b) return null
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="shrink-0" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`bd-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={b.c1} />
          <stop offset="1" stopColor={b.c2} />
        </linearGradient>
      </defs>
      <rect x="2" y="5" width="44" height="41" rx="13" fill={b.dk} />
      <rect x="2" y="2" width="44" height="41" rx="13" fill={`url(#bd-${id})`} />
      <ellipse cx="15" cy="8.5" rx="9" ry="3.2" fill="#fff" opacity=".28" />
      <ellipse cx="24" cy="37" rx="11" ry="2.2" fill="#000" opacity=".14" />
      {b.art}
    </svg>
  )
}

/** Cartãozinho de "como funciona" com selo ilustrado. */
export function RuleCard({ badge, title, text, bg }: { badge: string; title: string; text: string; bg: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: bg }}>
      <Badge kind={badge} size={42} />
      <div className="mt-2.5 text-sm font-extrabold">{title}</div>
      <p className="mt-1 text-[13px] leading-snug text-slate-600">{text}</p>
    </div>
  )
}
