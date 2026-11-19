import { useEffect, useMemo, useRef, useState } from 'react'
import { Capybara } from '../../components/Capybara'
import type { RushState } from '../../lib/rush'
import { qHeat } from '../../lib/rush'
import { sfx } from './actions'
import { FireCanvas } from './FireCanvas'

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

// ---------- Arena: escurece e fica ameaçadora conforme a dificuldade ----------
/** "Calor" do momento (0–1). Fora da questão, a arena fica calma. */
export function arenaHeat(S: RushState): number {
  const q = S.view === 'rush' ? S.current : null
  return q ? qHeat(q) : 0
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
function mixHex(a: string, b: string, t: number) {
  const [x, y] = [hex(a), hex(b)]
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`
}
/** Claro e limpo até a média; daí escurece até um quase-preto avermelhado. */
const STOPS: [number, string][] = [
  [0, '#eef0f5'],
  [0.35, '#e6e8ee'],
  [0.5, '#2c2f38'],
  [0.65, '#1d1a20'],
  [0.8, '#160b0e'],
  [1, '#0b0204'],
]
export function arenaColor(h: number) {
  for (let i = 1; i < STOPS.length; i++)
    if (h <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1]
      const [b, cb] = STOPS[i]
      return mixHex(ca, cb, (h - a) / (b - a))
    }
  return STOPS[STOPS.length - 1][1]
}
export const isDark = (h: number) => h >= 0.45

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

export function Arena({ heat, boss, onFire, children }: { heat: number; boss: boolean; onFire: boolean; children: React.ReactNode }) {
  const h = boss ? 1 : heat
  const glow = Math.max(0, Math.min(1, (h - 0.4) / 0.6))
  const embers = boss ? 30 : h >= 0.6 ? Math.round((h - 0.5) * 50) : onFire ? 8 : 0
  // fogo de verdade: começa na "Puxada" (6) e vira incêndio no chefão
  const fire = boss ? 1 : h >= 0.55 ? Math.min(1, (h - 0.5) / 0.5) : onFire ? 0.22 : 0
  const parts = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        left: rand(i + 1) * 100,
        size: 2 + rand(i + 50) * 3.5,
        dur: 7 + rand(i + 99) * 8,
        delay: -rand(i + 7) * 14,
        drift: (rand(i + 3) - 0.5) * 90,
      })),
    [],
  )
  return (
    <div className="essential-motion relative isolate overflow-hidden rounded-[32px] p-3 transition-[background-color] duration-[1200ms] sm:p-5" style={{ backgroundColor: arenaColor(h) }}>
      {/* brilho vermelho que sobe do chão */}
      <div
        className={`pointer-events-none absolute inset-0 -z-10 transition-opacity duration-1000 ${h >= 0.8 ? 'rk-heartbeat' : ''}`}
        style={{ opacity: glow, background: 'radial-gradient(120% 70% at 50% 110%, rgba(190,20,30,.55), rgba(120,10,20,.18) 45%, transparent 70%)' }}
      />
      {/* vinheta que vai fechando */}
      <div className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-1000" style={{ opacity: glow, background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,.6))' }} />
      {/* chefão: relâmpago vermelho de vez em quando */}
      {boss && <div className="rk-flicker pointer-events-none absolute inset-0 -z-10 bg-[rgba(255,40,40,.18)]" />}
      {/* combo em chamas: calor laranja embaixo */}
      {onFire && <div className="rk-pulse pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-[radial-gradient(ellipse_at_bottom,rgba(255,110,30,.28),transparent_70%)]" />}
      <FireCanvas intensity={fire} />
      {/* brasas */}
      {parts.slice(0, embers).map((p, i) => (
        <span
          key={i}
          className="rk-ember -z-10"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: i % 3 ? '#ff4a1a' : '#ffb347',
            boxShadow: `0 0 ${p.size * 3}px ${i % 3 ? '#ff2a00' : '#ff8a00'}`,
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

// ---------- Flash de borda e pontos voando ----------
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
  const color = flash?.tone === 'ok' ? 'rgba(34,181,115,.28)' : flash?.tone === 'bad' ? 'rgba(220,30,50,.32)' : 'rgba(255,190,60,.32)'
  return (
    <>
      {flash && <div key={flash.k} className="rk-flash pointer-events-none fixed inset-0 z-[66]" style={{ background: `radial-gradient(ellipse at center, transparent 50%, ${color})` }} />}
      {flies.map((f) => (
        <span
          key={f.k}
          className="rk-fly pointer-events-none fixed z-[67] rounded-full bg-[#16181d] px-2.5 py-0.5 font-display text-sm font-bold text-amber-300 shadow-lg"
          style={{ left: f.x - 24, top: f.y - 12, ['--dx' as string]: `${f.dx}px`, ['--dy' as string]: `${f.dy}px` }}
        >
          {f.text}
        </span>
      ))}
    </>
  )
}

/** Anel que se expande (atrás da Capi quando acerta). */
export function Ring({ color = 'rgba(34,181,115,.5)', size = 120 }: { color?: string; size?: number }) {
  return <span aria-hidden className="rk-ring pointer-events-none absolute top-1/2 left-1/2 -z-10 rounded-full border-4" style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, borderColor: color }} />
}

// ---------- Faixa de destaque (combo, nível, chefão derrotado…) ----------
export function Banner({ text, k }: { text: string; k: number }) {
  const [icon, ...rest] = text.split(' ')
  const hasIcon = /\p{Extended_Pictographic}/u.test(icon)
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[18%] z-[75] flex justify-center px-4">
      <div key={k} className="rk-banner flex items-center gap-3 rounded-2xl border border-white/10 bg-[#16181d]/92 px-6 py-3.5 text-white shadow-[0_20px_50px_-15px_rgba(0,0,0,.6)] backdrop-blur">
        {hasIcon && <span className="text-3xl">{icon}</span>}
        <div>
          <div className="font-display text-2xl leading-none font-extrabold tracking-wide uppercase sm:text-3xl">{hasIcon ? rest.join(' ') : text}</div>
          <div className="mt-2 h-[3px] w-16 rounded-full bg-gradient-to-r from-amber-400 to-orange-500" />
        </div>
      </div>
    </div>
  )
}

// ---------- Entrada do chefão (cinema) ----------
export function BossIntro({ S }: { S: RushState }) {
  const q = S.current
  const seen = useRef<string | null>(null)
  const [show, setShow] = useState<string | null>(null)
  useEffect(() => {
    if (q?.boss && S.phase === 'answer' && S.view === 'rush' && seen.current !== q.id) {
      seen.current = q.id
      setShow(q.id)
      sfx('boss')
      const t = window.setTimeout(() => setShow(null), 2400)
      return () => window.clearTimeout(t)
    }
  }, [q?.id, q?.boss, S.phase, S.view])
  if (!show) return null
  return (
    <button type="button" onClick={() => setShow(null)} className="rush-delay-out fixed inset-0 z-[74] cursor-pointer overflow-hidden bg-[radial-gradient(ellipse_at_center,#3a0610,#070102_70%)]" aria-label="Fechar">
      <span className="rk-letterbox-top absolute inset-x-0 top-0 h-[14vh] bg-black" />
      <span className="rk-letterbox-bottom absolute inset-x-0 bottom-0 h-[14vh] bg-black" />
      <span className="rk-heartbeat absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_60%,rgba(200,20,30,.45),transparent)]" />
      <span className="rk-quake relative flex h-full flex-col items-center justify-center text-center">
        <span className="rk-boss-in opacity-90">
          <Capybara pose="focado" size={130} />
        </span>
        <span className="rk-slam mt-2 font-display text-[clamp(46px,10vw,104px)] leading-none font-extrabold text-white [text-shadow:0_0_40px_rgba(255,40,50,.65)]">CHEFÃO</span>
        <span className="rk-boss-in mt-4 text-sm font-semibold tracking-[.3em] text-rose-200/80 uppercase" style={{ animationDelay: '.45s' }}>
          vale 3x os pontos · leia duas vezes
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
    <span key={streak} title={`Combo atual: ${streak} (recorde ${best})`} className={`rush-bump flex items-center gap-2 rounded-full py-1 pr-3 pl-1.5 transition-colors ${hot ? 'bg-[#16181d] text-white shadow-[0_0_18px_-2px_rgba(255,120,30,.6)]' : 'bg-[#f1f2f5]'}`}>
      <span className={`grid h-7 w-7 place-items-center rounded-full text-[15px] ${hot ? 'bg-orange-500/20' : 'bg-white'}`}>
        <span className={streak >= 3 ? 'rk-flame' : 'opacity-40 grayscale'}>🔥</span>
      </span>
      <span className="leading-none">
        <span className="block font-display text-sm font-extrabold tabular-nums">
          {streak} <span className={`text-[11px] font-bold ${hot ? 'text-orange-300' : 'text-muted'}`}>x{mult}</span>
        </span>
        <span className="mt-1 flex gap-[2px]">
          {Array.from({ length: segs }, (_, i) => (
            <i key={i} className={`block h-1 w-2 rounded-sm transition-colors ${i < filled ? 'bg-orange-500' : hot ? 'bg-white/15' : 'bg-slate-300/70'}`} />
          ))}
        </span>
      </span>
    </span>
  )
}
