import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { computeMastery, type Mastery } from '../lib/mastery'

export interface MasteryMap {
  topics: Map<string, Mastery>
  /** Média dos tópicos com dados, por matéria. */
  subjects: Map<string, number>
}

/** Calcula o domínio de todos os tópicos a partir do banco. */
export async function loadMastery(now = Date.now()): Promise<MasteryMap> {
  const [topics, challenges, reviews, cards, sessions, errors] = await Promise.all([
    db.topics.toArray(),
    db.challenges.toArray(),
    db.reviews.toArray(),
    db.cards.toArray(),
    db.sessions.toArray(),
    db.errors.filter((e) => !e.resolved).toArray(),
  ])
  const by = <T extends { topicId?: string }>(list: T[]) => {
    const m = new Map<string, T[]>()
    for (const x of list) {
      if (!x.topicId) continue
      const arr = m.get(x.topicId)
      if (arr) arr.push(x)
      else m.set(x.topicId, [x])
    }
    return m
  }
  const ch = by(challenges)
  const cd = by(cards)
  const ss = by(sessions)
  const er = by(errors)
  const rv = new Map(reviews.map((r) => [r.topicId, r]))
  const out = new Map<string, Mastery>()
  const sums = new Map<string, { s: number; n: number }>()
  for (const t of topics) {
    const m = computeMastery({ topic: t, challenges: ch.get(t.id) ?? [], reviews: rv.get(t.id), cards: cd.get(t.id) ?? [], sessions: ss.get(t.id) ?? [], openErrors: (er.get(t.id) ?? []).length, now })
    if (!m) continue
    out.set(t.id, m)
    const acc = sums.get(t.subjectId) ?? { s: 0, n: 0 }
    sums.set(t.subjectId, { s: acc.s + m.value, n: acc.n + 1 })
  }
  return { topics: out, subjects: new Map([...sums.entries()].map(([k, v]) => [k, Math.round(v.s / v.n)])) }
}

export function useMastery(): MasteryMap {
  return useLiveQuery(() => loadMastery(), [], { topics: new Map(), subjects: new Map() })
}
