import { useEffect, useMemo, useRef, useState } from 'react'
import { Capybara } from '../../components/Capybara'
import type { RushState } from '../../lib/rush'
import { qHeat } from '../../lib/rush'
import { sfx } from './actions'

// ---------- Barramento de efeitos ----------
type FxEvent = { type: 'flash'; tone: 'ok' | 'bad' | 'gold' } | { type: 'fly'; text: string; from: [number, number] }
const fxL = new Set<(e: FxEvent) => void>()
export function fx(e: FxEvent) {
  fxL.forEach((f) => f(e))
}
function useFx(f: (e: FxEvent) => void) {
  const ref = useRef(f)
  ref.current = f
  useEffect(() => {
    const l = (e: FxEvent) => ref.current(e)
    fxL.add(l)
    return () => {
      fxL.delete(l)
    }
  }, [])
}

/** Número que conta subindo até o valor novo. */
export function useCountUp(value: number, ms = 700) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      setShown(Math.round(a + (value - a) * e))
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return shown
}

// ---------- Arena: fundo animado que esquenta com a dificuldade ----------
type Mood = 'calm' | 'warm' | 'hot' | 'boss'
export function arenaMood(S: RushState): Mood {
  const q = S.view === 'rush' ? S.current : null
  if (!q) return 'calm'
  if (q.boss) return 'boss'
  const h = qHeat(q)
  return h >= 0.7 ? 'hot' : h >= 0.45 ? 'warm' : 'calm'
}
const ARENA: Record<Mood, string> = {
  calm: 'linear-gradient(120deg, #e9eeff, #f4ecff, #e6fbf2, #fff4e2, #e9eeff)',
  warm: 'linear-gradient(120deg, #fff1e3, #ffe2d1, #fff3c9, #ffe6ef, #fff1e3)',
  hot: 'linear-gradient(120deg, #ffd6c2, #ffab92, #ffd0a0, #ff9fb0, #ffd6c2)',
  boss: 'linear-gradient(120deg, #1c0307, #5c0a18, #2a0409, #7a1020, #1c0307)',
}

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

export function Arena({ mood, onFire, children }: { mood: Mood; onFire: boolean; children: React.ReactNode }) {
  const embers = mood === 'hot' || mood === 'boss' || onFire
  const count = mood === 'boss' ? 34 : mood === 'hot' ? 22 : onFire ? 16 : 0
  const parts = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        left: rand(i + 1) * 100,
        size: 3 + rand(i + 50) * 6,
        dur: 5 + rand(i + 99) * 7,
        delay: -rand(i + 7) * 12,
        drift: (rand(i + 3) - 0.5) * 120,
      })),
    [],
  )
  const sparks = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: rand(i + 200) * 100,
        top: rand(i + 300) * 100,
        size: 10 + rand(i + 400) * 14,
        dur: 3 + rand(i + 500) * 4,
        delay: -rand(i + 600) * 5,
        ch: ['✦', '✧', '•', '★'][i % 4],
        color: ['#a9b8ff', '#ffb8d9', '#9be7c4', '#ffd27a'][i % 4],
      })),
    [],
  )
  return (
    <div className="essential-motion relative isolate overflow-hidden rounded-[32px] p-3 transition-colors duration-1000 sm:p-5" style={{ background: ARENA[mood] }}>
      <div className="rk-arena pointer-events-none absolute inset-0 -z-10" style={{ backgroundImage: ARENA[mood] }} />
      {/* vinheta e brilho de chão */}
      <div className={`pointer-events-none absolute inset-0 -z-10 ${mood === 'boss' ? 'rk-pulse bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,.55))]' : 'bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,.55),transparent_60%)]'}`} />
      {onFire && <div className="rk-pulse pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-[radial-gradient(ellipse_at_bottom,rgba(255,110,30,.35),transparent_70%)]" />}
      {/* faíscas calmas */}
      {!embers &&
        sparks.map((s, i) => (
          <span key={i} className="rk-spark -z-10" style={{ left: `${s.left}%`, top: `${s.top}%`, fontSize: s.size, color: s.color, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}>
            {s.ch}
          </span>
        ))}
      {/* brasas subindo */}
      {embers &&
        parts.slice(0, count).map((p, i) => (
          <span
            key={i}
            className="rk-ember -z-10"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              background: i % 3 ? '#ff7a1a' : '#ffd23c',
              boxShadow: `0 0 ${p.size * 2}px ${i % 3 ? '#ff5a00' : '#ffb300'}`,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              ['--drift' as string]: `${p.drift}px`,
            }}
          />
        ))}
      {children}
    </div>
  )
}

// ---------- Flash de tela e pontos voando ----------
export function FxLayer() {
  const [flash, setFlash] = useState<{ k: number; tone: 'ok' | 'bad' | 'gold' } | null>(null)
  const [flies, setFlies] = useState<{ k: number; text: string; x: number; y: number; dx: number; dy: number }[]>([])
  useFx((e) => {
    if (e.type === 'flash') setFlash({ k: Date.now(), tone: e.tone })
    if (e.type === 'fly') {
      const target = document.getElementById('rush-score')?.getBoundingClientRect()
      const [x, y] = e.from
      const tx = target ? target.left + target.width / 2 : innerWidth - 120
      const ty = target ? target.top + target.height / 2 : 40
      const k = Date.now() + Math.random()
      setFlies((l) => [...l, { k, text: e.text, x, y, dx: tx - x, dy: ty - y }])
      window.setTimeout(() => setFlies((l) => l.filter((f) => f.k !== k)), 1000)
    }
  })
  const color = flash?.tone === 'ok' ? 'rgba(34,181,115,.35)' : flash?.tone === 'bad' ? 'rgba(255,60,90,.35)' : 'rgba(255,201,60,.45)'
  return (
    <>
      {flash && <div key={flash.k} className="rk-flash pointer-events-none fixed inset-0 z-[66]" style={{ background: `radial-gradient(ellipse at center, transparent 35%, ${color})` }} />}
      {flies.map((f) => (
        <span
          key={f.k}
          className="rk-fly pointer-events-none fixed z-[67] font-display text-2xl font-extrabold text-amber-400 [paint-order:stroke_fill] [-webkit-text-stroke:2px_#16181d]"
          style={{ left: f.x - 30, top: f.y - 16, ['--dx' as string]: `${f.dx}px`, ['--dy' as string]: `${f.dy}px` }}
        >
          {f.text}
        </span>
      ))}
    </>
  )
}

// ---------- Raios girando (atrás de letreiros e da Capi) ----------
export function Rays({ color = 'rgba(255,210,60,.45)', size = 260, className = '' }: { color?: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`rk-rays pointer-events-none absolute top-1/2 left-1/2 -z-10 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        background: `repeating-conic-gradient(${color} 0deg 10deg, transparent 10deg 24deg)`,
        maskImage: 'radial-gradient(circle, #000 20%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(circle, #000 20%, transparent 70%)',
      }}
    />
  )
}

// ---------- Entrada do chefão ----------
export function BossIntro({ S }: { S: RushState }) {
  const q = S.current
  const seen = useRef<string | null>(null)
  const [show, setShow] = useState<string | null>(null)
  useEffect(() => {
    if (q?.boss && S.phase === 'answer' && S.view === 'rush' && seen.current !== q.id) {
      seen.current = q.id
      setShow(q.id)
      sfx('boss')
      const t = window.setTimeout(() => setShow(null), 2200)
      return () => window.clearTimeout(t)
    }
  }, [q?.id, q?.boss, S.phase, S.view])
  if (!show) return null
  return (
    <button type="button" onClick={() => setShow(null)} className="rush-delay-out fixed inset-0 z-[74] grid cursor-pointer place-items-center overflow-hidden bg-[radial-gradient(circle,#5c0a18,#16020a)] text-center" aria-label="Fechar">
      <span className="rk-quake relative isolate flex flex-col items-center">
        <Rays color="rgba(255,60,40,.5)" size={720} />
        <span className="rk-boss-in">
          <Capybara pose="focado" size={150} />
        </span>
        <span className="rk-boss-in font-display text-[clamp(44px,10vw,96px)] leading-none font-extrabold text-rose-100 [paint-order:stroke_fill] [-webkit-text-stroke:4px_#3a0a12]" style={{ animationDelay: '.15s' }}>
          ⚔️ CHEFÃO
        </span>
        <span className="rk-boss-in mt-2 text-lg font-bold text-rose-200" style={{ animationDelay: '.3s' }}>
          Vale 3x os pontos. Lê duas vezes e vai com tudo!
        </span>
      </span>
    </button>
  )
}

// ---------- Medidor de combo ----------
export function ComboMeter({ streak, best }: { streak: number; best: number }) {
  const segs = 10
  const filled = Math.min(segs, streak)
  const mult = (1 + Math.min(Math.max(streak - 1, 0), 9) / 10).toFixed(1)
  const hot = streak >= 5
  return (
    <span key={streak} title={`Combo atual: ${streak} (recorde ${best})`} className={`rush-bump flex items-center gap-2 rounded-full py-1 pr-3 pl-1.5 ${hot ? 'rk-glow-pulse bg-gradient-to-r from-orange-500 to-rose-500 text-white' : 'bg-[#f1f2f5]'}`}>
      <span className={`grid h-7 w-7 place-items-center rounded-full ${hot ? 'bg-white/20' : 'bg-white'}`} style={{ fontSize: 14 + Math.min(streak, 10) }}>
        <span className={streak >= 3 ? 'rk-flame' : ''}>{streak >= 3 ? '🔥' : '✨'}</span>
      </span>
      <span className="leading-none">
        <span className="block font-display text-sm font-extrabold tabular-nums">
          {streak} <span className={`text-[11px] ${hot ? 'text-white/80' : 'text-muted'}`}>x{mult}</span>
        </span>
        <span className="mt-0.5 flex gap-[2px]">
          {Array.from({ length: segs }, (_, i) => (
            <i key={i} className={`block h-1.5 w-2 rounded-sm transition-colors ${i < filled ? (hot ? 'bg-amber-200' : 'bg-orange-400') : hot ? 'bg-white/25' : 'bg-slate-300/70'}`} />
          ))}
        </span>
      </span>
    </span>
  )
}
