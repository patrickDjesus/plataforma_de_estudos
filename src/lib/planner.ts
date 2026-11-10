import type { AreaId, AreaPercents, Availability, Block, Subject, TimeWindow, Topic } from '../db/types'
import { daysUntil, weekDates } from './dates'

export interface PlannerSettings {
  blockMinutes: number
  minBlockMinutes: number
  breakMinutes: number
  maxSameSubjectInRow: number
}

export interface PlanInput {
  weekId: string
  availability: Availability
  percents: AreaPercents
  subjects: Subject[] // já sem as pausadas
  topics: Topic[]
  /** Blocos que permanecem (manuais, concluídos, eventos): ocupam horário. */
  busy: Pick<Block, 'date' | 'start' | 'end'>[]
  settings: PlannerSettings
  /** Planeja só a partir deste momento (para check-in no meio da semana). */
  now: Date
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
    const wSum = list.reduce((acc, s) => acc + effectiveWeight(s, now), 0)
    for (const s of list) targets.set(s.id, (areaMin * effectiveWeight(s, now)) / wSum)
  }
  return targets
}

export function planWeek(input: PlanInput): PlannedBlock[] {
  const slots = buildSlots(input)
  const total = slots.reduce((acc, s) => acc + (s.end - s.start), 0)
  const targets = subjectTargets(input, total)
  if (targets.size === 0) return []

  const assigned = new Map<string, number>([...targets.keys()].map((k) => [k, 0]))
  const topicsBySubject = new Map<string, Topic[]>()
  for (const s of input.subjects) {
    topicsBySubject.set(
      s.id,
      input.topics.filter((t) => t.subjectId === s.id && !t.done).sort((a, b) => a.order - b.order),
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
  return result
}
