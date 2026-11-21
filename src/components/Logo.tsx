/**
 * Logo do Mendonça: o rosto da Mendi, a coruja-buraqueira mascote.
 * Formas simples e cores chapadas para ser reconhecível até em tamanho de ícone.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lmh" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="60">
          <stop offset="0" stopColor="#b98250" />
          <stop offset="1" stopColor="#95602f" />
        </linearGradient>
      </defs>
      <path d="M27 9 Q26 2 30 5 Q32 0 35 5 Q39 2 37 9 Z" fill="#7d4f28" />
      <ellipse cx="32" cy="34" rx="29" ry="26" fill="url(#lmh)" />
      <circle cx="21" cy="16" r="1.3" fill="#fff" opacity=".7" />
      <circle cx="32" cy="12.6" r="1.3" fill="#fff" opacity=".7" />
      <circle cx="43" cy="16" r="1.3" fill="#fff" opacity=".7" />
      <circle cx="21" cy="33" r="12.6" fill="#f2d9ae" />
      <circle cx="43" cy="33" r="12.6" fill="#f2d9ae" />
      <path d="M7 25 Q19 17 30 28 M57 25 Q45 17 34 28" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="21" cy="33" r="8.6" fill="#ffc83d" stroke="#e09a12" strokeWidth="1.2" />
      <circle cx="43" cy="33" r="8.6" fill="#ffc83d" stroke="#e09a12" strokeWidth="1.2" />
      <circle cx="21.6" cy="33.4" r="4.8" fill="#24160c" />
      <circle cx="42.4" cy="33.4" r="4.8" fill="#24160c" />
      <circle cx="23.4" cy="31.4" r="1.7" fill="#fff" />
      <circle cx="44.2" cy="31.4" r="1.7" fill="#fff" />
      <path d="M27.4 42 Q32 38.6 36.6 42 Q34.4 46.6 32 50 Q29.6 46.6 27.4 42 Z" fill="#f6b43c" />
      <ellipse cx="10.4" cy="45" rx="3.4" ry="2" fill="#ff8f7e" opacity=".6" />
      <ellipse cx="53.6" cy="45" rx="3.4" ry="2" fill="#ff8f7e" opacity=".6" />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={40} />
      <span className="hidden flex-col leading-none 2xl:flex">
        <span className="font-display text-[19px] font-bold tracking-tight text-ink">Mendonça</span>
        <span className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">rota de estudos</span>
      </span>
    </span>
  )
}
