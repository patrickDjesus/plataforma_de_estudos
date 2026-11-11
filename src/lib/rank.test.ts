import { describe, expect, it } from 'vitest'
import { MASTER_POS, applyDelta, challengePoints, rankFromEvents, rankName, weekPoints } from './rank'

describe('rank', () => {
  it('nomes e divisões', () => {
    expect(rankName(0)).toBe('Ferro III')
    expect(rankName(2)).toBe('Ferro I')
    expect(rankName(10)).toBe('Ouro II')
    expect(rankName(MASTER_POS)).toBe('Mestre')
  })
  it('sobe de divisão ao completar os pontos, levando a sobra', () => {
    expect(applyDelta({ pos: 0, points: 95 }, 10)).toEqual({ pos: 1, points: 5, change: 'subiu' })
  })
  it('escudo: chegar a 0 não rebaixa; a perda seguinte sim, com 75% da divisão de baixo', () => {
    const a = applyDelta({ pos: 6, points: 4 }, -6)
    expect(a).toEqual({ pos: 6, points: 0 })
    expect(applyDelta(a, -6)).toEqual({ pos: 5, points: 75, change: 'caiu' })
  })
  it('Ferro III é o piso', () => {
    expect(applyDelta({ pos: 0, points: 0 }, -15)).toEqual({ pos: 0, points: 0 })
  })
  it('Mestre acumula sem limite', () => {
    const r = applyDelta({ pos: MASTER_POS, points: 900 }, 300)
    expect(r).toEqual({ pos: MASTER_POS, points: 1200 })
  })
  it('histórico em ordem de tempo e melhor rank guardado', () => {
    const s = rankFromEvents([
      { at: 2, delta: -6, label: 'perdido' },
      { at: 1, delta: 120, label: 'muito estudo' },
    ])
    expect(s.pos).toBe(1)
    expect(s.points).toBe(14)
    expect(s.best).toEqual({ pos: 1, points: 20 })
    expect(s.log[0].change).toBe('subiu')
  })
  it('pontos de desafio e de semana', () => {
    expect(challengePoints(1)).toBe(15)
    expect(challengePoints(0.5)).toBe(5)
    expect(weekPoints(0.9)).toBe(25)
    expect(weekPoints(0.5)).toBe(0)
    expect(weekPoints(0.1)).toBe(-15)
  })
})
