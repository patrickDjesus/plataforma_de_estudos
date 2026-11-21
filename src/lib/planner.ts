import type { AreaId, AreaPercents, Availability, Block, Subject, TimeWindow, Topic } from '../db/types'
import { daysUntil, weekDates } from './dates'

export interface PlannerSettings {
  blockMinutes: number
  minBlockMinutes: number
  breakMinutes: number
  maxSameSubjectInRow: number
  reviewMinutes?: number
  maxReviewShare?: number
}

export interface PlanReview {
  topicId: string
  subjectId: string
  due: string
}

export interface PlanInput {
  weekId: string
  availability: Availability
  percents: AreaPercents
  subjects: Subject[] // já sem as pausadas
  topics: Topic[]
  /** Blocos que permanecem (manuais, concluídos, eventos): ocupam horário. */
  busy: (Pick<Block, 'date' | 'start' | 'end'> & Partial<Pick<Block, 'kind' | 'done' | 'missed'>>)[]
  settings: PlannerSettings
  /** Planeja só a partir deste momento (para check-in no meio da semana). */
  now: Date
  /** Revisões vencidas ou que vencem nesta semana. */
  reviews?: PlanReview[]
  /** Minutos perdidos por matéria, que ganham prioridade no replanejamento. */
  carryOver?: Record<string, number>
  /** Domínio (0–100) por tópico; tópicos sem dados ficam de fora. */
  mastery?: Record<string, number>
  /** Domínio médio por matéria. */
  subjectMastery?: Record<string, number>
  /**
   * Modo flexível: em vez de janelas de horário, minutos de estudo por dia (seg..dom).
   * Os blocos saem em sequência, sem hora marcada; o horário guardado é só uma ordem.
   */
  dailyMinutes?: number[]
}

/** Início fictício dos blocos do modo flexível (só serve para ordenar). */
export const FLEX_DAY_START = 6 * 60

/** Matérias com domínio baixo ganham até +60% de tempo. */
export function masteryBoost(avg: number | undefined) {
  return avg === undefined ? 1 : 1 + Math.max(0, (60 - avg) / 100)
}

/**
 * Ordem dos tópicos de uma matéria: primeiro os fracos que você já estudou (do mais fraco),
 * depois os pendentes na ordem da lista. Tópicos concluídos voltam se ficaram muito fracos (< 40).
 */
export function orderTopics(topics: Topic[], mastery: Record<string, number> = {}): Topic[] {
  const has = (t: Topic) => mastery[t.id] !== undefined
  const candidates = topics.filter((t) => !t.done || (has(t) && mastery[t.id] < 40))
  const weak = candidates.filter((t) => has(t) && mastery[t.id] < 50).sort((a, b) => mastery[a.id] - mastery[b.id])
  const rest = candidates.filter((t) => !weak.includes(t)).sort((a, b) => a.order - b.order)
  return [...weak, ...rest]
}

export interface Slot {
  date: string
  start: number
  end: number
}

export type PlannedBlock = Omit<Block, 'id'>

/** Subtrai intervalos ocupados de uma janela. */
export function subtract(win: TimeWindow, busy: TimeWindow[]): TimeWindow[] {
  let parts: TimeWindow[] = [win]
  for (const b of busy) {
    const next: TimeWindow[] = []
    for (const p of parts) {
      if (b.end <= p.start || b.start >= p.end) {
        next.push(p)
        continue
      }
      if (b.start > p.start) next.push({ start: p.start, end: b.start })
      if (b.end < p.end) next.push({ start: b.end, end: p.end })
    }
    parts = next
  }
  return parts
}

/** Corta as janelas livres da semana em horários de estudo. */
export function buildSlots(input: PlanInput): Slot[] {
  if (input.dailyMinutes) return buildFlexSlots(input, input.dailyMinutes)
  const { availability, busy, settings, now, weekId } = input
  const dates = weekDates(weekId)
  const todayIso = dates.find((d) => daysUntil(d, now) === 0)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const slots: Slot[] = []

  dates.forEach((date, i) => {
    if (daysUntil(date, now) < 0) return
    const dayBusy = busy.filter((b) => b.date === date).map((b) => ({ start: b.start, end: b.end }))
    if (date === todayIso) dayBusy.push({ start: 0, end: nowMin })
    const windows = [...(availability[i] ?? [])].sort((a, b) => a.start - b.start)
    for (const w of windows) {
      for (const free of subtract(w, dayBusy)) {
        let s = free.start
        while (s + settings.minBlockMinutes <= free.end) {
          const len = Math.min(settings.blockMinutes, free.end - s)
          slots.push({ date, start: s, end: s + len })
          s += len + settings.breakMinutes
        }
      }
    }
  })
  return slots
}

/**
 * Modo flexível: cada dia tem um orçamento de minutos. O que já ficou no dia (feito, iniciado,
 * manual) desconta do orçamento; o resto vira blocos em sequência, sem pausa entre eles.
 * Hoje conta inteiro (você estuda na hora que quiser).
 */
function buildFlexSlots(input: PlanInput, daily: number[]): Slot[] {
  const { busy, settings, now, weekId } = input
  const slots: Slot[] = []
  weekDates(weekId).forEach((date, i) => {
    if (daysUntil(date, now) < 0) return
    const kept = busy.filter((b) => b.date === date && (b.kind === undefined || b.kind === 'study' || b.kind === 'revisao') && !(b.missed && !b.done))
    let left = Math.max(0, (daily[i] ?? 0) - kept.reduce((a, b) => a + (b.end - b.start), 0))
    let s = Math.max(FLEX_DAY_START, ...kept.map((b) => b.end))
    while (left >= settings.minBlockMinutes && s + settings.minBlockMinutes <= 24 * 60) {
      // não deixa sobrar um pedacinho menor que o bloco mínimo: junta no último
      let len = Math.min(settings.blockMinutes, left)
      if (left - len > 0 && left - len < settings.minBlockMinutes) len = left
      len = Math.min(len, 24 * 60 - s)
      slots.push({ date, start: s, end: s + len })
      s += len
      left -= len
    }
  })
  return slots
}

/** Peso efetivo: peso × obrigatória × urgência do prazo. */
export function effectiveWeight(s: Subject, now: Date): number {
  let w = Math.max(1, Math.min(5, s.weight))
  if (s.mandatory) w *= 2
  if (s.deadline) {
    const d = daysUntil(s.deadline, now)
    if (d >= 0 && d <= 14) w *= 1 + ((14 - d) / 14) * 2 // até 3× na véspera
  }
  return w
}

/** Minutos-alvo de cada matéria na semana. */
export function subjectTargets(input: PlanInput, totalMinutes: number): Map<string, number> {
  const { subjects, percents, now } = input
  const areas = (Object.keys(percents) as AreaId[]).filter((a) => subjects.some((s) => s.areaId === a))
  const pctSum = areas.reduce((acc, a) => acc + percents[a], 0)
  const targets = new Map<string, number>()
  if (pctSum <= 0) return targets
  for (const area of areas) {
    const areaMin = (totalMinutes * percents[area]) / pctSum // áreas vazias redistribuem
    const list = subjects.filter((s) => s.areaId === area)
    const w = (s: Subject) => effectiveWeight(s, now) * masteryBoost(input.subjectMastery?.[s.id])
    const wSum = list.reduce((acc, s) => acc + w(s), 0)
    for (const s of list) targets.set(s.id, (areaMin * w(s)) / wSum)
  }
  return targets
}

/**
 * Conteúdo perdido ganha prioridade, mas só dentro da própria área: a matéria atrasada
 * puxa tempo das outras matérias da mesma área, sem roubar das outras áreas.
 * (Antes o atraso somava por cima e uma área com muito atraso engolia a semana inteira.)
 */
export function applyCarryOver(targets: Map<string, number>, input: Pick<PlanInput, 'subjects' | 'carryOver'>) {
  const carry = input.carryOver ?? {}
  const areas = new Set(input.subjects.filter((s) => targets.has(s.id)).map((s) => s.areaId))
  for (const area of areas) {
    const ids = input.subjects.filter((s) => s.areaId === area && targets.has(s.id)).map((s) => s.id)
    const budget = ids.reduce((a, id) => a + targets.get(id)!, 0)
    const boosted = ids.map((id) => targets.get(id)! + (carry[id] ?? 0))
    const sum = boosted.reduce((a, b) => a + b, 0)
    if (sum <= 0) continue
    ids.forEach((id, i) => targets.set(id, (boosted[i] * budget) / sum))
  }
}

/**
 * Encaixa as revisões no início dos horários livres, a partir da data de vencimento,
 * gastando no máximo `maxReviewShare` da semana. Devolve os blocos de revisão
 * e os horários que sobraram para estudo.
 */
export function placeReviews(input: PlanInput, slots: Slot[]): { reviewBlocks: PlannedBlock[]; rest: Slot[] } {
  const reviews = [...(input.reviews ?? [])].sort((a, b) => a.due.localeCompare(b.due))
  const len = input.settings.reviewMinutes ?? 20
  const total = slots.reduce((acc, s) => acc + (s.end - s.start), 0)
  let budget = total * (input.settings.maxReviewShare ?? 0.2)
  const cursor = slots.map((s) => s.start)
  const reviewBlocks: PlannedBlock[] = []
  for (const r of reviews) {
    if (budget < len) break
    const i = slots.findIndex((s, k) => s.date >= r.due && s.end - cursor[k] >= len)
    const j = i >= 0 ? i : slots.findIndex((s, k) => r.due < s.date && s.end - cursor[k] >= len)
    const k = i >= 0 ? i : j
    if (k < 0) continue
    reviewBlocks.push({
      weekId: input.weekId,
      date: slots[k].date,
      start: cursor[k],
      end: cursor[k] + len,
      kind: 'revisao',
      subjectId: r.subjectId,
      topicId: r.topicId,
      done: false,
      studiedSeconds: 0,
      auto: true,
    })
    cursor[k] += len
    budget -= len
  }
  const rest = slots
    .map((s, k) => ({ ...s, start: cursor[k] }))
    .filter((s) => s.end - s.start >= input.settings.minBlockMinutes)
  return { reviewBlocks, rest }
}

export function planWeek(input: PlanInput): PlannedBlock[] {
  const { reviewBlocks, rest: slots } = placeReviews(input, buildSlots(input))
  const total = slots.reduce((acc, s) => acc + (s.end - s.start), 0)
  const targets = subjectTargets(input, total)
  if (targets.size === 0) return reviewBlocks
  applyCarryOver(targets, input)

  const assigned = new Map<string, number>([...targets.keys()].map((k) => [k, 0]))
  const topicsBySubject = new Map<string, Topic[]>()
  for (const s of input.subjects) {
    topicsBySubject.set(
      s.id,
      orderTopics(
        input.topics.filter((t) => t.subjectId === s.id),
        input.mastery,
      ),
    )
  }
  const topicCursor = new Map<string, number>()
  const result: PlannedBlock[] = []
  const max = input.settings.maxSameSubjectInRow

  slots.forEach((slot, idx) => {
    // Quantas vezes seguidas (mesmo dia) a matéria já apareceu antes deste horário
    const runOf = (subjectId: string) => {
      let n = 0
      for (let j = idx - 1; j >= 0; j--) {
        const prev = result[j]
        if (!prev || prev.date !== slot.date || prev.subjectId !== subjectId) break
        n++
      }
      return n
    }
    const ranked = [...targets.keys()]
      .map((id) => ({ id, deficit: targets.get(id)! - assigned.get(id)! }))
      .sort((a, b) => b.deficit - a.deficit)
    const pick = ranked.find((r) => runOf(r.id) < max) ?? ranked[0]

    const len = slot.end - slot.start
    assigned.set(pick.id, assigned.get(pick.id)! + len)
    const topics = topicsBySubject.get(pick.id) ?? []
    const c = topicCursor.get(pick.id) ?? 0
    topicCursor.set(pick.id, c + 1)
    const subject = input.subjects.find((s) => s.id === pick.id)!

    result.push({
      weekId: input.weekId,
      date: slot.date,
      start: slot.start,
      end: slot.end,
      kind: 'study',
      subjectId: subject.id,
      topicId: topics.length ? topics[c % topics.length].id : undefined,
      done: false,
      studiedSeconds: 0,
      auto: true,
    })
  })
  return [...reviewBlocks, ...result]
}
