import { db } from './db'
import { loadMastery } from './mastery'
import { getSettings } from './repo'
import type { AreaId, ErrorReason, RetroTag, WritingCategory } from './types'
import { addDays, fromISODate } from '../lib/dates'
import type { WeekStats } from '../lib/retro'

/** Números da semana `weekId` (segunda-feira) para a revisão semanal. */
export async function loadWeekStats(weekId: string): Promise<WeekStats> {
  const from = fromISODate(weekId).getTime()
  const to = fromISODate(addDays(weekId, 7)).getTime()
  const [subjects, topics, sessions, blocks, errors, mastery] = await Promise.all([
    db.subjects.toArray(),
    db.topics.toArray(),
    db.sessions.where('startedAt').between(from, to, true, false).toArray(),
    db.blocks.where('weekId').equals(weekId).toArray(),
    db.errors.where('createdAt').between(from, to, true, false).toArray(),
    loadMastery(),
  ])
  const subj = new Map(subjects.map((s) => [s.id, s]))
  const minutesByArea: Record<AreaId, number> = { faculdade: 0, ensino: 0, idiomas: 0 }
  for (const s of sessions) {
    const a = s.subjectId ? subj.get(s.subjectId)?.areaId : undefined
    if (a) minutesByArea[a] += Math.round(s.seconds / 60)
  }
  const plan = blocks.filter((b) => b.kind === 'study' || b.kind === 'revisao')
  const errorsByReason: Partial<Record<ErrorReason, number>> = {}
  const errorsByCategory: Partial<Record<WritingCategory, number>> = {}
  for (const e of errors) {
    if (e.reason) errorsByReason[e.reason] = (errorsByReason[e.reason] ?? 0) + 1
    if (e.category) errorsByCategory[e.category] = (errorsByCategory[e.category] ?? 0) + 1
  }
  const tmap = new Map(topics.map((t) => [t.id, t]))
  const weakest = [...mastery.topics.entries()]
    .sort((a, b) => a[1].value - b[1].value)
    .slice(0, 3)
    .map(([id, m]) => {
      const t = tmap.get(id)
      return { topicId: id, name: t?.name ?? '?', subjectName: (t && subj.get(t.subjectId)?.name) ?? '', value: m.value }
    })
  const ws = [...mastery.subjects.entries()].sort((a, b) => a[1] - b[1])[0]
  return {
    weekId,
    minutesByArea,
    planned: plan.length,
    done: plan.filter((b) => b.done).length,
    sessions: sessions.length,
    errorsByReason,
    errorsByCategory,
    weakest,
    weakestSubject: ws && subj.get(ws[0]) ? { id: ws[0], name: subj.get(ws[0])!.name, value: ws[1] } : undefined,
  }
}

/** Salva a revisão no registro da semana passada (criando-o se preciso). */
export async function saveRetro(weekId: string, worked: string, blocked: string, tags: RetroTag[]) {
  const retro = { worked: worked.trim(), blocked: blocked.trim(), tags, at: Date.now() }
  const w = await db.weeks.get(weekId)
  if (w) return db.weeks.update(weekId, { retro })
  const s = await getSettings()
  await db.weeks.put({ id: weekId, percents: s.lastPercents, availability: s.defaultAvailability, pausedSubjectIds: [], createdAt: Date.now(), retro })
}
