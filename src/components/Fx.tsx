import { Fragment, type ReactNode } from 'react'

/*
 * Ícones desenhados à mão (SVG animado) que substituem os emojis do site.
 * <Fx name="fire" /> desenha um ícone; <FxText text="Meta batida! 🏆" /> troca os emojis de um texto pelos ícones.
 */

const Y1 = '#ffd75e'
const Y2 = '#ffb020'
const INK = '#3a2a12'

/** Rosto redondo base, com variações de olhos e boca. */
function Face({ children, cheeks = true }: { children?: ReactNode; cheeks?: boolean }) {
  return (
    <g className="fx-bob">
      <circle cx="12" cy="12" r="10" fill="url(#fx-face)" />
      <ellipse cx="9" cy="6.8" rx="3.4" ry="1.6" fill="#fff" opacity=".35" />
      {cheeks && (
        <>
          <ellipse cx="6.3" cy="14.3" rx="1.6" ry="1" fill="#ff8f7e" opacity=".55" />
          <ellipse cx="17.7" cy="14.3" rx="1.6" ry="1" fill="#ff8f7e" opacity=".55" />
        </>
      )}
      {children}
    </g>
  )
}
const dotEyes = (
  <>
    <ellipse className="fx-blink" cx="8.6" cy="10.2" rx="1.2" ry="1.5" fill={INK} />
    <ellipse className="fx-blink" cx="15.4" cy="10.2" rx="1.2" ry="1.5" fill={INK} />
  </>
)
const S = { fill: 'none', stroke: INK, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const star4 = (x: number, y: number, r: number, fill: string, d = 0) => (
  <path className="fx-twinkle" style={{ animationDelay: `${d}s` }} d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`} fill={fill} />
)

const ICONS: Record<string, () => ReactNode> = {
  /* ---------- rostos ---------- */
  smile: () => (
    <Face>
      {dotEyes}
      <path d="M8 14.2 Q12 17.6 16 14.2" {...S} />
    </Face>
  ),
  happy: () => (
    <Face>
      {dotEyes}
      <path d="M7.6 13.4 Q12 19.4 16.4 13.4 Z" fill={INK} />
      <path d="M9.6 16.4 Q12 17.6 14.4 16.4" fill="#ff7a7a" />
    </Face>
  ),
  calm: () => (
    <Face>
      <path d="M7 10.6 Q8.6 9 10.2 10.6 M13.8 10.6 Q15.4 9 17 10.6" {...S} />
      <path d="M9.4 14.6 Q12 16.4 14.6 14.6" {...S} />
    </Face>
  ),
  think: () => (
    <Face cheeks={false}>
      <path d="M6.8 7.6 L10 8.4 M14 7.2 L17.2 6.4" {...S} />
      {dotEyes}
      <path d="M9.6 15.4 H14.6" {...S} />
      <g className="fx-tap">
        <path d="M13.5 22 Q12 18.4 15.6 17.6 Q18 17.4 17.4 19.6 L16 22 Z" fill={Y2} stroke="#d98a00" strokeWidth=".8" />
      </g>
    </Face>
  ),
  fierce: () => (
    <Face cheeks={false}>
      <path d="M6.6 7.6 L10.4 9.4 M17.4 7.6 L13.6 9.4" {...S} strokeWidth={1.8} />
      {dotEyes}
      <path d="M9 16 Q12 13.8 15 16" {...S} />
      <g className="fx-puff">
        <circle cx="3" cy="17" r="1.6" fill="#fff" stroke="#c9ccd6" strokeWidth=".6" />
        <circle cx="21" cy="17" r="1.6" fill="#fff" stroke="#c9ccd6" strokeWidth=".6" />
      </g>
    </Face>
  ),
  hard: () => (
    <Face>
      <path d="M7 9 L10 10.5 L7 12 M17 9 L14 10.5 L17 12" {...S} />
      <path d="M8.4 15.6 Q9.6 14.2 10.8 15.6 T13.2 15.6 T15.6 15.6" {...S} />
    </Face>
  ),
  cool: () => (
    <Face cheeks={false}>
      <path d="M4.6 9 H19.4 L18.6 12.4 Q17.8 13.6 15.4 13.4 Q13 13.2 12.6 11 H11.4 Q11 13.2 8.6 13.4 Q6.2 13.6 5.4 12.4 Z" fill="#23263a" />
      <path className="fx-glint" d="M6.4 10 L8 10 L7 12.4 L5.8 12.4 Z" fill="#fff" opacity=".7" />
      <path d="M8.6 15.2 Q12 17.8 15.6 14.6" {...S} />
    </Face>
  ),
  sleepy: () => (
    <Face>
      <path d="M7 10.6 Q8.6 12 10.2 10.6 M13.8 10.6 Q15.4 12 17 10.6" {...S} />
      <ellipse cx="12" cy="15.6" rx="1.4" ry="1.2" fill={INK} />
      <text className="fx-zz" x="17.5" y="5" fontSize="6.5" fontWeight="900" fill="#5b7cff" fontFamily="Sora, sans-serif">
        z
      </text>
    </Face>
  ),
  dizzy: () => (
    <Face>
      <g className="fx-spin" style={{ transformOrigin: '8.6px 10.4px' }}>
        <path d="M8.6 10.4 m-.8 0 a.8 .8 0 1 1 1.6 0 a1.6 1.6 0 1 1 -3.2 0" {...S} strokeWidth={1.1} />
      </g>
      <g className="fx-spin" style={{ transformOrigin: '15.4px 10.4px' }}>
        <path d="M15.4 10.4 m-.8 0 a.8 .8 0 1 1 1.6 0 a1.6 1.6 0 1 1 -3.2 0" {...S} strokeWidth={1.1} />
      </g>
      <ellipse cx="12" cy="15.8" rx="1.6" ry="1.2" fill="none" stroke={INK} strokeWidth="1.3" />
    </Face>
  ),
  confused: () => (
    <Face cheeks={false}>
      {dotEyes}
      <path d="M9 16 L15 14.4" {...S} />
    </Face>
  ),
  starry: () => (
    <Face>
      {star4(8.6, 10.2, 2.6, '#ff6b7a')}
      {star4(15.4, 10.2, 2.6, '#ff6b7a', 0.3)}
      <path d="M7.6 13.4 Q12 19.4 16.4 13.4 Z" fill={INK} />
    </Face>
  ),
  shh: () => (
    <Face>
      {dotEyes}
      <path d="M10 15.4 H14" {...S} />
      <rect x="11" y="12.6" width="2.4" height="8" rx="1.2" fill={Y2} stroke="#d98a00" strokeWidth=".7" />
    </Face>
  ),
  shrug: () => (
    <g>
      <g className="fx-shrug">
        <path d="M1.5 14 L3.4 9.6 L5 14" fill={Y2} />
        <path d="M22.5 14 L20.6 9.6 L19 14" fill={Y2} />
      </g>
      <Face>
        <path d="M7.6 9.2 L10 8.6 M14 8.6 L16.4 9.2" {...S} />
        {dotEyes}
        <path d="M9.4 15.4 Q12 14.4 14.6 15.6" {...S} />
      </Face>
    </g>
  ),
  peek: () => (
    <Face cheeks={false}>
      <path d="M8.6 15 Q12 17.4 15.4 15" {...S} />
      <g className="fx-peek">
        <rect x="4" y="7.4" width="7" height="5.6" rx="2.6" fill="#c99260" />
        <rect x="13" y="7.4" width="7" height="5.6" rx="2.6" fill="#c99260" />
      </g>
    </Face>
  ),
  kid: () => (
    <Face>
      <path d="M5 9 Q7 2.6 12.6 3.4 Q17.6 3.8 19 8.6 Q15.2 6.4 12 7.4 Q8.4 6 5 9 Z" fill="#7a4e2d" />
      {dotEyes}
      <path d="M8.6 14.4 Q12 17.4 15.4 14.4" {...S} />
    </Face>
  ),

  /* ---------- objetos ---------- */
  fire: () => (
    <g>
      <path className="fx-flame" d="M12 22.5 C6 22.5 4 17.6 6 13 C7 15.4 8.6 15.8 9.4 15.4 C8.4 11 10.6 6.4 14.4 2 C14 6.4 16.4 8.6 18 11.2 C20.2 15 19 22.5 12 22.5 Z" fill="url(#fx-fire)" />
      <path className="fx-flame fx-d1" d="M12 22.5 C9 22.5 8 20 9 17.6 C9.8 18.8 10.8 19 11.2 18.6 C10.8 16.4 12 14.2 13.8 12 C13.8 14.6 15.6 16 15.6 18.4 C15.6 21 14.2 22.5 12 22.5 Z" fill="#fff3b0" />
    </g>
  ),
  target: () => (
    <g>
      <circle cx="11" cy="13" r="9.4" fill="#ff5a6a" />
      <circle cx="11" cy="13" r="6.8" fill="#fff" />
      <circle cx="11" cy="13" r="4.2" fill="#ff5a6a" />
      <circle cx="11" cy="13" r="1.8" fill="#fff" />
      <g className="fx-dart">
        <path d="M11 13 L20.4 3.6" stroke="#23263a" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M18.6 2.4 L22.2 1.8 L21.6 5.4 Z" fill="#3e63f2" />
      </g>
    </g>
  ),
  party: () => (
    <g>
      <path d="M3 21.5 L8.4 8 L16 15.6 Z" fill="url(#fx-cone)" />
      <path d="M5.2 16 L10.6 19.4 M6.8 12 L13.4 17.2" stroke="#fff" strokeWidth="1.2" opacity=".7" />
      <g className="fx-confetti">
        <rect x="14" y="3" width="2.2" height="2.2" rx=".5" fill="#3e63f2" transform="rotate(20 15 4)" />
        <circle cx="20" cy="8" r="1.3" fill="#ff6b7a" />
        <rect x="17.8" y="12.4" width="2.4" height="1.4" rx=".6" fill="#21b07a" transform="rotate(-30 19 13)" />
        <circle cx="11" cy="2.6" r="1.1" fill="#ffc83d" />
        <path d="M19.6 3 q1 1 0 2 t0 2" fill="none" stroke="#8b5cf6" strokeWidth="1.1" strokeLinecap="round" />
      </g>
    </g>
  ),
  trophy: () => (
    <g>
      <path d="M6.6 4 H4 Q2.4 4 2.6 6 Q3.2 10.6 7.6 11 M17.4 4 H20 Q21.6 4 21.4 6 Q20.8 10.6 16.4 11" fill="none" stroke="#e8a500" strokeWidth="1.8" />
      <path d="M6 2.6 H18 V8.6 Q18 14 12 14.6 Q6 14 6 8.6 Z" fill="url(#fx-gold)" />
      <rect x="10.6" y="14" width="2.8" height="4" fill="#e8a500" />
      <rect x="7" y="18" width="10" height="3.6" rx="1.2" fill="#a87648" />
      <g clipPath="url(#fx-cup)">
        <rect className="fx-sheen" x="-6" y="0" width="4" height="16" fill="#fff" opacity=".7" transform="skewX(-20)" />
      </g>
      {star4(12, 7.6, 2.4, '#fff8d6')}
    </g>
  ),
  check: () => (
    <g>
      <circle cx="12" cy="12" r="10" fill="url(#fx-green)" />
      <path className="fx-draw" d="M7 12.4 L10.4 15.8 L17 8.8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength="20" strokeDasharray="20" />
    </g>
  ),
  cross: () => (
    <g className="fx-shake">
      <circle cx="12" cy="12" r="10" fill="url(#fx-red)" />
      <path d="M8.4 8.4 L15.6 15.6 M15.6 8.4 L8.4 15.6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </g>
  ),
  bulb: () => (
    <g>
      <circle className="fx-glow" cx="12" cy="9.6" r="9" fill="#ffe27a" opacity=".45" />
      <path d="M12 2.6 Q18 2.8 18 9 Q18 12 15.4 14 V16 H8.6 V14 Q6 12 6 9 Q6 2.8 12 2.6 Z" fill="url(#fx-face)" />
      <path d="M10 13.6 L11 9.4 L12 11.4 L13 9.4 L14 13.6" fill="none" stroke="#c97a00" strokeWidth="1" strokeLinejoin="round" />
      <rect x="8.6" y="16" width="6.8" height="2.4" rx=".8" fill="#c9ccd6" />
      <rect x="9.4" y="18.4" width="5.2" height="2.4" rx="1" fill="#9aa3b2" />
      <ellipse cx="9.6" cy="6.4" rx="1.6" ry="2.4" fill="#fff" opacity=".6" transform="rotate(30 9.6 6.4)" />
    </g>
  ),
  sparkle: () => (
    <g>
      {star4(10, 13, 8.4, 'url(#fx-face)')}
      {star4(19, 5, 4, '#ffc83d', 0.5)}
      {star4(19.6, 18.6, 2.6, '#ffe27a', 0.9)}
    </g>
  ),
  bolt: () => (
    <path className="fx-flash" d="M14 1.6 L4.6 13.6 H11 L9.4 22.4 L19.4 9.6 H13 Z" fill="url(#fx-face)" stroke="#e8a500" strokeWidth="1" strokeLinejoin="round" />
  ),
  skull: () => (
    <g className="fx-wobble">
      <path d="M12 2 Q20.6 2 20.6 10.4 Q20.6 14.6 17.4 16 V19.6 Q17.4 21.6 15.4 21.6 H8.6 Q6.6 21.6 6.6 19.6 V16 Q3.4 14.6 3.4 10.4 Q3.4 2 12 2 Z" fill="#f3f4f8" stroke="#c9ccd6" strokeWidth=".8" />
      <ellipse cx="8.6" cy="11" rx="2.4" ry="2.6" fill="#23263a" />
      <ellipse cx="15.4" cy="11" rx="2.4" ry="2.6" fill="#23263a" />
      <circle className="fx-glow" cx="8.6" cy="11" r=".9" fill="#ff5a6a" />
      <circle className="fx-glow" cx="15.4" cy="11" r=".9" fill="#ff5a6a" />
      <path d="M12 14.2 L10.8 16.4 H13.2 Z" fill="#23263a" />
      <path d="M9.6 19 V21.4 M12 19 V21.4 M14.4 19 V21.4" stroke="#c9ccd6" strokeWidth=".9" />
    </g>
  ),
  swords: () => (
    <g>
      <g className="fx-clashL">
        <path d="M3 3 L15 15" stroke="#c9ccd6" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M3 3 L15 15" stroke="#fff" strokeWidth=".8" strokeLinecap="round" />
        <path d="M12.6 17.4 L17.4 12.6" stroke="#ffc83d" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 16 L20 20" stroke="#a87648" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <g className="fx-clashR">
        <path d="M21 3 L9 15" stroke="#c9ccd6" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M21 3 L9 15" stroke="#fff" strokeWidth=".8" strokeLinecap="round" />
        <path d="M11.4 17.4 L6.6 12.6" stroke="#ffc83d" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 16 L4 20" stroke="#a87648" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      {star4(12, 9, 2.4, '#ffe27a')}
    </g>
  ),
  shield: () => (
    <g>
      <path d="M12 1.8 L20.4 5 V11.4 Q20.4 18.6 12 22.4 Q3.6 18.6 3.6 11.4 V5 Z" fill="url(#fx-blue)" />
      <path d="M12 4.4 L17.8 6.6 V11.4 Q17.8 16.6 12 19.6 Z" fill="#fff" opacity=".25" />
      <path d="M8.6 11.8 L11 14.2 L15.6 9.4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <g clipPath="url(#fx-shieldclip)">
        <rect className="fx-sheen" x="-6" y="0" width="4" height="24" fill="#fff" opacity=".6" transform="skewX(-20)" />
      </g>
    </g>
  ),
  repeat: () => (
    <g className="fx-spin" style={{ transformOrigin: '12px 12px', animationDuration: '3s' }}>
      <path d="M19.4 9.6 A8 8 0 0 0 5 8" fill="none" stroke="#ff9a3d" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M3.4 4.6 L4.8 8.8 L9 7.6" fill="none" stroke="#ff9a3d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.6 14.4 A8 8 0 0 0 19 16" fill="none" stroke="#3e63f2" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M20.6 19.4 L19.2 15.2 L15 16.4" fill="none" stroke="#3e63f2" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  pin: () => (
    <g className="fx-bob">
      <path d="M12 15 L12 22.6" stroke="#9aa3b2" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7.4 2.4 H16.6 L15.4 4.4 V8.8 L18.4 12.4 V14.6 H5.6 V12.4 L8.6 8.8 V4.4 Z" fill="url(#fx-red)" />
      <rect x="9.6" y="4.6" width="1.4" height="7" rx=".7" fill="#fff" opacity=".45" />
    </g>
  ),
  note: () => (
    <g>
      <rect x="3.6" y="2.6" width="14" height="18.8" rx="2.4" fill="#fff" stroke="#c9ccd6" strokeWidth="1" />
      <path className="fx-write" d="M6.6 8 H14.4 M6.6 11.6 H13 M6.6 15.2 H11.4" stroke="#3e63f2" strokeWidth="1.6" strokeLinecap="round" pathLength="30" strokeDasharray="30" />
      <g className="fx-pencil">
        <path d="M14.6 19.4 L20.6 8.6 L22.6 9.8 L16.6 20.6 L14.2 21.6 Z" fill="#ffc83d" stroke="#d98a00" strokeWidth=".6" />
        <path d="M14.2 21.6 L14.6 19.4 L16.6 20.6 Z" fill="#23263a" />
      </g>
    </g>
  ),
  write: () => (
    <g>
      <path className="fx-write" d="M2.6 19.6 Q5 16 7 19 T11.4 18.6 T16 18.6" fill="none" stroke="#3e63f2" strokeWidth="1.6" strokeLinecap="round" pathLength="30" strokeDasharray="30" />
      <g className="fx-pencil">
        <path d="M8.6 15.4 L18.4 3.6 L21.2 6 L11.4 17.8 L8 18.8 Z" fill="#ffc83d" stroke="#d98a00" strokeWidth=".6" />
        <path d="M18.4 3.6 L19.4 2.4 Q20.4 1.6 21.4 2.6 Q22.2 3.6 21.2 4.6 L20.4 5.6 Z" fill="#ff8fa3" />
        <path d="M8 18.8 L8.6 15.4 L11.4 17.8 Z" fill="#f3d2a2" />
      </g>
    </g>
  ),
  dice: () => (
    <g className="fx-roll" style={{ transformOrigin: '12px 12px' }}>
      <rect x="3" y="3" width="18" height="18" rx="4.6" fill="#fff" stroke="#c9ccd6" strokeWidth="1" />
      <rect x="3" y="15" width="18" height="6" rx="3" fill="#000" opacity=".05" />
      {[
        [8, 8],
        [16, 8],
        [12, 12],
        [8, 16],
        [16, 16],
      ].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="1.7" fill={x === 12 ? '#ff5a6a' : '#23263a'} />
      ))}
    </g>
  ),
  eyes: () => (
    <g>
      {[7, 17].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="12" rx="4.6" ry="6.4" fill="#fff" stroke="#c9ccd6" strokeWidth=".8" />
          <circle className="fx-look" cx={x} cy="13" r="2.4" fill="#23263a" />
        </g>
      ))}
    </g>
  ),
  point: () => (
    <g className="fx-nudge">
      <path d="M2.6 12 H16" stroke="#7d97ff" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M12.4 5.6 L19.6 12 L12.4 18.4" fill="none" stroke="#3e63f2" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  mic: () => (
    <g>
      <rect x="8.4" y="2" width="7.2" height="12.4" rx="3.6" fill="url(#fx-blue)" />
      <path d="M9.6 6 H14.4 M9.6 8.6 H14.4" stroke="#fff" strokeWidth=".9" opacity=".6" />
      <path d="M5.4 10.6 Q5.4 17 12 17 Q18.6 17 18.6 10.6" fill="none" stroke="#9aa3b2" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 17 V21 M8.6 21.4 H15.4" stroke="#9aa3b2" strokeWidth="1.6" strokeLinecap="round" />
      <path className="fx-wave" d="M20.6 6 Q22.4 9 20.6 12 M3.4 6 Q1.6 9 3.4 12" fill="none" stroke="#ff6b7a" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  ),
  grad: () => (
    <g>
      <path d="M1.6 9 L12 4.4 L22.4 9 L12 13.6 Z" fill="#23263a" />
      <path d="M6 11 V15.4 Q12 19 18 15.4 V11 L12 13.6 Z" fill="#363a54" />
      <g className="fx-tassel" style={{ transformOrigin: '19.6px 10px' }}>
        <path d="M19.6 10 V16.4" stroke="#ffc83d" strokeWidth="1.2" />
        <rect x="18.6" y="16" width="2" height="3.4" rx=".8" fill="#ffc83d" />
      </g>
    </g>
  ),
  hourglass: () => (
    <g className="fx-flip" style={{ transformOrigin: '12px 12px' }}>
      <rect x="4.6" y="1.6" width="14.8" height="2.6" rx="1.2" fill="#a87648" />
      <rect x="4.6" y="19.8" width="14.8" height="2.6" rx="1.2" fill="#a87648" />
      <path d="M6.4 4.2 H17.6 Q17.6 9.4 12 12 Q17.6 14.6 17.6 19.8 H6.4 Q6.4 14.6 12 12 Q6.4 9.4 6.4 4.2 Z" fill="#e8f3ff" stroke="#9fb6d6" strokeWidth=".8" />
      <path d="M8.6 6.4 H15.4 Q14.6 9 12 10.6 Q9.4 9 8.6 6.4 Z" fill="#ffc83d" />
      <path d="M8.2 19 Q9.4 15.8 12 15.4 Q14.6 15.8 15.8 19 Z" fill="#ffc83d" />
      <path className="fx-sand" d="M12 11 V15.4" stroke="#ffc83d" strokeWidth="1" strokeDasharray="1 1.2" />
    </g>
  ),
  phone: () => (
    <g className="fx-buzz">
      <rect x="6" y="1.6" width="12" height="20.8" rx="3" fill="#23263a" />
      <rect x="7.4" y="4" width="9.2" height="14.4" rx="1.4" fill="url(#fx-blue)" />
      <rect x="9" y="6.2" width="6" height="2" rx="1" fill="#fff" opacity=".8" />
      <rect x="9" y="9.6" width="4" height="2" rx="1" fill="#fff" opacity=".55" />
      <circle cx="16" cy="5" r="1.6" fill="#ff5a6a" />
      <rect x="10.4" y="19.6" width="3.2" height="1" rx=".5" fill="#596071" />
    </g>
  ),
  climb: () => (
    <g>
      <path d="M1.4 21.6 L9.4 6.4 L13.4 13 L16 9.4 L22.6 21.6 Z" fill="url(#fx-mount)" />
      <path d="M7.4 10.2 L9.4 6.4 L11.4 9.8 L10.2 9 L9 10.4 Z" fill="#fff" />
      <g className="fx-wave">
        <path d="M9.4 6.4 V1.6" stroke="#23263a" strokeWidth="1.1" />
        <path d="M9.4 1.6 L13.6 2.8 L9.4 4.2 Z" fill="#ff5a6a" />
      </g>
    </g>
  ),
  moon: () => (
    <g>
      <g className="fx-bob">
        <path d="M15.6 2.4 A9.8 9.8 0 1 0 21.6 15 A8 8 0 0 1 15.6 2.4 Z" fill="url(#fx-face)" />
        <circle cx="9" cy="14" r="1.4" fill="#e8a500" opacity=".35" />
        <circle cx="12.6" cy="18" r="1" fill="#e8a500" opacity=".35" />
      </g>
      {star4(19.4, 5, 2.4, '#8fa0f5', 0.4)}
    </g>
  ),
  shuffle: () => (
    <g className="fx-nudge">
      <path d="M2.6 6.4 H6.6 Q10.4 6.4 12 12 Q13.6 17.6 17.4 17.6 H20" fill="none" stroke="#8b5cf6" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M2.6 17.6 H6.6 Q10.4 17.6 12 12 Q13.6 6.4 17.4 6.4 H20" fill="none" stroke="#ff9a3d" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M18 3.6 L21 6.4 L18 9.2 M18 14.8 L21 17.6 L18 20.4" fill="none" stroke="#23263a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  stopwatch: () => (
    <g>
      <rect x="10" y="1" width="4" height="2.6" rx="1" fill="#596071" />
      <path d="M17.6 5 L19.4 3.4" stroke="#596071" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="13.4" r="9" fill="#fff" stroke="url(#fx-blue)" strokeWidth="2.4" />
      <path d="M12 13.4 L12 6.6 A6.8 6.8 0 0 1 17.9 10 Z" fill="#3e63f2" opacity=".2" />
      <g className="fx-tick" style={{ transformOrigin: '12px 13.4px' }}>
        <path d="M12 13.4 V7" stroke="#ff5a6a" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <circle cx="12" cy="13.4" r="1.4" fill="#23263a" />
    </g>
  ),
  wave: () => (
    <g className="fx-hand" style={{ transformOrigin: '12px 21px' }}>
      <path d="M7 21.4 Q4 18.6 3.6 14 L3.4 10.4 Q3.4 9 4.6 9 Q5.8 9 6 10.4 L6.4 12.6 L6.2 4.6 Q6.2 3.2 7.4 3.2 Q8.6 3.2 8.8 4.6 L9 10.6 L9 3 Q9 1.6 10.2 1.6 Q11.4 1.6 11.6 3 L11.8 10.6 L12.2 3.6 Q12.4 2.2 13.6 2.4 Q14.8 2.6 14.6 4 L14.4 11 L15.6 7.6 Q16.2 6.4 17.4 6.8 Q18.4 7.2 18 8.6 L16.4 15 Q15.4 19.6 12 21.4 Z" fill="url(#fx-face)" stroke="#d98a00" strokeWidth=".6" />
      <path className="fx-wave" d="M19.6 2 Q21.6 3.4 21.8 6 M20.4 9.6 Q22 10 22.6 11.4" fill="none" stroke="#9aa3b2" strokeWidth="1.1" strokeLinecap="round" />
    </g>
  ),
  orange: () => (
    <g className="fx-bob">
      <circle cx="12" cy="13.6" r="8.6" fill="url(#fx-orange)" />
      <circle cx="9" cy="10.6" r="2" fill="#fff" opacity=".35" />
      <path d="M12 5.2 V3" stroke="#7a4e2d" strokeWidth="1.4" strokeLinecap="round" />
      <path className="fx-leaf" d="M12.4 4 Q16 0.6 19.4 3 Q16.4 6.4 12.4 4 Z" fill="#3fbf6a" />
    </g>
  ),
  chat: () => (
    <g>
      <path d="M3.4 4 H20.6 Q22 4 22 5.6 V15 Q22 16.6 20.6 16.6 H10.4 L5.4 20.6 V16.6 H3.4 Q2 16.6 2 15 V5.6 Q2 4 3.4 4 Z" fill="url(#fx-blue)" />
      {[7.4, 12, 16.6].map((x, i) => (
        <circle key={x} className="fx-dot" style={{ animationDelay: `${i * 0.18}s` }} cx={x} cy="10.4" r="1.5" fill="#fff" />
      ))}
    </g>
  ),
  book: () => (
    <g className="fx-bob">
      <path d="M4.4 3.4 Q4.4 2 6 2 H19.4 V18.6 H6 Q4.4 18.6 4.4 20.2 Z" fill="url(#fx-red)" />
      <path d="M4.4 20.2 Q4.4 18.6 6 18.6 H19.4 V22 H6 Q4.4 22 4.4 20.2 Z" fill="#fff" stroke="#e6e9f2" strokeWidth=".6" />
      <rect x="8" y="5.6" width="8" height="3" rx="1" fill="#fff" opacity=".85" />
      <path d="M15.6 2 V9.6 L17 8.4 L18.4 9.6 V2" fill="#ffc83d" />
    </g>
  ),
  sprout: () => (
    <g>
      <path d="M4.4 15 H19.6 L18 22.4 H6 Z" fill="#c97a4a" />
      <rect x="3.6" y="13.6" width="16.8" height="2.6" rx="1.2" fill="#d98a5b" />
      <g className="fx-sway" style={{ transformOrigin: '12px 14px' }}>
        <path d="M12 14 V7.6" stroke="#21b07a" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M12 9.6 Q5.6 9.8 4.6 4 Q10.6 3.4 12 9.6 Z" fill="#3fbf6a" />
        <path d="M12 8 Q13 2 19.4 2 Q19 8 12 8 Z" fill="#21b07a" />
      </g>
    </g>
  ),
  rocket: () => (
    <g className="fx-hover">
      <path className="fx-flame" style={{ transformOrigin: '8px 16px' }} d="M8.4 15.6 Q4 17 2.6 21.4 Q7 20 8.4 15.6 Z" fill="#ff9a3d" />
      <path d="M9 15 Q8.6 9.6 13.6 5 Q17.4 1.8 22 2 Q22.2 6.6 19 10.4 Q14.4 15.4 9 15 Z" fill="#f3f4f8" stroke="#c9ccd6" strokeWidth=".6" />
      <circle cx="16.4" cy="7.6" r="2.2" fill="url(#fx-blue)" stroke="#fff" strokeWidth=".8" />
      <path d="M9.6 10.4 L5 10.4 L7.6 7.4 L12 7.6 Z M13.6 14.4 L13.6 19 L16.6 16.4 L16.4 12 Z" fill="#ff5a6a" />
    </g>
  ),
  page: () => (
    <g>
      <path d="M5 2 H14.6 L19.4 6.8 V20.6 Q19.4 22 18 22 H5 Q3.6 22 3.6 20.6 V3.4 Q3.6 2 5 2 Z" fill="#fff" stroke="#c9ccd6" strokeWidth="1" />
      <path d="M14.6 2 V6.8 H19.4" fill="#e6e9f2" />
      <path className="fx-write" d="M7 11 H16 M7 14.4 H16 M7 17.8 H12.4" stroke="#8b5cf6" strokeWidth="1.6" strokeLinecap="round" pathLength="30" strokeDasharray="30" />
    </g>
  ),
  globe: () => (
    <g>
      <defs>
        <clipPath id="fx-globeclip">
          <circle cx="12" cy="12" r="9.6" />
        </clipPath>
      </defs>
      <circle cx="12" cy="12" r="9.6" fill="url(#fx-blue)" />
      <g clipPath="url(#fx-globeclip)">
        <g className="fx-turn">
          {[0, 20].map((o) => (
            <g key={o} transform={`translate(${o} 0)`} fill="#3fbf6a">
              <path d="M2 7 Q5 4 8 5.6 Q9 8 7 9.4 Q8.6 12.4 6.4 14.6 Q4 13.6 3.6 10.6 Z" />
              <path d="M12 4 Q15.4 3.6 16 6 Q14.6 7.6 12.6 7 Z" />
              <path d="M12.6 11 Q16.4 10 18 13 Q17.4 17 14.6 19.4 Q13 16.4 13.4 14 Q11.6 13 12.6 11 Z" />
            </g>
          ))}
        </g>
      </g>
      <circle cx="12" cy="12" r="9.6" fill="none" stroke="#2a3fb8" strokeWidth=".8" />
      <ellipse cx="8.4" cy="7" rx="3" ry="1.6" fill="#fff" opacity=".3" />
    </g>
  ),
  barrier: () => (
    <g>
      <rect x="4.6" y="13" width="2" height="9" fill="#596071" />
      <rect x="17.4" y="13" width="2" height="9" fill="#596071" />
      <rect x="2" y="7" width="20" height="7" rx="1.6" fill="#ffc83d" />
      <g clipPath="url(#fx-barclip)">
        <g className="fx-march">
          {[-6, 0, 6, 12, 18, 24].map((x) => (
            <path key={x} d={`M${x} 14 L${x + 3} 7 H${x + 6} L${x + 3} 14 Z`} fill="#23263a" />
          ))}
        </g>
      </g>
      <circle className="fx-glow" cx="5.6" cy="5" r="1.8" fill="#ff9a3d" />
      <circle className="fx-glow fx-d1" cx="18.4" cy="5" r="1.8" fill="#ff9a3d" />
    </g>
  ),
  star: () => (
    <path className="fx-pulse" d="M12 1.8 L14.9 8.2 L21.8 8.8 L16.6 13.4 L18.2 20.2 L12 16.6 L5.8 20.2 L7.4 13.4 L2.2 8.8 L9.1 8.2 Z" fill="url(#fx-face)" stroke="#e8a500" strokeWidth=".8" strokeLinejoin="round" />
  ),
  brain: () => (
    <g className="fx-pulse">
      <path d="M12 3.6 Q9.6 1.6 7.2 3.2 Q4.4 2.8 4 6 Q1.6 7.4 2.6 10.4 Q1.4 13.4 4 15.4 Q4 19 7.6 19.4 Q9.6 21.6 12 20 Q14.4 21.6 16.4 19.4 Q20 19 20 15.4 Q22.6 13.4 21.4 10.4 Q22.4 7.4 20 6 Q19.6 2.8 16.8 3.2 Q14.4 1.6 12 3.6 Z" fill="url(#fx-pink)" />
      <path d="M12 3.6 V20 M7.4 7.4 Q9.6 8 9.4 10.4 M5.6 12.6 Q8.4 12 9.4 14.6 M16.6 7.4 Q14.4 8 14.6 10.4 M18.4 12.6 Q15.6 12 14.6 14.6" fill="none" stroke="#d6457a" strokeWidth="1.1" strokeLinecap="round" />
      {star4(19.6, 3, 2, '#ffe27a', 0.3)}
    </g>
  ),
  question: () => (
    <g className="fx-bob">
      <circle cx="12" cy="12" r="10" fill="url(#fx-purple)" />
      <path d="M8.8 9.2 Q8.8 5.6 12.2 5.6 Q15.4 5.8 15.4 8.8 Q15.4 10.6 13.4 11.6 Q12.2 12.4 12.2 14" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12.2" cy="17.6" r="1.5" fill="#fff" />
    </g>
  ),
  search: () => (
    <g className="fx-scan">
      <circle cx="10" cy="10" r="6.8" fill="#e8f3ff" stroke="url(#fx-blue)" strokeWidth="2.6" />
      <path d="M7 7.6 Q8.6 5.8 10.6 6" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M15 15 L21 21" stroke="#596071" strokeWidth="3.2" strokeLinecap="round" />
    </g>
  ),
  muscle: () => (
    <g className="fx-flex" style={{ transformOrigin: '6px 20px' }}>
      <path d="M3 21 Q2.4 15 6 11.4 L9.4 4.4 Q10.4 2.6 12.4 3.4 Q14.4 4.4 13.4 6.6 L11.4 10.4 Q15 8.6 18.2 10.6 Q21.6 12.8 20.6 16.6 Q19.4 21 14 21 Z" fill="url(#fx-face)" stroke="#d98a00" strokeWidth=".7" />
      <path d="M13 13.4 Q16 12.6 17.6 14.6" fill="none" stroke="#d98a00" strokeWidth="1" strokeLinecap="round" />
      {star4(20.4, 5, 2.2, '#ffc83d', 0.2)}
    </g>
  ),
  gift: () => (
    <g>
      <rect x="3.6" y="10.4" width="16.8" height="11.4" rx="2" fill="url(#fx-purple)" />
      <rect x="10.6" y="10.4" width="2.8" height="11.4" fill="#ffc83d" />
      <g className="fx-lid">
        <rect x="2.4" y="7" width="19.2" height="4.4" rx="1.4" fill="#a77bff" />
        <rect x="10.6" y="7" width="2.8" height="4.4" fill="#ffd75e" />
        <path d="M12 7 Q7.6 1.4 6.4 4.4 Q6 6.8 12 7 Q18 6.8 17.6 4.4 Q16.4 1.4 12 7 Z" fill="none" stroke="#ffc83d" strokeWidth="1.8" />
      </g>
    </g>
  ),
  skip: () => (
    <g className="fx-nudge">
      <path d="M3 5 L11 12 L3 19 Z M11 5 L19 12 L11 19 Z" fill="url(#fx-blue)" strokeLinejoin="round" />
      <rect x="19" y="5" width="2.6" height="14" rx="1.2" fill="#2a3fb8" />
    </g>
  ),
  sqGreen: () => <rect className="fx-pulse" x="3" y="3" width="18" height="18" rx="5" fill="url(#fx-green)" />,
  sqRed: () => <rect className="fx-pulse" x="3" y="3" width="18" height="18" rx="5" fill="url(#fx-red)" />,
  sqYellow: () => <rect className="fx-pulse" x="3" y="3" width="18" height="18" rx="5" fill="#fff" stroke="#ffc83d" strokeWidth="3" />,
}

/** Gradientes e recortes compartilhados (um só conjunto por página). */
export function FxDefs() {
  const lg = (id: string, a: string, b: string) => (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={a} />
      <stop offset="1" stopColor={b} />
    </linearGradient>
  )
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        {lg('fx-face', Y1, Y2)}
        {lg('fx-fire', '#ffb648', '#ff4d2e')}
        {lg('fx-gold', '#ffe27a', '#f0a500')}
        {lg('fx-green', '#3fdca0', '#12a06f')}
        {lg('fx-red', '#ff7a88', '#e2364b')}
        {lg('fx-blue', '#7d97ff', '#3e63f2')}
        {lg('fx-purple', '#b896ff', '#7a4ee6')}
        {lg('fx-pink', '#ffb3cf', '#ff7aa8')}
        {lg('fx-orange', '#ffb547', '#ff7a1a')}
        {lg('fx-mount', '#9aa8c4', '#5b6478')}
        <linearGradient id="fx-cone" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#ff6b7a" />
        </linearGradient>
        <clipPath id="fx-cup">
          <path d="M6 2.6 H18 V8.6 Q18 14 12 14.6 Q6 14 6 8.6 Z" />
        </clipPath>
        <clipPath id="fx-shieldclip">
          <path d="M12 1.8 L20.4 5 V11.4 Q20.4 18.6 12 22.4 Q3.6 18.6 3.6 11.4 V5 Z" />
        </clipPath>
        <clipPath id="fx-barclip">
          <rect x="2" y="7" width="20" height="7" rx="1.6" />
        </clipPath>
      </defs>
    </svg>
  )
}

export type FxName = keyof typeof ICONS

export function Fx({ name, size = '1.25em', className = '', title }: { name: FxName | string; size?: number | string; className?: string; title?: string }) {
  const draw = ICONS[name]
  if (!draw) return null
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`fx essential-motion inline-block shrink-0 overflow-visible align-[-0.22em] ${className}`} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {draw()}
    </svg>
  )
}

/** Emoji → ícone. */
export const EMOJI_FX: Record<string, FxName> = {
  '🔥': 'fire',
  '🎯': 'target',
  '🎉': 'party',
  '🏆': 'trophy',
  '✓': 'check',
  '✔': 'check',
  '✅': 'check',
  '✗': 'cross',
  '❌': 'cross',
  '💡': 'bulb',
  '🙂': 'smile',
  '😃': 'happy',
  '😌': 'calm',
  '🤔': 'think',
  '😤': 'fierce',
  '😣': 'hard',
  '😎': 'cool',
  '😴': 'sleepy',
  '😵': 'dizzy',
  '😕': 'confused',
  '🤩': 'starry',
  '🤫': 'shh',
  '🤷': 'shrug',
  '🙈': 'peek',
  '🧒': 'kid',
  '✨': 'sparkle',
  '⚡': 'bolt',
  '💀': 'skull',
  '⚔': 'swords',
  '🛡': 'shield',
  '🔁': 'repeat',
  '📌': 'pin',
  '📝': 'note',
  '✍': 'write',
  '🎲': 'dice',
  '👀': 'eyes',
  '👉': 'point',
  '🎙': 'mic',
  '🎓': 'grad',
  '⏳': 'hourglass',
  '📱': 'phone',
  '🧗': 'climb',
  '🌙': 'moon',
  '🔀': 'shuffle',
  '⏱': 'stopwatch',
  '👋': 'wave',
  '🍊': 'orange',
  '💬': 'chat',
  '📕': 'book',
  '🌱': 'sprout',
  '🚀': 'rocket',
  '📄': 'page',
  '🌎': 'globe',
  '🚧': 'barrier',
  '★': 'star',
  '🧠': 'brain',
  '❓': 'question',
  '🔍': 'search',
  '💪': 'muscle',
  '🎁': 'gift',
  '⏭': 'skip',
  '🟩': 'sqGreen',
  '🟥': 'sqRed',
  '🟨': 'sqYellow',
}
const RE = new RegExp(`(${Object.keys(EMOJI_FX).sort((a, b) => b.length - a.length).join('|')})️?`, 'gu')

/** Mostra um texto trocando qualquer emoji conhecido pelo ícone desenhado. */
export function FxText({ text, size }: { text: string | null | undefined; size?: number | string }) {
  if (!text) return null
  const parts = text.split(RE)
  if (parts.length === 1) return <>{text.replace(/️/g, '')}</>
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <Fx key={i} name={EMOJI_FX[p]} size={size} /> : <Fragment key={i}>{p.replace(/️/g, '')}</Fragment>))}
    </>
  )
}
