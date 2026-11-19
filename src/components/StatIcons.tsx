/* Ícones animados do cabeçalho do Início, no estilo dos ícones de matéria (quadradinho com relevo). */

function Tile({ from, to, children, dim = false }: { from: string; to: string; children: React.ReactNode; dim?: boolean }) {
  return (
    <span className={`subject-icon relative h-12 w-12 shrink-0 overflow-visible rounded-[14px] ${dim ? 'grayscale-[.6]' : ''}`} style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}>
      <svg viewBox="0 0 48 48" width="48" height="48" className="essential-motion relative z-10 overflow-visible" aria-hidden>
        {children}
      </svg>
    </span>
  )
}

/** Dias estudados: calendário cuja folha vira e o "visto" se desenha de novo, em ciclo. */
export function StudyDaysIcon({ count }: { count: number }) {
  return (
    <Tile from="#ff6b7a" to="#c9273b" dim={count === 0}>
      {/* folhas de trás (dá a ideia de um bloquinho) */}
      <rect x="12.5" y="15.5" width="23" height="21" rx="4" fill="#fff" opacity=".35" transform="translate(2 2)" />
      {/* folha principal */}
      <g className={count ? 'st-flip' : undefined}>
        <rect x="12" y="14" width="24" height="22" rx="4" fill="#fff" />
        <rect x="12" y="14" width="24" height="7" rx="3.5" fill="#ffe1e5" />
        <rect x="12" y="18" width="24" height="3" fill="#ffe1e5" />
        <path className={count ? 'st-check' : undefined} d="M18 28.5 L22.5 32.5 L30.5 24.5" fill="none" stroke="#e23a4e" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" pathLength="30" strokeDasharray="30" />
      </g>
      {/* argolas */}
      <rect x="17" y="10.5" width="3" height="7" rx="1.5" fill="#fff" className={count ? 'st-ring' : undefined} />
      <rect x="28" y="10.5" width="3" height="7" rx="1.5" fill="#fff" className={count ? 'st-ring st-ring-2' : undefined} />
    </Tile>
  )
}

/** Dias seguidos: chama que tremula. Cresce com a sequência: brasa (0), fogo (1+), fogo azul no miolo (7+). */
export function StreakIcon({ streak }: { streak: number }) {
  const lit = streak > 0
  const hot = streak >= 7
  const s = lit ? Math.min(0.92, 0.7 + streak * 0.03) : 0.7
  return (
    <Tile from={lit ? '#ffab3d' : '#9aa3b2'} to={lit ? '#e2551b' : '#646c7a'}>
      <g transform={`translate(24 39) scale(${s})`}>
        {lit ? (
          <>
            <path className="rk-flame" style={{ animationDuration: '.9s' }} d="M0 0 C-11 -1 -14 -14 -7 -24 C-6 -17 -2 -15 0 -12 C0 -22 5 -29 2 -38 C13 -27 17 -12 10 -3 C7 0 3 1 0 0 Z" fill="#fff4c2" />
            <path className="rk-flame" style={{ animationDuration: '.7s', animationDelay: '.15s' }} d="M0 0 C-7 -1 -9 -9 -4 -16 C-3 -11 -1 -10 0 -8 C1 -15 4 -19 3 -25 C10 -17 11 -7 6 -2 C4 0 2 1 0 0 Z" fill={hot ? '#7cc4ff' : '#ffd34d'} />
            {hot && <path className="rk-flame" style={{ animationDuration: '.6s', animationDelay: '.3s' }} d="M0 0 C-3 0 -4 -4 -2 -8 C-1 -6 0 -6 0 -5 C1 -9 2 -11 2 -13 C5 -9 5 -4 3 -1 C2 0 1 0 0 0 Z" fill="#ffffff" />}
          </>
        ) : (
          // brasa apagada com um fiozinho de fumaça
          <>
            <ellipse cx="0" cy="-3" rx="8" ry="4" fill="#3b414d" />
            <ellipse cx="0" cy="-4" rx="4" ry="2" fill="#ff8a3d" opacity=".55" className="rk-pulse" />
            <path className="st-smoke" d="M0 -8 C-4 -13 4 -17 0 -23" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="1.6" strokeLinecap="round" />
          </>
        )}
      </g>
      {/* faíscas subindo */}
      {lit &&
        [
          [15, 30, 0],
          [33, 28, 0.7],
          [24, 22, 1.4],
          ...(streak >= 3 ? [[19, 26, 1.9], [30, 33, 0.3]] : []),
        ].map(([x, y, d]) => <circle key={`${x}${y}`} className="rk-ember" style={{ animationDelay: `${d}s` }} cx={x} cy={y} r={hot ? 1.5 : 1.2} fill={hot ? '#bfe3ff' : '#ffe27a'} />)}
    </Tile>
  )
}
