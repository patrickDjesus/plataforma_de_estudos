import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { addDays, fromISODate, weekIdOf } from '../lib/dates'
import { POINTS, challengePoints, rankFromEvents, weekPoints, type RankEvent, type RankState } from '../lib/rank'

const at = (date: string, minutes = 12 * 60) => fromISODate(date).getTime() + minutes * 60000

/** Monta todos os eventos de pontuação a partir do histórico (funciona em qualquer dispositivo). */
export async function loadRank(now = new Date()): Promise<RankState> {
  const [blocks, reviews, challenges, cards, topics, subjects] = await Promise.all([
    db.blocks.toArray(),
    db.reviews.toArray(),
    db.challenges.toArray(),
    db.cards.toArray(),
    db.topics.toArray(),
    db.subjects.toArray(),
  ])
  const tName = new Map(topics.map((t) => [t.id, t.name]))
  const sName = new Map(subjects.map((s) => [s.id, s.name]))
  const what = (topicId?: string, subjectId?: string) => (topicId && tName.get(topicId)) || (subjectId && sName.get(subjectId)) || 'estudo'
  const events: RankEvent[] = []

  for (const b of blocks) {
    if (b.kind !== 'study' && b.kind !== 'revisao') continue
    // Revisões contam pela avaliação (abaixo), não pelo bloco
    if (b.done && b.kind === 'study') events.push({ at: at(b.date, b.end), delta: POINTS.block, label: `Bloco: ${what(b.topicId, b.subjectId)}` })
    if (b.missed && !b.done) events.push({ at: at(b.date, b.end), delta: POINTS.missed, label: `Bloco perdido: ${what(b.topicId, b.subjectId)}` })
  }
  for (const r of reviews) for (const h of r.history) events.push({ at: at(h.date), delta: POINTS.review, label: `Revisão: ${what(r.topicId, r.subjectId)}` })
  for (const c of challenges)
    events.push({ at: c.createdAt, delta: challengePoints(c.score), label: `${c.origin === 'questoes' ? 'Questões' : 'Desafio'} (${Math.round(c.score * 100)}%): ${what(c.topicId, c.subjectId)}` })

  const perDay = new Map<string, number>()
  for (const c of cards) for (const h of c.history) perDay.set(h.date, (perDay.get(h.date) ?? 0) + 1)
  for (const [date, n] of perDay) events.push({ at: at(date, 23 * 60), delta: Math.min(n, POINTS.cardPerDay), label: `Flashcards (${n})` })

  // Semanas encerradas: bônus ou penalidade pelo plano cumprido
  const current = weekIdOf(now)
  const weeks = new Map<string, { planned: number; done: number }>()
  for (const b of blocks) {
    if ((b.kind !== 'study' && b.kind !== 'revisao') || b.weekId >= current) continue
    const w = weeks.get(b.weekId) ?? { planned: 0, done: 0 }
    w.planned++
    if (b.done) w.done++
    weeks.set(b.weekId, w)
  }
  for (const [weekId, w] of weeks) {
    const rate = w.done / w.planned
    const delta = weekPoints(rate)
    if (delta) events.push({ at: at(addDays(weekId, 7), 0), delta, label: `Semana com ${Math.round(rate * 100)}% do plano` })
  }
  return rankFromEvents(events)
}

const EMPTY: RankState = { pos: 0, points: 0, best: { pos: 0, points: 0 }, log: [] }

export function useRank(): RankState {
  return useLiveQuery(() => loadRank(), [], EMPTY)
}
