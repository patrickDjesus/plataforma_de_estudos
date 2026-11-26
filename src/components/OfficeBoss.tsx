/*
 * Gerentes do modo Empresarial: um homem e uma mulher desenhados, com cara de acordo com a entrega.
 * neutro (pisca), pensando (revisando), feliz (aprovou), chateado (errou), bravo (errou de novo).
 */

export type BossMood = 'neutro' | 'pensando' | 'feliz' | 'chateado' | 'bravo'
export type BossGender = 'm' | 'f'

const LOOK = {
  m: { skin: '#f1c7a1', shade: '#d9a57c', hair: '#3b2a20', suit: '#2f4b8f', suitDk: '#22386d', accent: '#e0483e' },
  f: { skin: '#b97a55', shade: '#9a603e', hair: '#241612', suit: '#9b2f55', suitDk: '#76203f', accent: '#ffc83d' },
}

/** Gênero do gerente: o que a IA disse; em projetos antigos, um palpite pelo primeiro nome. */
export const bossGender = (m: { name: string; gender?: BossGender }): BossGender => m.gender ?? (/a$/i.test(m.name.trim().split(/\s+/)[0] ?? '') ? 'f' : 'm')

export function Boss({ gender, mood, size = 96 }: { gender: BossGender; mood: BossMood; size?: number }) {
  const c = LOOK[gender]
  const ink = '#2a1d18'
  const lip = '#7a2730'
  const brow = { stroke: c.hair, strokeWidth: mood === 'bravo' ? 3.4 : 2.7, strokeLinecap: 'round' as const, fill: 'none' }
  const anim = mood === 'bravo' ? 'bs-shake' : mood === 'feliz' ? 'bs-bounce' : 'bs-breathe'
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" className="shrink-0 overflow-visible">
      <g className={anim}>
        {/* cabelo de trás (ela) */}
        {gender === 'f' && <path d="M30 52C27 26 43 13 60 13c18 0 33 12 30 39l3 34c-8 7-17 3-19-3H46c-2 6-11 10-19 3z" fill={c.hair} />}
        {/* corpo */}
        <path d="M16 121c2-24 19-35 44-35s42 11 44 35z" fill={c.suit} />
        <path d="M44 87l16 24 16-24c-5-1-10-1.5-16-1.5S49 86 44 87z" fill="#fff" />
        <path d="M44 87l-6 3 10 18 12 3zM76 87l6 3-10 18-12 3z" fill={c.suitDk} />
        {gender === 'm' ? <path d="M57 92h6l1.5 16L60 114l-4.5-6z" fill={c.accent} /> : <circle cx="60" cy="97" r="2.6" fill={c.accent} />}
        {/* pescoço, orelhas, rosto */}
        <rect x="51" y="70" width="18" height="18" rx="6" fill={c.shade} />
        <circle cx="35.5" cy="53" r="5.5" fill={c.skin} />
        <circle cx="84.5" cy="53" r="5.5" fill={c.skin} />
        <ellipse cx="60" cy="50" rx="25" ry="28" fill={c.skin} />
        {mood === 'bravo' && <ellipse className="bs-flush" cx="60" cy="50" rx="25" ry="28" fill="#ff2d20" />}
        {gender === 'f' && (
          <>
            <circle cx="35" cy="61" r="2.3" fill={c.accent} />
            <circle cx="85" cy="61" r="2.3" fill={c.accent} />
          </>
        )}
        {/* cabelo da frente */}
        {gender === 'm' ? (
          <path d="M34 47c-2-21 12-29 27-29 17 0 28 10 25 29-3-9-10-14-21-14-8 0-17-3-24 3-4 3-6 7-7 11z" fill={c.hair} />
        ) : (
          <path d="M35 45c1-17 14-25 27-24 14 1 24 11 23 25-6-8-15-13-26-12-9 1-17 5-24 11z" fill={c.hair} />
        )}

        {/* bochechas */}
        {(mood === 'feliz' || mood === 'bravo') && (
          <>
            <ellipse cx="43.5" cy="61" rx="4.5" ry="2.6" fill={mood === 'bravo' ? '#d81e1e' : '#ff8a8a'} opacity=".5" />
            <ellipse cx="76.5" cy="61" rx="4.5" ry="2.6" fill={mood === 'bravo' ? '#d81e1e' : '#ff8a8a'} opacity=".5" />
          </>
        )}

        {/* sobrancelhas */}
        {mood === 'neutro' && (
          <>
            <path d="M45 44q5-2 10 0" {...brow} />
            <path d="M65 44q5-2 10 0" {...brow} />
          </>
        )}
        {mood === 'feliz' && (
          <>
            <path d="M45 41.5q5-3.5 10 0" {...brow} />
            <path d="M65 41.5q5-3.5 10 0" {...brow} />
          </>
        )}
        {mood === 'chateado' && (
          <>
            <path d="M45 43.5l10 3" {...brow} />
            <path d="M65 46.5l10-3" {...brow} />
          </>
        )}
        {mood === 'bravo' && (
          <>
            <path d="M43.5 41l12.5 6" {...brow} />
            <path d="M64 47l12.5-6" {...brow} />
          </>
        )}
        {mood === 'pensando' && (
          <>
            <path d="M45 44.5q5-1.5 10 0" {...brow} />
            <path d="M65 41q5-3.5 10-.5" {...brow} />
          </>
        )}

        {/* olhos */}
        {mood === 'feliz' ? (
          <>
            <path d="M45.5 53.5q4.5-6 9 0" stroke={ink} strokeWidth="2.6" strokeLinecap="round" fill="none" />
            <path d="M65.5 53.5q4.5-6 9 0" stroke={ink} strokeWidth="2.6" strokeLinecap="round" fill="none" />
          </>
        ) : mood === 'pensando' ? (
          <>
            <circle cx="52.5" cy="50" r="2.7" fill={ink} />
            <circle cx="72.5" cy="50" r="2.7" fill={ink} />
          </>
        ) : mood === 'bravo' ? (
          <>
            <circle cx="50" cy="54" r="2.3" fill={ink} />
            <circle cx="70" cy="54" r="2.3" fill={ink} />
          </>
        ) : (
          <g className={mood === 'neutro' ? 'bs-blink' : undefined}>
            <circle cx="50" cy="53" r="2.8" fill={ink} />
            <circle cx="70" cy="53" r="2.8" fill={ink} />
          </g>
        )}
        {mood === 'chateado' && (
          <>
            <path d="M45.5 50.5h9" stroke={c.shade} strokeWidth="2.4" strokeLinecap="round" />
            <path d="M65.5 50.5h9" stroke={c.shade} strokeWidth="2.4" strokeLinecap="round" />
          </>
        )}
        {/* óculos (ele) */}
        {gender === 'm' && (
          <g fill="none" stroke="#2a2f3a" strokeWidth="1.7">
            <rect x="42.5" y="46" width="15" height="13" rx="4.5" />
            <rect x="62.5" y="46" width="15" height="13" rx="4.5" />
            <path d="M57.5 51.5q2.5-1.6 5 0" />
          </g>
        )}

        {/* boca */}
        {mood === 'neutro' && <path d="M52.5 66q7.5 5 15 0" stroke={lip} strokeWidth="2.4" strokeLinecap="round" fill="none" />}
        {mood === 'feliz' && (
          <>
            <path d="M49 63q11 15.5 22 0q-11 4-22 0z" fill={lip} />
            <path d="M51.5 64.2q8.5 3.4 17 0l-.6 1.9q-8 3-15.8 0z" fill="#fff" />
          </>
        )}
        {mood === 'chateado' && <path d="M52.5 69.5q7.5-5 15 0" stroke={lip} strokeWidth="2.4" strokeLinecap="round" fill="none" />}
        {mood === 'bravo' && (
          <g>
            <rect x="49.5" y="63.5" width="21" height="8" rx="3" fill="#fff" stroke={lip} strokeWidth="1.8" />
            <path d="M49.5 67.5h21M55 63.5v8M60 63.5v8M65 63.5v8" stroke={lip} strokeWidth="1.1" />
          </g>
        )}
        {mood === 'pensando' && <ellipse cx="64" cy="67.5" rx="2.6" ry="2.2" fill={lip} />}
      </g>

      {/* efeitos */}
      {mood === 'chateado' && <path className="bs-sweat" d="M86 34c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8z" fill="#8fd3ff" stroke="#4fa9e0" strokeWidth="1" />}
      {mood === 'bravo' && (
        <>
          <path className="bs-vein" d="M72 26q4 1 4 5M80 26q-4 1-4 5M72 38q4-1 4-5M80 38q-4-1-4-5" stroke="#e0201a" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <g className="bs-steam" fill="#fff" stroke="#d6dbe6" strokeWidth="1">
            <circle cx="30" cy="22" r="5" />
            <circle cx="25" cy="15" r="3.5" />
            <circle cx="92" cy="20" r="5" />
            <circle cx="97" cy="13" r="3.5" />
          </g>
          <g className="bs-curse">
            <path d="M96 30h22a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5h-14l-7 5 2-5h-3a5 5 0 0 1-5-5V35a5 5 0 0 1 5-5z" fill="#e0201a" />
            <text x="108" y="44.5" textAnchor="middle" fontFamily="Sora, sans-serif" fontSize="10" fontWeight="800" fill="#fff">
              #@!%
            </text>
          </g>
        </>
      )}
      {mood === 'pensando' && (
        <g className="bs-dots" fill="#8a93a8">
          <circle cx="94" cy="26" r="2.6" />
          <circle cx="102" cy="26" r="2.6" />
          <circle cx="110" cy="26" r="2.6" />
        </g>
      )}
      {mood === 'feliz' && (
        <g className="bs-spark" fill="#ffc83d">
          <path d="M98 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
          <path d="M20 30l1.4 3.4 3.4 1.4-3.4 1.4L20 40l-1.4-3.8-3.4-1.4 3.4-1.4z" />
        </g>
      )}
    </svg>
  )
}
