import type { AreaId, Subject } from '../db/types'
import { daysUntil, fromISODate } from './dates'

/** Matéria da semana em cada área (id da matéria). */
export type Themes = Partial<Record<AreaId, string>>

export interface ThemeSuggestion {
  id: string
  reason: string
}

/**
 * Sugere a matéria da semana de cada área (rodízio inteligente):
 * prova chegando > há mais tempo sem ser tema > menor domínio > peso. Nunca repete a da semana passada
 * (se a área tiver outra opção).
 */
export function suggestThemes(subjects: Subject[], history: { weekId: string; themes?: Themes }[], mastery: Record<string, number>, weekId: string, now = new Date()): Partial<Record<AreaId, ThemeSuggestion>> {
  const out: Partial<Record<AreaId, ThemeSuggestion>> = {}
  const past = history.filter((h) => h.weekId < weekId && h.themes).sort((a, b) => b.weekId.localeCompare(a.weekId))
  const weeksSince = (id: string) => {
    const i = past.findIndex((h) => Object.values(h.themes!).includes(id))
    return i < 0 ? null : Math.round((fromISODate(weekId).getTime() - fromISODate(past[i].weekId).getTime()) / (7 * 86400000))
  }
  const lastWeek = past[0]?.themes
  const areas = [...new Set(subjects.map((s) => s.areaId))]
  for (const area of areas) {
    const list = subjects.filter((s) => s.areaId === area)
    if (!list.length) continue
    const scored = list.map((s) => {
      const since = weeksSince(s.id)
      const m = mastery[s.id]
      const exam = s.deadline ? daysUntil(s.deadline, now) : null
      let score = (since === null ? 8 : Math.min(8, since)) + s.weight * 0.3
      let reason = since === null ? 'ainda não foi tema' : `${since} semana${since > 1 ? 's' : ''} sem ser tema`
      if (m !== undefined && m < 60) score += (60 - m) / 15
      if (m !== undefined && m < 45) reason = `domínio baixo (${m}%)`
      if (exam !== null && exam >= 0 && exam <= 14) {
        score += 20 - exam
        reason = exam === 0 ? 'prova hoje' : `prova em ${exam} dia${exam > 1 ? 's' : ''}`
      }
      if (list.length > 1 && lastWeek?.[area] === s.id && !(exam !== null && exam >= 0 && exam <= 14)) score -= 100
      return { s, score, reason }
    })
    scored.sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name))
    out[area] = { id: scored[0].s.id, reason: scored[0].reason }
  }
  return out
}

/** Matérias que entram no estudo novo da semana: só a do tema em cada área temática. */
export function themedSubjects<T extends Pick<Subject, 'id' | 'areaId'>>(active: T[], themes: Themes | undefined | null): T[] {
  if (!themes) return active
  return active.filter((s) => {
    const t = themes[s.areaId]
    // tema apagado ou pausado: a área volta a ser variada
    if (!t || !active.some((x) => x.id === t)) return true
    return s.id === t
  })
}
