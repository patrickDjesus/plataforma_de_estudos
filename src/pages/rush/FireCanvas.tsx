import { useEffect, useRef } from 'react'

/*
 * Fogo de verdade em canvas: partículas que sobem do "chão" da parte visível da arena
 * e, nas questões mais difíceis, também das bordas do cartão da questão.
 * Cor por idade (branco-amarelo → laranja → vermelho), mistura aditiva e turbulência.
 */
interface P {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  r: number
  seed: number
}

const STAGES = [
  ['rgba(255,236,170,.9)', 'rgba(255,180,50,.6)', 'rgba(255,120,10,0)'],
  ['rgba(255,170,50,.85)', 'rgba(255,100,15,.55)', 'rgba(230,50,0,0)'],
  ['rgba(240,80,20,.7)', 'rgba(190,30,10,.45)', 'rgba(130,10,0,0)'],
  ['rgba(170,30,15,.4)', 'rgba(100,10,10,.22)', 'rgba(50,0,0,0)'],
]

function sprites() {
  return STAGES.map(([a, b, c]) => {
    const s = document.createElement('canvas')
    s.width = s.height = 64
    const g = s.getContext('2d')!
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, a)
    grad.addColorStop(0.4, b)
    grad.addColorStop(1, c)
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    return s
  })
}

export function FireCanvas({ intensity, cardId = 'rush-card' }: { intensity: number; cardId?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const level = useRef(intensity)
  level.current = intensity
  const raf = useRef(0)

  useEffect(() => {
    const cv = ref.current
    if (!cv || intensity <= 0) return
    const host = cv.parentElement!
    const ctx = cv.getContext('2d')!
    const spr = sprites()
    const parts: P[] = []
    let W = 0
    let H = 0
    let last = performance.now()
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)

    const frame = (now: number) => {
      const dt = Math.min(50, now - last) / 16.7
      last = now
      // o canvas cobre só a parte visível da arena (acompanha a rolagem)
      const hr = host.getBoundingClientRect()
      const top = Math.max(0, -hr.top)
      const bottom = Math.min(hr.height, innerHeight - hr.top)
      const h = Math.max(0, bottom - top)
      if (Math.round(hr.width) !== W || Math.round(h) !== H) {
        W = Math.round(hr.width)
        H = Math.round(h)
        cv.width = W * dpr
        cv.height = H * dpr
        cv.style.width = W + 'px'
        cv.style.height = H + 'px'
      }
      cv.style.top = top + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const k = level.current
      // parede de fogo no chão
      const rate = k * (W / 16) * dt
      for (let i = 0; i < rate; i++) {
        const big = Math.random() < 0.3
        parts.push({ x: Math.random() * W, y: H + 14, vx: (Math.random() - 0.5) * 0.5, vy: -(2 + Math.random() * 2.8) * (0.7 + k * 0.5), life: 0, max: 30 + Math.random() * 40 * (0.5 + k), r: (big ? 18 : 9) + Math.random() * 12 * (0.6 + k), seed: Math.random() * 100 })
      }
      // bordas do cartão pegando fogo (muito difícil / chefão)
      const card = document.getElementById(cardId)
      if (card && k >= 0.55) {
        const cr = card.getBoundingClientRect()
        const ox = cr.left - hr.left
        const oy = cr.top - hr.top - top
        const edge = (k - 0.45) * 2.2 * dt
        for (let i = 0; i < edge * 7; i++) {
          const side = Math.random()
          let x: number
          let y: number
          if (side < 0.6) {
            x = ox + Math.random() * cr.width
            y = oy + 6
          } else if (side < 0.8) {
            x = ox + 4
            y = oy + Math.random() * cr.height
          } else {
            x = ox + cr.width - 4
            y = oy + Math.random() * cr.height
          }
          parts.push({ x, y, vx: (Math.random() - 0.5) * 0.4, vy: -(1.6 + Math.random() * 2.2), life: 0, max: 14 + Math.random() * 16, r: 4 + Math.random() * 6, seed: Math.random() * 100 })
        }
      }

      ctx.globalCompositeOperation = 'lighter'
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.life += dt
        const t = p.life / p.max
        if (t >= 1 || p.y < -60) {
          parts.splice(i, 1)
          continue
        }
        p.vx += Math.sin(p.y * 0.025 + now * 0.004 + p.seed) * 0.06 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy *= 0.995
        const size = p.r * (1 - t * 0.75)
        const stage = t < 0.15 ? 0 : t < 0.4 ? 1 : t < 0.7 ? 2 : 3
        ctx.globalAlpha = Math.min(1, (1 - t) * 1.25) * 0.85
        // língua de fogo: estreita e alta, mais alongada quanto mais rápido sobe
        const w = size * 1.1
        const hh = size * (2.2 + Math.min(1.5, -p.vy * 0.25))
        ctx.drawImage(spr[stage], p.x - w / 2, p.y - hh * 0.7, w, hh)
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      if (parts.length > 1400) parts.splice(0, parts.length - 1400)
      if (level.current > 0 || parts.length) raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf.current)
  }, [intensity > 0, cardId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (intensity <= 0) return null
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute left-0 -z-10" style={{ top: 0, mixBlendMode: 'screen' }} />
}
