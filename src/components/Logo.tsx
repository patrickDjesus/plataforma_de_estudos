/**
 * Logo do Mendonça: um "M" desenhado como constelação.
 * Os nós são as três áreas (Faculdade, Ensino Médio, Idiomas) ligadas entre si,
 * a mesma ideia do caderno conectado, e a estrela no alto representa a meta.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="lm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b2559" />
          <stop offset="1" stopColor="#0b1026" />
        </linearGradient>
        <linearGradient id="lm-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff9a3d" />
          <stop offset=".5" stopColor="#7c8cff" />
          <stop offset="1" stopColor="#2fd89a" />
        </linearGradient>
        <radialGradient id="lm-glow" cx=".5" cy=".35" r=".6">
          <stop offset="0" stopColor="#5b6cff" stopOpacity=".55" />
          <stop offset="1" stopColor="#5b6cff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#lm-bg)" />
      <rect width="48" height="48" rx="14" fill="url(#lm-glow)" />
      {/* órbita */}
      <ellipse cx="24" cy="25" rx="19" ry="7.5" fill="none" stroke="#ffffff" strokeOpacity=".12" strokeWidth="1.2" transform="rotate(-18 24 25)" />
      {/* M constelação */}
      <path d="M11 35 L16.5 14 L24 27 L31.5 14 L37 35" fill="none" stroke="url(#lm-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="11" cy="35" r="3.3" fill="#ff9a3d" stroke="#0b1026" strokeWidth="1.5" />
      <circle cx="16.5" cy="14" r="3.3" fill="#5b7cff" stroke="#0b1026" strokeWidth="1.5" />
      <circle cx="24" cy="27" r="3.6" fill="#ffffff" stroke="#0b1026" strokeWidth="1.5" />
      <circle cx="31.5" cy="14" r="3.3" fill="#b06bff" stroke="#0b1026" strokeWidth="1.5" />
      <circle cx="37" cy="35" r="3.3" fill="#2fd89a" stroke="#0b1026" strokeWidth="1.5" />
      {/* estrela-meta */}
      <path d="M38.5 5.5 L39.6 8.9 L43 10 L39.6 11.1 L38.5 14.5 L37.4 11.1 L34 10 L37.4 8.9 Z" fill="#ffd34d" />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={38} />
      <span className="hidden flex-col leading-none lg:flex">
        <span className="font-display text-[19px] font-bold tracking-tight text-ink">
          Mendonça
        </span>
        <span className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">rota de estudos</span>
      </span>
    </span>
  )
}
