/** Sons curtinhos (Web Audio) e confete em canvas, usados no Rush. */
type Note = [freq: number, at: number, dur: number, type: OscillatorType]
const SEQS: Record<string, Note[]> = {
  ok: [[660, 0, 0.12, 'triangle'], [880, 0.09, 0.14, 'triangle'], [1320, 0.18, 0.22, 'triangle']],
  bad: [[300, 0, 0.16, 'sine'], [210, 0.14, 0.3, 'sine']],
  pop: [[740, 0, 0.06, 'sine']],
  big: [[523, 0, 0.12, 'triangle'], [659, 0.1, 0.12, 'triangle'], [784, 0.2, 0.12, 'triangle'], [1047, 0.3, 0.35, 'triangle']],
  whoosh: [[400, 0, 0.08, 'sine'], [600, 0.05, 0.1, 'sine']],
  badge: [[880, 0, 0.15, 'sine'], [1174, 0.12, 0.25, 'sine'], [1760, 0.28, 0.4, 'triangle']],
  shield: [[180, 0, 0.18, 'square'], [240, 0.1, 0.25, 'triangle'], [360, 0.2, 0.3, 'triangle']],
  zap: [[1400, 0, 0.06, 'sawtooth'], [900, 0.05, 0.06, 'sawtooth'], [500, 0.1, 0.12, 'sawtooth']],
  boss: [[70, 0, 0.3, 'sine'], [70, 0.35, 0.3, 'sine'], [55, 0.7, 0.6, 'sine'], [110, 0.75, 0.5, 'sawtooth']],
  skip: [[600, 0, 0.06, 'sine'], [900, 0.05, 0.06, 'sine'], [1300, 0.1, 0.1, 'sine']],
  blip: [[1500, 0, 0.03, 'sine']],
  gift: [[988, 0, 0.1, 'triangle'], [1319, 0.1, 0.1, 'triangle'], [1568, 0.2, 0.25, 'triangle']],
}
export type Sfx = keyof typeof SEQS

let actx: AudioContext | null = null
export function playSfx(kind: Sfx) {
  try {
    actx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const now = actx.currentTime
    for (const [f, t, d, type] of SEQS[kind] ?? []) {
      const o = actx.createOscillator()
      const g = actx.createGain()
      o.type = type
      o.frequency.value = f
      g.gain.setValueAtTime(0, now + t)
      g.gain.linearRampToValueAtTime(kind === 'blip' ? 0.05 : kind === 'boss' ? 0.3 : 0.16, now + t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, now + t + d)
      o.connect(g).connect(actx.destination)
      o.start(now + t)
      o.stop(now + t + d + 0.05)
    }
  } catch {
    /* sem som */
  }
}

// ---------- Confete ----------
interface P {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  rot: number
  vr: number
  c: string
  life: number
  star: boolean
}
let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let parts: P[] = []
let raf = 0
const COLORS = ['#3e63f2', '#22b573', '#ffc93c', '#ffffff', '#7c8cff']

function ensureCanvas() {
  if (canvas) return
  canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '80' })
  document.body.appendChild(canvas)
  ctx = canvas.getContext('2d')
  const size = () => {
    const d = window.devicePixelRatio || 1
    canvas!.width = innerWidth * d
    canvas!.height = innerHeight * d
    ctx!.setTransform(d, 0, 0, d, 0, 0)
  }
  size()
  addEventListener('resize', size)
}

function tick() {
  if (!ctx) return
  ctx.clearRect(0, 0, innerWidth, innerHeight)
  parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 40)
  for (const p of parts) {
    p.vy += 0.25
    p.vx *= 0.99
    p.x += p.vx
    p.y += p.vy
    p.rot += p.vr
    p.life--
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.globalAlpha = Math.min(1, p.life / 30)
    ctx.fillStyle = p.c
    if (p.star) {
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? p.r * 0.45 : p.r
        const a = (i * Math.PI) / 5 - Math.PI / 2
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
      }
      ctx.closePath()
      ctx.fill()
    } else ctx.fillRect(-p.r / 2, -p.r / 3, p.r, p.r * 0.66)
    ctx.restore()
  }
  raf = parts.length ? requestAnimationFrame(tick) : 0
}

/** Estoura confete a partir de um ponto da tela. */
export function confetti(x: number, y: number, n = 50, colors = COLORS) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) n = Math.min(n, 12)
  ensureCanvas()
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const sp = 3 + Math.random() * 7
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, r: 6 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: colors[i % colors.length], life: 70 + Math.random() * 40, star: Math.random() < 0.3 })
  }
  if (!raf) raf = requestAnimationFrame(tick)
}

export function centerOf(el: Element | null): [number, number] {
  if (!el) return [innerWidth / 2, innerHeight / 3]
  const r = el.getBoundingClientRect()
  return [r.left + r.width / 2, r.top + r.height / 2]
}
