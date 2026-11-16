import { addDays } from './dates'

export const DEFAULT_DAILY_GOAL = 20

/** Quantas questões foram feitas em cada dia (YYYY-MM-DD → n). */
export type DailyCounts = Map<string, number>

/**
 * Sequência de dias batendo a meta, terminando hoje (ou ontem, se hoje ainda não bateu).
 * Domingo é folga: não quebra a sequência, mas conta se bateu.
 */
export function goalStreak(counts: DailyCounts, goal: number, today: string): number {
  const hit = (d: string) => (counts.get(d) ?? 0) >= goal
  const isSunday = (d: string) => new Date(d + 'T12:00:00').getDay() === 0
  let d = hit(today) ? today : addDays(today, -1)
  let n = 0
  let guard = 0
  while (guard++ < 400) {
    if (hit(d)) n++
    else if (!isSunday(d)) break
    d = addDays(d, -1)
  }
  return n
}
