import { db, uid } from './db'
import type { ErrorEntry, Practice } from './types'
import { addDays, toISODate } from '../lib/dates'
import type { LastInfo, RushQ } from '../lib/rush'
import { userAnswerText } from '../lib/rush'

/** Soma uma questão do Rush ao registro do dia (por matéria e tópico). */
export async function logRushAnswer(subjectId: string, topicId: string | undefined, correct: boolean, when = new Date()) {
  const date = toISODate(when)
  const id = `rush-${date}-${subjectId}-${topicId ?? 'geral'}`
  await db.transaction('rw', db.practice, async () => {
    const cur = await db.practice.get(id)
    await db.practice.put({
      id,
      date,
      source: 'rush',
      subjectId,
      topicId,
      done: (cur?.done ?? 0) + 1,
      correct: (cur?.correct ?? 0) + (correct ? 1 : 0),
      createdAt: cur?.createdAt ?? Date.now(),
    })
  })
}

/** "Na real eu acertei": corrige o registro do dia. */
export async function fixRushAnswer(subjectId: string, topicId: string | undefined, when = new Date()) {
  const id = `rush-${toISODate(when)}-${subjectId}-${topicId ?? 'geral'}`
  const cur = await db.practice.get(id)
  if (cur) await db.practice.update(id, { correct: Math.min(cur.done, (cur.correct ?? 0) + 1) })
}

/** Questões extras feitas fora do site (livro, lista, simulado…). */
export async function addExtraQuestions(p: Omit<Practice, 'id' | 'source' | 'createdAt'>) {
  const done = Math.max(0, Math.round(p.done))
  if (!done) return
  const correct = p.correct === undefined || Number.isNaN(p.correct) ? undefined : Math.min(done, Math.max(0, Math.round(p.correct)))
  await db.practice.add({ ...p, done, correct, id: uid(), source: 'extra', createdAt: Date.now() })
}

export const deleteExtraQuestions = (id: string) => db.practice.delete(id)

/** Questão errada no Rush vira entrada do caderno de erros (uma por conceito). */
export async function logRushError(q: RushQ, last: LastInfo | null) {
  const id = `rush-${q.family}`
  if (await db.errors.get(id)) return
  const today = toISODate(new Date())
  const question = q.formato === 'multipla' ? `${q.enunciado}\n${q.alternativas.map((a, i) => `${'ABCDE'[i]}) ${a}`).join('\n')}` : q.enunciado
  const e: ErrorEntry = {
    id,
    source: 'rush',
    subjectId: q.materia,
    topicId: q.topicId,
    question,
    yourAnswer: userAnswerText(q, last),
    correctAnswer: q.gabarito,
    explanation: [q.ideia && `Ideia-chave: ${q.ideia}`, q.resolucao].filter(Boolean).join('\n'),
    createdAt: Date.now(),
    due: addDays(today, 1),
    streak: 0,
    resolved: false,
    history: [],
  }
  await db.errors.add(e)
}
