/**
 * Rank estético do Mendonça (estilo "elo"): Ferro → Bronze → Prata → Ouro → Platina → Diamante → Mestre.
 * Sobe com estudo cumprido e cai um pouco com blocos perdidos. Não afeta o planejamento.
 */
export const TIERS = [
  { id: 'ferro', name: 'Ferro', size: 100, light: '#c3c8cf', dark: '#5b6069' },
  { id: 'bronze', name: 'Bronze', size: 100, light: '#f0a86a', dark: '#8a4f22' },
  { id: 'prata', name: 'Prata', size: 150, light: '#f3f6fa', dark: '#8794a6' },
  { id: 'ouro', name: 'Ouro', size: 150, light: '#ffe08a', dark: '#c48a12' },
  { id: 'platina', name: 'Platina', size: 200, light: '#9ff0e1', dark: '#21907f' },
  { id: 'diamante', name: 'Diamante', size: 200, light: '#b5d3ff', dark: '#4466f0' },
  { id: 'mestre', name: 'Mestre', size: Infinity, light: '#d9b8ff', dark: '#6d2fe0' },
] as const

export type TierId = (typeof TIERS)[number]['id']
const DIVS = ['III', 'II', 'I'] as const
/** Posições na escada: 6 ranks × 3 divisões + Mestre. */
export const MASTER_POS = (TIERS.length - 1) * 3

export const POINTS = {
  block: 10,
  review: 8,
  challengeMax: 10,
  challengeBonus: 5,
  cardPerDay: 10,
  /** Questões feitas por fora: +1 a cada 2, até +10 por bloco; +3 com 80%+ de acerto. */
  questionsMax: 10,
  questionsBonus: 3,
  missed: -6,
  goodWeek: 25,
  badWeek: -15,
}

export interface RankPos {
  pos: number // 0 = Ferro III … MASTER_POS = Mestre
  points: number
}

export const tierOf = (pos: number) => TIERS[Math.min(TIERS.length - 1, Math.floor(pos / 3))]
export const divisionOf = (pos: number) => (pos >= MASTER_POS ? '' : DIVS[pos % 3])
export const sizeOf = (pos: number) => tierOf(pos).size
export const rankName = (pos: number) => (pos >= MASTER_POS ? 'Mestre' : `${tierOf(pos).name} ${divisionOf(pos)}`)

export interface RankEvent {
  at: number
  delta: number
  label: string
}

export interface RankLogEntry extends RankEvent {
  after: RankPos
  change?: 'subiu' | 'caiu'
}

export interface RankState extends RankPos {
  best: RankPos
  log: RankLogEntry[]
}

/** Aplica um ganho/perda. Ao chegar a 0, o escudo segura; só a próxima perda rebaixa. */
export function applyDelta(r: RankPos, delta: number): RankPos & { change?: 'subiu' | 'caiu' } {
  let { pos, points } = r
  if (delta >= 0) {
    points += delta
    let up = false
    while (pos < MASTER_POS && points >= sizeOf(pos)) {
      points -= sizeOf(pos)
      pos++
      up = true
    }
    return { pos, points, change: up ? 'subiu' : undefined }
  }
  if (points > 0) return { pos, points: Math.max(0, points + delta) }
  if (pos === 0) return { pos, points: 0 }
  const lower = pos - 1
  return { pos: lower, points: Math.round(sizeOf(lower) * 0.75), change: 'caiu' }
}

const better = (a: RankPos, b: RankPos) => a.pos > b.pos || (a.pos === b.pos && a.points > b.points)

export function rankFromEvents(events: RankEvent[]): RankState {
  let cur: RankPos = { pos: 0, points: 0 }
  let best = cur
  const log: RankLogEntry[] = []
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    if (!e.delta) continue
    const next = applyDelta(cur, e.delta)
    cur = { pos: next.pos, points: next.points }
    if (better(cur, best)) best = cur
    log.push({ ...e, after: cur, change: next.change })
  }
  return { ...cur, best, log }
}

/** Pontos de um desafio: proporcional à nota, com bônus por 85% ou mais. */
/** Pontos das questões informadas num bloco. */
export function questionPoints(n: number, correct?: number) {
  if (n <= 0) return 0
  const bonus = correct !== undefined && correct / n >= 0.8 ? POINTS.questionsBonus : 0
  return Math.min(POINTS.questionsMax, Math.ceil(n / 2)) + bonus
}

export const challengePoints = (score: number) => Math.round(Math.max(0, Math.min(1, score)) * POINTS.challengeMax) + (score >= 0.85 ? POINTS.challengeBonus : 0)

/** Bônus/penalidade da semana encerrada, pela fração do plano cumprida. */
export const weekPoints = (rate: number) => (rate >= 0.8 ? POINTS.goodWeek : rate < 0.3 ? POINTS.badWeek : 0)
