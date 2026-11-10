import Dexie, { type EntityTable } from 'dexie'
import type { Block, Note, Review, Session, Settings, Subject, TimerState, Topic, Week } from './types'

/**
 * Banco local (IndexedDB). Toda leitura/escrita passa por `src/db/*`,
 * então trocar por Supabase no futuro mexe só nesta pasta.
 */
export class MendoncaDB extends Dexie {
  subjects!: EntityTable<Subject, 'id'>
  topics!: EntityTable<Topic, 'id'>
  notes!: EntityTable<Note, 'id'>
  weeks!: EntityTable<Week, 'id'>
  blocks!: EntityTable<Block, 'id'>
  sessions!: EntityTable<Session, 'id'>
  settings!: EntityTable<Settings, 'id'>
  timer!: EntityTable<TimerState, 'id'>
  reviews!: EntityTable<Review, 'topicId'>

  constructor() {
    super('mendonca')
    this.version(1).stores({
      subjects: 'id, areaId',
      topics: 'id, subjectId, order',
      notes: 'id, subjectId, topicId, title, updatedAt',
      weeks: 'id',
      blocks: 'id, weekId, date, subjectId, topicId',
      sessions: 'id, startedAt, subjectId',
      settings: 'id',
      timer: 'id',
    })
    // V2: revisões espaçadas
    this.version(2).stores({ reviews: 'topicId, due, subjectId' })
  }
}

export const db = new MendoncaDB()

export const uid = () => crypto.randomUUID()
