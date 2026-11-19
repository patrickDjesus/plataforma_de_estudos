import type { Challenge, Flashcard, Review, ReviewRating, Session, Topic } from '../db/types'

/**
 * Domínio de um tópico (0–100):
 * desafios e questões 50% · revisões e flashcards 25% · autoavaliação 15% · tempo estudado 10%
 * (partes sem dados ficam de fora e o resto é reescalado; sem desafios, no máximo 70%).
 * Erros não resolvidos descontam; sem revisão o domínio cai devagar (até a metade em ~3 meses).
 */
export const WEIGHTS = { challenges: 0.5, reviews: 0.25, confidence: 0.15, time: 0.1 }
export const FULL_TIME_SECONDS = 90 * 60
export const ERROR_PENALTY = 8
export const MAX_ERROR_PENALTY = 30
export const NO_CHALLENGE_CAP = 70

const RATING_VALUE: Record<ReviewRating, number> = { dificil: 0.2, ok: 0.7, facil: 1 }
const DAY = 86400000

export interface MasteryInput {
  topic: Topic
  challenges: Challenge[] // deste tópico
  /** Questões feitas por fora com acertos informados (fração de acerto). */
  practice?: { value: number; at: number }[]
  reviews?: Review // revisão espaçada do tópico
  cards: Flashcard[] // deste tópico
  sessions: Session[] // deste tópico
  openErrors: number
  now: number
}

export interface Mastery {
  value: number // 0–100
  parts: { challenges: number | null; reviews: number | null; confidence: number | null; time: number }
  lastActivity: number | null
}

/** Média em que o mais recente pesa mais (meia-vida de 30 dias). */
function recentAverage(points: { value: number; at: number }[], now: number): number | null {
  if (!points.length) return null
  let sum = 0
  let w = 0
  for (const p of points) {
    const weight = Math.pow(0.5, Math.max(0, now - p.at) / (30 * DAY))
    sum += p.value * weight
    w += weight
  }
  return w ? sum / w : null
}

const dateMs = (iso: string) => new Date(iso + 'T12:00:00').getTime()

export function computeMastery(m: MasteryInput): Mastery | null {
  const challengePts = [...m.challenges.map((c) => ({ value: c.score, at: c.createdAt })), ...(m.practice ?? [])]
  const reviewPts = [
    ...(m.reviews?.history ?? []).map((h) => ({ value: RATING_VALUE[h.rating], at: dateMs(h.date) })),
    ...m.cards.flatMap((c) => c.history.map((h) => ({ value: RATING_VALUE[h.rating], at: dateMs(h.date) }))),
  ]
  const confPts = m.sessions.filter((s) => s.confidence).map((s) => ({ value: (s.confidence! - 1) / 4, at: s.startedAt }))
  const seconds = Math.max(m.topic.studiedSeconds, m.sessions.reduce((a, s) => a + s.seconds, 0))

  const lastActivity = Math.max(0, ...challengePts.map((p) => p.at), ...reviewPts.map((p) => p.at), ...m.sessions.map((s) => s.startedAt + s.seconds * 1000))
  if (!challengePts.length && !reviewPts.length && !confPts.length && seconds < 60) return null

  const parts = {
    challenges: recentAverage(challengePts, m.now),
    reviews: recentAverage(reviewPts, m.now),
    confidence: recentAverage(confPts, m.now),
    time: Math.min(1, seconds / FULL_TIME_SECONDS),
  }
  // Só entram as partes com dados: quem não usa flashcards, por exemplo, não é punido.
  // O peso de cada parte continua o mesmo em relação às outras.
  let sum = WEIGHTS.time * parts.time
  let wsum = WEIGHTS.time
  for (const k of ['challenges', 'reviews', 'confidence'] as const)
    if (parts[k] !== null) {
      sum += WEIGHTS[k] * parts[k]!
      wsum += WEIGHTS[k]
    }
  let value = (100 * sum) / wsum
  // Sem nenhum desafio (prova objetiva), o domínio fica limitado a 70%
  if (parts.challenges === null) value = Math.min(value, NO_CHALLENGE_CAP)
  value -= Math.min(MAX_ERROR_PENALTY, m.openErrors * ERROR_PENALTY)
  // Esquecimento: sem atividade, cai devagar (no mínimo pela metade)
  const idleDays = lastActivity ? Math.max(0, (m.now - lastActivity) / DAY) : 0
  value *= Math.max(0.5, Math.pow(0.5, idleDays / 90))
  return { value: Math.max(0, Math.min(100, Math.round(value))), parts, lastActivity: lastActivity || null }
}

/** Cor do domínio: vermelho (fraco) → amarelo → verde (dominado). */
export function masteryColor(v: number | null | undefined): string {
  if (v === null || v === undefined) return '#94a3b8'
  if (v < 25) return '#ef4444'
  if (v < 45) return '#f97316'
  if (v < 65) return '#eab308'
  if (v < 80) return '#84cc16'
  return '#10b981'
}

export function masteryLabel(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'Sem dados'
  if (v < 25) return 'Fraco'
  if (v < 45) return 'Começando'
  if (v < 65) return 'Em progresso'
  if (v < 80) return 'Bom'
  return 'Dominado'
}
