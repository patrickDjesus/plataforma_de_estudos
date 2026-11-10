import { describe, expect, it } from 'vitest'
import { applyRating, newReview, nextInterval } from './review'

describe('revisão espaçada', () => {
  it('começa no dia seguinte', () => {
    expect(newReview('t', 's', '2026-11-10').due).toBe('2026-11-11')
  })
  it('Ok segue a escada 1 → 7 → 30', () => {
    expect(nextInterval(1, 'ok')).toBe(7)
    expect(nextInterval(7, 'ok')).toBe(30)
    expect(nextInterval(30, 'ok')).toBe(90)
  })
  it('Fácil pula um degrau, Difícil volta para 1 dia', () => {
    expect(nextInterval(1, 'facil')).toBe(30)
    expect(nextInterval(30, 'dificil')).toBe(1)
  })
  it('depois do topo, continua espaçando', () => {
    expect(nextInterval(180, 'ok')).toBe(360)
  })
  it('registra histórico e próxima data', () => {
    const r = applyRating(newReview('t', 's', '2026-11-10'), 'ok', '2026-11-11')
    expect(r).toMatchObject({ intervalDays: 7, due: '2026-11-18', count: 1 })
    expect(r.history).toEqual([{ date: '2026-11-11', rating: 'ok' }])
  })
})
