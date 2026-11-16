import { describe, expect, it } from 'vitest'
import { goalStreak } from './dailyGoal'

// 2026-11-16 é segunda; 2026-11-15 domingo
const c = (o: Record<string, number>) => new Map(Object.entries(o))
describe('sequência da meta diária', () => {
  it('conta dias seguidos batendo a meta', () => {
    expect(goalStreak(c({ '2026-11-16': 25, '2026-11-17': 20, '2026-11-18': 30 }), 20, '2026-11-18')).toBe(3)
  })
  it('hoje ainda não bateu: conta até ontem', () => {
    expect(goalStreak(c({ '2026-11-16': 25, '2026-11-17': 20, '2026-11-18': 5 }), 20, '2026-11-18')).toBe(2)
  })
  it('domingo sem estudo não quebra; com estudo conta', () => {
    expect(goalStreak(c({ '2026-11-13': 20, '2026-11-14': 20, '2026-11-16': 20 }), 20, '2026-11-16')).toBe(3)
    expect(goalStreak(c({ '2026-11-14': 20, '2026-11-15': 20, '2026-11-16': 20 }), 20, '2026-11-16')).toBe(3)
  })
  it('dia de semana sem meta quebra', () => {
    expect(goalStreak(c({ '2026-11-12': 20, '2026-11-14': 20, '2026-11-16': 20 }), 20, '2026-11-16')).toBe(2) // sexta (13) sem meta quebra; domingo (15) não
  })
})
