import { describe, expect, it } from 'vitest'
import { addBatch, addVariants, advance, defaultRushState, finish, localCheck, localTheoryCheck, override, parseLoose, parseNum, planBatch, rawList, type RushQ, type RushState } from './rush'

const name = (id: string) => ({ fis: 'Física', bio: 'Biologia' })[id] ?? id
const topicName = (id: string) => ({ t1: 'Cinemática', t2: 'Dinâmica' })[id]

function stateWith(...subs: string[]): RushState {
  const S = defaultRushState()
  S.cfg.subjects = subs.map((id) => ({ id, focus: '', topicIds: [] }))
  S.started = true
  return S
}
const rawQ = (over: Partial<Record<string, unknown>> = {}) => ({
  materia: 'Física',
  topico: 'Cinemática',
  conceito: 'MRU',
  tipo: 'conta',
  formato: 'multipla',
  enunciado: 'Um carro anda 100 m em 10 s. Velocidade?',
  alternativas: ['5 m/s', '10 m/s', '20 m/s', '1 m/s', '50 m/s'],
  correta: 1,
  gabarito: '10 m/s',
  unidade: 'm/s',
  valor: 10,
  tolerancia: 0.02,
  resolucao: '1) v = d/t\n2) 100/10 = 10',
  erros: ['', '', '', '', ''],
  ideia: 'v = d/t',
  dica: 'Divida',
  dificuldade: 3,
  ...over,
})

describe('JSON tolerante', () => {
  it('aceita LaTeX com barra simples e cercas de código', () => {
    const v = parseLoose('```json\n[{"enunciado": "Calcule $\\frac{1}{2}$"}]\n```') as { enunciado: string }[]
    expect(v[0].enunciado).toContain('\\frac')
  })
  it('acha a lista dentro de "questoes"', () => {
    expect(rawList({ questoes: [{ a: 1 }] })).toHaveLength(1)
    expect(rawList('x')).toEqual([])
  })
})

describe('correção local', () => {
  const q = { valor: 0.25, tolerancia: 0.02, unidade: 'm/s', gabarito: '0,25 m/s' } as RushQ
  it('números em vários formatos', () => {
    expect(parseNum('1/4')?.v).toBe(0.25)
    expect(parseNum('2,5x10^3')?.v).toBe(2500)
    expect(parseNum('1.000')?.v).toBe(1000)
  })
  it('valor com tolerância e unidade', () => {
    expect(localCheck(q, '0,25')).toBe(true)
    expect(localCheck(q, '0.251 m/s')).toBe(true)
    expect(localCheck(q, '0,25 km/h')).toBeNull()
    expect(localCheck(q, '0,3')).toBeNull()
  })
  it('teoria: ignora artigos, acentos e plural', () => {
    const t = { valor: null, gabarito: 'A mitocôndria' } as RushQ
    expect(localTheoryCheck(t, 'mitocondrias')).toBe(true)
    expect(localTheoryCheck(t, 'ribossomo')).toBeNull()
  })
})

describe('fila e dificuldade', () => {
  it('primeira leva passa pelas matérias e começa fácil', () => {
    const S = stateWith('fis', 'bio')
    const plan = planBatch(S, 5, topicName)
    expect(plan.map((p) => p.d)).toEqual([2, 3, 4, 3, 5])
    expect(new Set(plan.map((p) => p.s.id))).toEqual(new Set(['fis', 'bio']))
  })
  it('tópicos escolhidos viram assunto e topicId', () => {
    const S = stateWith('fis')
    S.cfg.subjects[0].topicIds = ['t1']
    const plan = planBatch(S, 2, topicName)
    expect(plan[0].focus).toEqual({ label: 'Cinemática', topicId: 't1' })
    addBatch(S, plan, [rawQ({ topico: '' }), rawQ()])
    expect(S.queue[0].topicId).toBe('t1')
    expect(S.queue[0].materia).toBe('fis')
  })
  it('acertar sobe a dificuldade; errar desce e pede 3 variações', () => {
    const S = stateWith('fis')
    addBatch(S, planBatch(S, 2, topicName), [rawQ(), rawQ()])
    advance(S, name)
    const lv = S.level
    expect(finish(S, { correct: true, conf: 'certeza', hintUsed: false, usedFifty: false }, name)).toBeNull()
    expect(S.level).toBeGreaterThan(lv)
    expect(S.stats.streak).toBe(1)
    expect(S.score).toBeGreaterThan(0)
    advance(S, name)
    const req = finish(S, { correct: false, conf: 'acho', hintUsed: false, usedFifty: false }, name)
    expect(req?.n).toBe(3)
    expect(S.stats.streak).toBe(1) // o escudo segurou o combo
    expect(S.items.shield).toBe(0)
    expect(S.families[req!.q.family].last).toBe('errou')
  })
  it('variações entram nas posições +3, +7 e +12', () => {
    const S = stateWith('fis')
    for (let i = 0; i < 3; i++) addBatch(S, planBatch(S, 5, topicName), Array.from({ length: 5 }, () => rawQ()))
    advance(S, name)
    const q = S.current!
    const sp = addVariants(S, q, [rawQ(), rawQ(), rawQ()], 3, {})
    expect(sp?.n).toBe(3)
    const pos = S.queue.map((x, i) => (x.kind === 'revisao' ? i : -1)).filter((i) => i >= 0)
    expect(pos).toEqual([2, 6, 11])
    expect(S.queue[2].family).toBe(q.family)
  })
  it('"na real eu acertei" desfaz o erro e cancela as revisões', () => {
    const S = stateWith('fis')
    S.items.shield = 0
    addBatch(S, planBatch(S, 3, topicName), [rawQ(), rawQ(), rawQ()])
    advance(S, name)
    const q = S.current!
    finish(S, { correct: false, conf: 'acho', hintUsed: false, usedFifty: false }, name)
    addVariants(S, q, [rawQ()], 1, {})
    override(S)
    expect(S.stats.correct).toBe(1)
    expect(S.queue.some((x) => x.parentQ === q.id)).toBe(false)
    expect(S.families[q.family]).toBeUndefined()
  })
})
