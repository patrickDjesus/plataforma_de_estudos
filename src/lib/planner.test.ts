import { describe, expect, it } from 'vitest'
import type { Subject, Topic } from '../db/types'
import { buildSlots, orderTopics, planWeek, subtract, type PlanInput } from './planner'

const sub = (id: string, areaId: Subject['areaId'], extra: Partial<Subject> = {}): Subject => ({
  id,
  areaId,
  name: id,
  color: '#000000',
  weight: 3,
  mandatory: false,
  createdAt: 0,
  ...extra,
})

const evening = [{ start: 19 * 60, end: 22 * 60 }]
const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  weekId: '2026-11-09', // segunda
  availability: [evening, evening, evening, evening, evening, [], []],
  percents: { faculdade: 70, ensino: 20, idiomas: 10 },
  subjects: [sub('calc', 'faculdade'), sub('fis', 'faculdade'), sub('hist', 'ensino'), sub('ing', 'idiomas')],
  topics: [],
  busy: [],
  settings: { blockMinutes: 50, minBlockMinutes: 25, breakMinutes: 10, maxSameSubjectInRow: 2 },
  now: new Date(2026, 10, 9, 8, 0), // segunda 08:00
  ...over,
})

describe('subtract', () => {
  it('remove o meio de uma janela', () => {
    expect(subtract({ start: 0, end: 100 }, [{ start: 40, end: 60 }])).toEqual([
      { start: 0, end: 40 },
      { start: 60, end: 100 },
    ])
  })
})

describe('buildSlots', () => {
  it('corta 19–22h em 3 blocos de 50 min com pausa', () => {
    const slots = buildSlots(base())
    expect(slots.filter((s) => s.date === '2026-11-09')).toHaveLength(3)
    expect(slots).toHaveLength(15)
  })

  it('no meio da semana, ignora dias e horários passados', () => {
    const slots = buildSlots(base({ now: new Date(2026, 10, 11, 20, 0) })) // quarta 20:00
    expect(slots.every((s) => s.date >= '2026-11-11')).toBe(true)
    expect(slots.filter((s) => s.date === '2026-11-11').every((s) => s.start >= 20 * 60)).toBe(true)
  })

  it('respeita compromissos', () => {
    const slots = buildSlots(base({ busy: [{ date: '2026-11-09', start: 19 * 60, end: 22 * 60 }] }))
    expect(slots.some((s) => s.date === '2026-11-09')).toBe(false)
  })
})

describe('planWeek', () => {
  it('respeita aproximadamente o percentual das áreas', () => {
    const plan = planWeek(base())
    const fac = plan.filter((b) => b.subjectId === 'calc' || b.subjectId === 'fis').length
    expect(fac / plan.length).toBeGreaterThanOrEqual(0.66)
  })

  it('nunca põe mais de 2 blocos seguidos da mesma matéria', () => {
    const plan = planWeek(base())
    for (let i = 2; i < plan.length; i++) {
      const [a, b, c] = [plan[i - 2], plan[i - 1], plan[i]]
      if (a.date === c.date) expect(a.subjectId === b.subjectId && b.subjectId === c.subjectId).toBe(false)
    }
  })

  it('prazo próximo aumenta a fatia da matéria', () => {
    const normal = planWeek(base()).filter((b) => b.subjectId === 'calc').length
    const urgent = planWeek(
      base({ subjects: [sub('calc', 'faculdade', { deadline: '2026-11-11' }), sub('fis', 'faculdade'), sub('hist', 'ensino'), sub('ing', 'idiomas')] }),
    ).filter((b) => b.subjectId === 'calc').length
    expect(urgent).toBeGreaterThan(normal)
  })

  it('distribui tópicos pendentes em ordem', () => {
    const topics: Topic[] = [
      { id: 't2', subjectId: 'calc', name: 'Derivadas', order: 2, done: false, studiedSeconds: 0 },
      { id: 't1', subjectId: 'calc', name: 'Limites', order: 1, done: false, studiedSeconds: 0 },
      { id: 't0', subjectId: 'calc', name: 'Funções', order: 0, done: true, studiedSeconds: 0 },
    ]
    const calc = planWeek(base({ topics })).filter((b) => b.subjectId === 'calc')
    expect(calc[0].topicId).toBe('t1')
    expect(calc[1].topicId).toBe('t2')
  })

  it('encaixa revisões a partir do vencimento, até 20% da semana', () => {
    const reviews = [
      { topicId: 'r1', subjectId: 'calc', due: '2026-11-11' },
      { topicId: 'r2', subjectId: 'hist', due: '2026-11-01' },
    ]
    const plan = planWeek(base({ reviews, settings: { ...base().settings, reviewMinutes: 20, maxReviewShare: 0.2 } }))
    const rev = plan.filter((b) => b.kind === 'revisao')
    expect(rev).toHaveLength(2)
    expect(rev.find((b) => b.topicId === 'r1')!.date >= '2026-11-11').toBe(true)
    expect(rev.find((b) => b.topicId === 'r2')!.date).toBe('2026-11-09') // atrasada: primeiro horário
    // estudo não sobrepõe a revisão
    const r1 = rev.find((b) => b.topicId === 'r1')!
    expect(plan.some((b) => b.kind === 'study' && b.date === r1.date && b.start < r1.end && b.end > r1.start)).toBe(false)
  })

  it('respeita o teto de revisões', () => {
    const reviews = Array.from({ length: 40 }, (_, i) => ({ topicId: `r${i}`, subjectId: 'calc', due: '2026-11-09' }))
    const plan = planWeek(base({ reviews, settings: { ...base().settings, reviewMinutes: 20, maxReviewShare: 0.2 } }))
    const revMin = plan.filter((b) => b.kind === 'revisao').reduce((a, b) => a + b.end - b.start, 0)
    const allMin = plan.reduce((a, b) => a + b.end - b.start, 0)
    expect(revMin / allMin).toBeLessThanOrEqual(0.21)
  })

  it('conteúdo perdido ganha prioridade', () => {
    const normal = planWeek(base()).filter((b) => b.subjectId === 'ing').length
    const carried = planWeek(base({ carryOver: { ing: 100 } })).filter((b) => b.subjectId === 'ing').length
    expect(carried).toBeGreaterThan(normal)
  })

  it('tópicos fracos já estudados vêm primeiro; concluídos muito fracos voltam', () => {
    const topics: Topic[] = [
      { id: 'a', subjectId: 'calc', name: 'A', order: 0, done: false, studiedSeconds: 0 },
      { id: 'b', subjectId: 'calc', name: 'B', order: 1, done: false, studiedSeconds: 0 },
      { id: 'c', subjectId: 'calc', name: 'C', order: 2, done: true, studiedSeconds: 0 },
      { id: 'd', subjectId: 'calc', name: 'D', order: 3, done: true, studiedSeconds: 0 },
    ]
    expect(orderTopics(topics, { b: 45, c: 20, d: 90 }).map((t) => t.id)).toEqual(['c', 'b', 'a'])
  })

  it('matéria com domínio baixo ganha mais tempo', () => {
    const normal = planWeek(base()).filter((b) => b.subjectId === 'fis').length
    const fraca = planWeek(base({ subjectMastery: { fis: 10, calc: 90 } })).filter((b) => b.subjectId === 'fis').length
    expect(fraca).toBeGreaterThan(normal)
  })

  it('sem matérias, não gera nada', () => {
    expect(planWeek(base({ subjects: [] }))).toEqual([])
  })
})

describe('modo flexível (horas por dia)', () => {
  const flex = (over: Partial<PlanInput> = {}) => base({ dailyMinutes: [120, 90, 0, 60, 0, 180, 0], settings: { blockMinutes: 50, minBlockMinutes: 25, breakMinutes: 0, maxSameSubjectInRow: 2 }, ...over })
  it('divide as horas de cada dia em blocos que somam exatamente a meta', () => {
    const slots = buildSlots(flex())
    const sum = (d: string) => slots.filter((s) => s.date === d).reduce((a, s) => a + s.end - s.start, 0)
    expect(sum('2026-11-09')).toBe(120)
    expect(sum('2026-11-10')).toBe(90)
    expect(sum('2026-11-11')).toBe(0)
    expect(sum('2026-11-14')).toBe(180)
    // 120 = 50 + 70: o resto de 20 min (menor que o mínimo) junta no último bloco
    expect(slots.filter((s) => s.date === '2026-11-09').map((s) => s.end - s.start)).toEqual([50, 70])
  })
  it('hoje vale inteiro, mesmo à noite', () => {
    const slots = buildSlots(flex({ now: new Date(2026, 10, 9, 22, 30) }))
    expect(slots.filter((s) => s.date === '2026-11-09').reduce((a, s) => a + s.end - s.start, 0)).toBe(120)
  })
  it('o que já foi feito no dia desconta da meta', () => {
    const slots = buildSlots(flex({ busy: [{ date: '2026-11-09', start: 360, end: 410, kind: 'study', done: true }] }))
    expect(slots.filter((s) => s.date === '2026-11-09').reduce((a, s) => a + s.end - s.start, 0)).toBe(70)
  })
  it('planWeek preenche as horas com matérias', () => {
    const plan = planWeek(flex())
    expect(plan.reduce((a, b) => a + b.end - b.start, 0)).toBe(450)
  })
})
