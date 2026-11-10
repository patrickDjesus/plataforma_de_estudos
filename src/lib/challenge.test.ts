import { describe, expect, it } from 'vitest'
import { blankMatches, finalScore, gradeLocal, ratingFromScore, sanitizeItems } from './challenge'

describe('sanitizeItems', () => {
  it('aceita itens válidos e descarta os malformados', () => {
    const items = sanitizeItems(
      {
        items: [
          { type: 'multipla', question: 'Q?', options: ['a', 'b', 'c', 'd'], correct: 2 },
          { type: 'multipla', question: 'Q?', options: ['a', 'b'], correct: 0 }, // poucas opções
          { type: 'vf', statement: 'S', answer: true },
          { type: 'vf', statement: 'S', answer: 'sim' }, // tipo errado
          { type: 'aberta', question: 'Q', expected: 'E' },
          { type: 'explique', prompt: 'P', keyPoints: ['k'] },
          { type: 'lacunas', text: 'A ___ é B ___.', answers: ['x', 'y'] },
          { type: 'lacunas', text: 'A ___ é B.', answers: ['x', 'y'] }, // lacunas ≠ respostas
        ],
      },
      true,
    )
    expect(items.map((i) => i.type)).toEqual(['multipla', 'vf', 'aberta', 'explique', 'lacunas'])
  })
  it('sem anotações, não aceita lacunas', () => {
    expect(sanitizeItems([{ type: 'lacunas', text: 'A ___', answers: ['x'] }], false)).toEqual([])
  })
})

describe('correção local', () => {
  it('lacunas toleram acento, maiúscula e um errinho', () => {
    expect(blankMatches('Fotossintese', 'fotossíntese')).toBe(true)
    expect(blankMatches('fotosintese', 'fotossíntese')).toBe(true)
    expect(blankMatches('respiração', 'fotossíntese')).toBe(false)
    expect(blankMatches('', 'a')).toBe(false)
  })
  it('múltipla escolha e V/F', () => {
    expect(gradeLocal({ type: 'multipla', question: '', options: ['a', 'b', 'c'], correct: 1 }, 1)?.score).toBe(1)
    expect(gradeLocal({ type: 'vf', statement: '', answer: false }, true)?.correct).toBe(false)
  })
  it('lacunas dão nota parcial', () => {
    expect(gradeLocal({ type: 'lacunas', text: '___ ___', answers: ['a', 'b'] }, ['a', 'x'])?.score).toBe(0.5)
  })
  it('itens abertos ficam para o Claude', () => {
    expect(gradeLocal({ type: 'aberta', question: '', expected: '' }, 'x')).toBeNull()
  })
})

describe('nota e revisão', () => {
  it('itens contestados saem da nota', () => {
    expect(finalScore([{ score: 1, correct: true }, { score: 0, correct: false, contested: true }])).toBe(1)
  })
  it('a nota vira a avaliação da revisão', () => {
    expect(ratingFromScore(0.3)).toBe('dificil')
    expect(ratingFromScore(0.7)).toBe('ok')
    expect(ratingFromScore(0.9)).toBe('facil')
  })
})
