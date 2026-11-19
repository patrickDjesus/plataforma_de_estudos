import { useEffect, useRef, useState } from 'react'
import { centerOf, confetti } from '../lib/sfx'

const SEEN = 'mendonca-level-seen'
const read = (): { level: number; xp: number } | null => {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? 'null')
  } catch {
    return null
  }
}
const write = (v: { level: number; xp: number }) => {
  try {
    localStorage.setItem(SEEN, JSON.stringify(v))
  } catch {
    /* sem armazenamento: só não lembra entre visitas */
  }
}

/** Número que sobe contando até o valor novo. */
function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      setV(Math.round(a + (target - a) * e))
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

/**
 * Caixa de nível e XP do Início: anel girando no nível, faíscas, brilho passando, barra com listras
 * andando e ponta luminosa, "+XP" flutuando quando ganha pontos e comemoração ao subir de nível.
 */
export function LevelCard({ level, inLevel, needed, progress, totalXp }: { level: number; inLevel: number; needed: number; progress: number; totalXp: number }) {
  const box = useRef<HTMLDivElement>(null)
  const xp = useCountUp(inLevel)
  const [gain, setGain] = useState<{ n: number; key: number } | null>(null)
  const [leveled, setLeveled] = useState(false)
  const [bar, setBar] = useState(progress)
  const near = progress >= 0.85

  // Compara com o que você viu da última vez: mostra o "+XP" e comemora a subida de nível
  useEffect(() => {
    const seen = read()
    write({ level, xp: totalXp })
    if (!seen) return
    if (totalXp > seen.xp) setGain({ n: totalXp - seen.xp, key: Date.now() })
    if (level > seen.level) {
      setLeveled(true)
      setBar(1)
      const t1 = window.setTimeout(() => {
        const [x, y] = centerOf(box.current)
        confetti(x, y, 70, ['#ffd34d', '#ff8a3d', '#ffffff', '#7c9bff'])
        setBar(progress)
      }, 700)
      const t2 = window.setTimeout(() => setLeveled(false), 3200)
      return () => {
        window.clearTimeout(t1)
        window.clearTimeout(t2)
      }
    }
    setBar(progress)
  }, [level, totalXp, progress])

  useEffect(() => {
    if (!gain) return
    const t = window.setTimeout(() => setGain(null), 2200)
    return () => window.clearTimeout(t)
  }, [gain])

  return (
    <div ref={box} className="relative w-56 shrink-0">
    <div
      className={`essential-motion lv-card relative flex w-56 items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-white shadow-[0_10px_24px_-12px_rgba(62,99,242,0.9)] ${leveled ? 'lv-pop' : ''}`}
      title={`Nível ${level}: ${inLevel} de ${needed} XP`}
    >
      {/* brilho que atravessa a caixa */}
      <span className="lv-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent" />

      {/* selo do nível com anel girando */}
      <div className="relative grid h-11 w-11 shrink-0 place-items-center">
        <span className={`lv-ring absolute inset-0 rounded-full ${near || leveled ? 'lv-ring-hot' : ''}`} />
        <span className="absolute inset-[3px] rounded-full bg-gradient-to-br from-[#ffb648] to-[#ff7a2f]" />
        <span key={level} className="lv-num relative grid h-8 w-8 place-items-center rounded-full bg-white font-display text-base font-extrabold text-[#3e63f2] shadow-inner">
          {level}
        </span>
        {/* faíscas em volta */}
        {[
          ['-top-1 -right-0.5', 0],
          ['-bottom-0.5 -left-1', 0.9],
          ['top-1 -left-1.5', 1.7],
        ].map(([pos, d]) => (
          <span key={String(pos)} className={`lv-spark absolute ${pos}`} style={{ animationDelay: `${d}s` }} />
        ))}
      </div>

      <div className="relative flex-1">
        <div className="mb-1.5 flex items-baseline justify-end gap-1 text-sm font-bold tabular-nums">
          {leveled ? <span className="lv-up mr-auto text-[11px] font-extrabold tracking-wide text-[#ffe08a] uppercase">Subiu!</span> : null}
          {xp} <span className="text-xs font-semibold text-white/70">/ {needed} XP</span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-white/25">
          <div className="lv-fill relative h-full rounded-full" style={{ width: `${Math.max(4, bar * 100)}%` }}>
            <span className="lv-tip absolute top-1/2 right-0 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-white" />
          </div>
        </div>
      </div>
    </div>
      {gain && (
        <span key={gain.key} className="lv-gain pointer-events-none absolute -top-2.5 right-3 z-10 rounded-full bg-[#ffd34d] px-2 py-0.5 text-[11px] font-extrabold text-[#7a4a00] shadow">
          +{gain.n} XP
        </span>
      )}
    </div>
  )
}
