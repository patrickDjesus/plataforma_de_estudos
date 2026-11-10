import { describe, expect, it } from 'vitest'
import type { Subject, Topic } from '../db/types'
import { buildSlots, planWeek, subtract, type PlanInput } from './planner'

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

  it('sem matérias, não gera nada', () => {
    expect(planWeek(base({ subjects: [] }))).toEqual([])
  })
})
