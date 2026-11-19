import type { Review, ReviewRating } from '../db/types'
import { addDays } from './dates'

/** Escada de intervalos (dias): +1, +7, +30 e depois espaçando mais. */
export const LADDER = [1, 7, 30, 90, 180]

export function nextInterval(current: number, rating: ReviewRating): number {
  if (rating === 'dificil') return 1
  let idx = LADDER.findIndex((d) => d > current) - 1
  if (idx < 0) idx = current >= LADDER[LADDER.length - 1] ? LADDER.length - 1 : 0
  const jump = rating === 'facil' ? 2 : 1
  const target = idx + jump
  if (target < LADDER.length) return LADDER[target]
  return Math.round(current * (rating === 'facil' ? 2.5 : 2))
}

export function newReview(topicId: string, subjectId: string, today: string): Review {
  return { topicId, subjectId, due: addDays(today, 1), intervalDays: 1, count: 0, history: [], createdAt: Date.now() }
}

export function applyRating(r: Review, rating: ReviewRating, today: string): Review {
  const intervalDays = nextInterval(r.intervalDays, rating)
  return { ...r, intervalDays, due: addDays(today, intervalDays), count: r.count + 1, history: [...r.history, { date: today, rating }] }
}

export const RATING_LABEL: Record<ReviewRating, { emoji: string; label: string }> = {
  dificil: { emoji: '😣', label: 'Difícil' },
  ok: { emoji: '🙂', label: 'Ok' },
  facil: { emoji: '😎', label: 'Fácil' },
}
