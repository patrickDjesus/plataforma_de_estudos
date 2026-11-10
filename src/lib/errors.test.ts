import { describe, expect, it } from 'vitest'
import type { Challenge, ErrorEntry } from '../db/types'
import { errorsFromChallenge, reviewError } from './errors'

const base: ErrorEntry = { id: 'e', source: 'desafio', question: 'Q', yourAnswer: 'a', correctAnswer: 'b', createdAt: 0, due: '2026-11-11', streak: 0, resolved: false, history: [] }

describe('caderno de erros', () => {
  it('dois acertos seguidos resolvem o erro', () => {
    const a = reviewError(base, true, '2026-11-11')
    expect(a).toMatchObject({ streak: 1, resolved: false, due: '2026-11-14' })
    expect(reviewError(a, true, '2026-11-14')).toMatchObject({ streak: 2, resolved: true })
  })
  it('errar zera a sequência e volta amanhã', () => {
    expect(reviewError({ ...base, streak: 1 }, false, '2026-11-11')).toMatchObject({ streak: 0, due: '2026-11-12', resolved: false })
  })
  it('só itens errados e não contestados viram erros', () => {
    const c: Challenge = {
      id: 'c',
      subjectId: 's',
      origin: 'demanda',
      fromNotes: true,
      createdAt: 0,
      score: 0.5,
      items: [
        { type: 'multipla', question: 'Q1', options: ['a', 'b', 'c'], correct: 1 },
        { type: 'vf', statement: 'S', answer: true },
        { type: 'aberta', question: 'Q3', expected: 'E' },
      ],
      answers: [0, true, 'x'],
      results: [
        { score: 0, correct: false },
        { score: 1, correct: true },
        { score: 0, correct: false, contested: true },
      ],
    }
    const errs = errorsFromChallenge(c, '2026-11-10')
    expect(errs).toHaveLength(1)
    expect(errs[0]).toMatchObject({ id: 'c-0', yourAnswer: 'a', correctAnswer: 'b', due: '2026-11-11' })
  })
})
