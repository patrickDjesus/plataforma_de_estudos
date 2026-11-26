import { describe, expect, it } from 'vitest'
import { applyConceptResult, conceptState, pickCandidates, type CodeConcept } from './concepts'

const DAY = 86400000
const now = 1_000 * DAY

describe('banco de conceitos', () => {
  it('oferece só conceitos do cargo e nunca os já usados', () => {
    const usado = applyConceptResult(undefined, 'python', 'enumerate', 'novo', true, 'p', now)
    const { novos } = pickCandidates('python', 2, [usado], now, () => 0.5)
    expect(novos).not.toContain('enumerate')
    expect(novos).not.toContain('lambda') // cargo 3
    expect(novos.length).toBeGreaterThan(0)
  })

  it('apresentado e ainda não usado volta primeiro como novo', () => {
    const tentou = applyConceptResult(undefined, 'python', 'zip', 'novo', false, 'p', now)
    expect(pickCandidates('python', 2, [tentou], now, () => 0.5).novos[0]).toBe('zip')
  })

  it('revisão só depois que vence, e acertar espaça as revisões', () => {
    let c: CodeConcept = applyConceptResult(undefined, 'javascript', 'map', 'novo', true, 'p', now)
    expect(c.streak).toBe(1)
    expect(pickCandidates('javascript', 3, [c], now).revisao).toEqual([])
    expect(pickCandidates('javascript', 3, [c], c.due).revisao).toEqual(['map'])
    c = applyConceptResult(c, 'javascript', 'map', 'revisao', true, 'p2', c.due)
    expect(c.streak).toBe(2)
    expect(c.due - c.lastAt).toBe(3 * DAY)
    c = applyConceptResult(c, 'javascript', 'map', 'revisao', true, 'p3', c.due)
    expect(conceptState(c)).toBe('fixado')
  })

  it('esquecer zera a sequência e volta no dia seguinte', () => {
    let c = applyConceptResult(undefined, 'python', 'dict.get', 'novo', true, 'p', now)
    c = applyConceptResult(c, 'python', 'dict.get', 'revisao', false, 'p2', now + DAY)
    expect(c.streak).toBe(0)
    expect(c.due).toBe(now + 2 * DAY)
    expect(conceptState(c)).toBe('aprendendo')
  })
})
