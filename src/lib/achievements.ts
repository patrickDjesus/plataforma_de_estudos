import type { AreaId, Block, Flashcard, Note, Review, Session, Subject } from '../db/types'
import { addDays, toISODate } from './dates'
import { linkedTitles } from './wikilink'
import { XP_PER_BLOCK, XP_PER_REVIEW, levelInfo } from './xp'

export interface StatsInput {
  sessions: Session[]
  blocks: Block[]
  reviews: Review[]
  notes: Note[]
  subjects: Subject[]
  cards?: Flashcard[]
}

export interface Stats {
  totalSeconds: number
  secondsByArea: Record<AreaId, number>
  xpByArea: Record<AreaId, number>
  doneBlocks: number
  reviewsDone: number
  cardsDone: number
  longestSession: number
  longestStreak: number
  notesCount: number
  citations: number
  earlyBird: boolean
  nightOwl: boolean
  perfectWeeks: number
}

const AREAS: AreaId[] = ['faculdade', 'ensino', 'idiomas']

export function computeStats({ sessions, blocks, reviews, notes, subjects, cards = [] }: StatsInput): Stats {
  const areaOf = new Map(subjects.map((s) => [s.id, s.areaId]))
  const secondsByArea = { faculdade: 0, ensino: 0, idiomas: 0 } as Record<AreaId, number>
  const xpByArea = { faculdade: 0, ensino: 0, idiomas: 0 } as Record<AreaId, number>
  for (const s of sessions) {
    const a = s.subjectId ? areaOf.get(s.subjectId) : undefined
    if (a) {
      secondsByArea[a] += s.seconds
      xpByArea[a] += Math.floor(s.seconds / 60)
    }
  }
  const done = blocks.filter((b) => b.done && (b.kind === 'study' || b.kind === 'revisao'))
  for (const b of done) {
    const a = b.subjectId ? areaOf.get(b.subjectId) : undefined
    if (a) xpByArea[a] += XP_PER_BLOCK
  }
  for (const r of reviews) {
    const a = areaOf.get(r.subjectId)
    if (a) xpByArea[a] += r.history.length * XP_PER_REVIEW
  }

  // Maior sequência de dias
  const days = [...new Set([...sessions.map((s) => toISODate(new Date(s.startedAt))), ...done.map((b) => b.date), ...reviews.flatMap((r) => r.history.map((h) => h.date))])].sort()
  let longestStreak = 0
  let run = 0
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && addDays(days[i - 1], 1) === days[i] ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
  }

  // Semanas com plano 100% cumprido (pelo menos 5 blocos)
  const byWeek = new Map<string, Block[]>()
  for (const b of blocks) if (b.kind === 'study' || b.kind === 'revisao') byWeek.set(b.weekId, [...(byWeek.get(b.weekId) ?? []), b])
  const perfectWeeks = [...byWeek.values()].filter((list) => list.length >= 5 && list.every((b) => b.done)).length

  const titles = new Set(notes.map((n) => n.title.trim().toLowerCase()))
  const citations = notes.reduce((acc, n) => acc + linkedTitles(n.content).filter((t) => titles.has(t.trim().toLowerCase())).length, 0)

  return {
    totalSeconds: sessions.reduce((a, s) => a + s.seconds, 0),
    secondsByArea,
    xpByArea,
    doneBlocks: done.length,
    reviewsDone: reviews.reduce((a, r) => a + r.history.length, 0),
    cardsDone: cards.reduce((a, c) => a + c.history.length, 0),
    longestSession: Math.max(0, ...sessions.map((s) => s.seconds)),
    longestStreak,
    notesCount: notes.filter((n) => n.content.replace(/<[^>]+>/g, '').trim().length >= 20).length,
    citations,
    earlyBird: sessions.some((s) => new Date(s.startedAt).getHours() < 8 && s.seconds >= 15 * 60),
    nightOwl: sessions.some((s) => new Date(s.startedAt).getHours() >= 22 && s.seconds >= 15 * 60),
    perfectWeeks,
  }
}

export function areaLevels(stats: Stats) {
  return AREAS.map((id) => ({ id, ...levelInfo(stats.xpByArea[id]) }))
}

export type AchievementIcon = 'footprints' | 'timer' | 'flame' | 'calendar' | 'mountain' | 'graduation' | 'languages' | 'brain' | 'link' | 'pen' | 'sunrise' | 'moon' | 'trophy'

export interface Achievement {
  id: string
  title: string
  description: string
  icon: AchievementIcon
  color: string
  value: number
  target: number
  unlocked: boolean
}

const H = 3600

export function achievements(s: Stats): Achievement[] {
  const list: Omit<Achievement, 'unlocked'>[] = [
    { id: 'primeiro-passo', title: 'Primeiro passo', description: 'Conclua seu primeiro bloco de estudo.', icon: 'footprints', color: '#3e63f2', value: s.doneBlocks, target: 1 },
    { id: 'foco-capivara', title: 'Foco de capivara', description: 'Faça uma sessão de 50 minutos sem parar.', icon: 'timer', color: '#8b5cf6', value: Math.floor(s.longestSession / 60), target: 50 },
    { id: 'pegando-ritmo', title: 'Pegando o ritmo', description: 'Estude 3 dias seguidos.', icon: 'flame', color: '#f97316', value: s.longestStreak, target: 3 },
    { id: 'semana-de-ferro', title: 'Semana de ferro', description: 'Estude 7 dias seguidos.', icon: 'flame', color: '#ef4444', value: s.longestStreak, target: 7 },
    { id: 'plano-cumprido', title: 'Plano cumprido', description: 'Feche uma semana com 100% dos blocos feitos.', icon: 'calendar', color: '#10b981', value: s.perfectWeeks, target: 1 },
    { id: 'maratonista', title: 'Maratonista', description: 'Some 10 horas de estudo.', icon: 'mountain', color: '#0ea5e9', value: Math.floor(s.totalSeconds / H), target: 10 },
    { id: 'universitario', title: 'Universitário de verdade', description: 'Some 100 horas de Faculdade.', icon: 'graduation', color: '#3e63f2', value: Math.floor(s.secondsByArea.faculdade / H), target: 100 },
    { id: 'poliglota', title: 'Poliglota', description: 'Some 5 horas de Idiomas.', icon: 'languages', color: '#10b981', value: Math.floor(s.secondsByArea.idiomas / H), target: 5 },
    { id: 'memoria-capivara', title: 'Memória de capivara', description: 'Registre 10 revisões.', icon: 'brain', color: '#ec4899', value: s.reviewsDone, target: 10 },
    { id: 'cartografo', title: 'Cartógrafo', description: 'Crie 10 ligações [[…]] entre notas.', icon: 'link', color: '#f59e0b', value: s.citations, target: 10 },
    { id: 'escritor', title: 'Escritor', description: 'Escreva em 20 notas do caderno.', icon: 'pen', color: '#14b8a6', value: s.notesCount, target: 20 },
    { id: 'madrugador', title: 'Madrugador', description: 'Estude 15 min antes das 8h.', icon: 'sunrise', color: '#f59e0b', value: s.earlyBird ? 1 : 0, target: 1 },
    { id: 'coruja', title: 'Coruja', description: 'Estude 15 min depois das 22h.', icon: 'moon', color: '#6366f1', value: s.nightOwl ? 1 : 0, target: 1 },
  ]
  return list.map((a) => ({ ...a, value: Math.min(a.value, a.target), unlocked: a.value >= a.target }))
}
