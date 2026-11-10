import type { AreaId } from '../db/types'

/** Família de matiz por área: a cor da matéria nasce dentro da faixa da área. */
const AREA_HUES: Record<AreaId, number[]> = {
  faculdade: [228, 262, 205, 285, 245, 190],
  ensino: [12, 32, 345, 48, 322, 0],
  idiomas: [150, 170, 120, 135, 160, 95],
}

export const AREA_COLOR: Record<AreaId, string> = {
  faculdade: '#4f46e5',
  ensino: '#f97316',
  idiomas: '#10b981',
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`
}

export function autoColor(areaId: AreaId, index: number): string {
  const hues = AREA_HUES[areaId]
  const hue = hues[index % hues.length]
  const light = index >= hues.length ? 44 : 52
  return hslToHex(hue, 78, light)
}

/** Fundo claro (tinta) da cor, para chips e destaques. */
export function tint(hex: string, alpha = 0.14): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
