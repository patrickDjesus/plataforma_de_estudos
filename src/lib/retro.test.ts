import { describe, expect, it } from 'vitest'
import { retroHints, trimAvailability, type WeekStats } from './retro'

const base: WeekStats = {
  weekId: '2026-11-02',
  minutesByArea: { faculdade: 300, ensino: 60, idiomas: 30 },
  planned: 10,
  done: 9,
  sessions: 8,
  errorsByReason: {},
  errorsByCategory: {},
  weakest: [],
}

describe('retroHints', () => {
  it('sem dados, sem dicas', () => {
    expect(retroHints({ ...base, planned: 0, sessions: 0 })).toEqual({ foco: [], horarios: [] })
    expect(retroHints(null)).toEqual({ foco: [], horarios: [] })
  })
  it('plano pouco cumprido sugere enxugar horários', () => {
    const h = retroHints({ ...base, done: 3 })
    expect(h.trim).toBe(0.7)
    expect(h.horarios[0]).toContain('30%')
  })
  it('tags viram dicas e matéria fraca aparece no foco', () => {
    const h = retroHints({ ...base, weakestSubject: { id: 's', name: 'Física', value: 35 } }, { worked: '', blocked: '', tags: ['distracoes', 'plano-irreal'], at: 0 })
    expect(h.trim).toBe(0.8)
    expect(h.foco.some((x) => x.includes('Física'))).toBe(true)
    expect(h.foco.some((x) => x.includes('Distrações'))).toBe(true)
  })
  it('avisa quando a faculdade ficou abaixo de 2/3', () => {
    const h = retroHints({ ...base, minutesByArea: { faculdade: 60, ensino: 120, idiomas: 30 } })
    expect(h.foco.some((x) => x.includes('faculdade'))).toBe(true)
  })
})

describe('trimAvailability', () => {
  it('encurta pelo fim em passos de 15 min, mínimo 30', () => {
    const av = [[{ start: 600, end: 720 }, { start: 900, end: 930 }], [], [], [], [], [], []]
    const t = trimAvailability(av, 0.7)
    expect(t[0][0]).toEqual({ start: 600, end: 690 })
    expect(t[0][1]).toEqual({ start: 900, end: 930 })
  })
})
