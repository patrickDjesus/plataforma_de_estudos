import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { DEFAULT_SETTINGS } from './repo'
import type { AreaId, Subject } from './types'

export const AREAS: { id: AreaId; name: string }[] = [
  { id: 'faculdade', name: 'Faculdade' },
  { id: 'ensino', name: 'Ensino Médio' },
  { id: 'idiomas', name: 'Idiomas' },
]

const AREA_ORDER: Record<AreaId, number> = { faculdade: 0, ensino: 1, idiomas: 2 }
const bySubjectOrder = (a: Subject, b: Subject) => AREA_ORDER[a.areaId] - AREA_ORDER[b.areaId] || a.createdAt - b.createdAt

export const useSubjects = () => useLiveQuery(async () => (await db.subjects.toArray()).sort(bySubjectOrder), [], [])
export const useTopics = () => useLiveQuery(() => db.topics.orderBy('order').toArray(), [], [])
export const useNotes = () => useLiveQuery(() => db.notes.toArray(), [], [])
export const useNote = (id?: string) => useLiveQuery(() => (id ? db.notes.get(id) : undefined), [id])
export const useWeek = (id: string) => useLiveQuery(() => db.weeks.get(id), [id])
export const useWeekBlocks = (weekId: string) => useLiveQuery(() => db.blocks.where('weekId').equals(weekId).toArray(), [weekId], [])
export const useSettings = () => useLiveQuery(() => db.settings.get('main'), [], undefined) ?? DEFAULT_SETTINGS
export const useTimer = () => useLiveQuery(() => db.timer.get('timer'), [])
export const useSessions = () => useLiveQuery(() => db.sessions.toArray(), [], [])

export function useSubjectMap() {
  const subjects = useSubjects()
  return new Map(subjects.map((s) => [s.id, s]))
}
