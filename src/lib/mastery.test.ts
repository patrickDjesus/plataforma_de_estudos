import { describe, expect, it } from 'vitest'
import type { Challenge, Topic } from '../db/types'
import { computeMastery, masteryColor } from './mastery'

const NOW = new Date(2026, 10, 10, 12).getTime()
const DAY = 86400000
const topic: Topic = { id: 't', subjectId: 's', name: 'T', order: 0, done: false, studiedSeconds: 0 }
const ch = (score: number, daysAgo = 0): Challenge => ({ id: `c${score}${daysAgo}`, subjectId: 's', topicId: 't', origin: 'demanda', fromNotes: true, createdAt: NOW - daysAgo * DAY, items: [], answers: [], results: [], score })
const base = { topic, challenges: [], cards: [], sessions: [], openErrors: 0, now: NOW }

describe('domínio por tópico', () => {
  it('sem nenhum dado, não há domínio', () => {
    expect(computeMastery(base)).toBeNull()
  })
  it('tudo no máximo dá 100', () => {
    const m = computeMastery({
      ...base,
      topic: { ...topic, studiedSeconds: 2 * 3600 },
      challenges: [ch(1)],
      reviews: { topicId: 't', subjectId: 's', due: '2026-11-20', intervalDays: 7, count: 1, history: [{ date: '2026-11-10', rating: 'facil' }], createdAt: 0 },
      sessions: [{ id: 's', topicId: 't', startedAt: NOW - 3600000, seconds: 3600, confidence: 5 }],
    })
    expect(m?.value).toBe(100)
  })
  it('desafios valem metade: só desafio perfeito dá 50', () => {
    expect(computeMastery({ ...base, challenges: [ch(1)] })?.value).toBe(50)
  })
  it('o desafio mais recente pesa mais', () => {
    const recentGood = computeMastery({ ...base, challenges: [ch(0, 60), ch(1, 0)] })!.value
    const recentBad = computeMastery({ ...base, challenges: [ch(1, 60), ch(0, 0)] })!.value
    expect(recentGood).toBeGreaterThan(recentBad)
  })
  it('erros em aberto descontam', () => {
    const sem = computeMastery({ ...base, challenges: [ch(1)] })!.value
    const com = computeMastery({ ...base, challenges: [ch(1)], openErrors: 2 })!.value
    expect(sem - com).toBe(16)
  })
  it('sem atividade, cai devagar, até a metade', () => {
    const hoje = computeMastery({ ...base, challenges: [ch(1, 0)] })!.value
    const meses = computeMastery({ ...base, challenges: [ch(1, 400)] })!.value
    expect(meses).toBeLessThan(hoje)
    expect(meses).toBeGreaterThanOrEqual(Math.floor(hoje / 2) - 1)
  })
  it('cores vão do vermelho ao verde', () => {
    expect(masteryColor(10)).toBe('#ef4444')
    expect(masteryColor(90)).toBe('#10b981')
    expect(masteryColor(null)).toBe('#94a3b8')
  })
})
