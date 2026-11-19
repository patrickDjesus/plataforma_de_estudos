import type { AreaId, Availability, ErrorReason, RetroTag, WeekRetro, WritingCategory } from '../db/types'

export const RETRO_TAGS: { id: RetroTag; emoji: string; label: string }[] = [
  { id: 'pouco-tempo', emoji: '⏳', label: 'Pouco tempo' },
  { id: 'cansaco', emoji: '😴', label: 'Cansaço' },
  { id: 'distracoes', emoji: '📱', label: 'Distrações' },
  { id: 'materia-dificil', emoji: '🧗', label: 'Matéria difícil' },
  { id: 'plano-irreal', emoji: '🎯', label: 'Plano irreal' },
]

export interface WeekStats {
  weekId: string
  minutesByArea: Record<AreaId, number>
  planned: number
  done: number
  sessions: number
  errorsByReason: Partial<Record<ErrorReason, number>>
  errorsByCategory: Partial<Record<WritingCategory, number>>
  weakest: { topicId: string; name: string; subjectName: string; value: number }[]
  /** Matéria com menor domínio médio. */
  weakestSubject?: { id: string; name: string; value: number }
}

export const hasWeekData = (s: WeekStats) => s.sessions > 0 || s.planned > 0

export const completionRate = (s: WeekStats) => (s.planned ? s.done / s.planned : 0)

export interface RetroHints {
  foco: string[]
  horarios: string[]
  /** Sugere enxugar os horários (fator de 0 a 1 a manter). */
  trim?: number
}

/** Transforma a revisão da semana passada em dicas para o check-in desta semana. */
export function retroHints(stats: WeekStats | null, retro?: WeekRetro): RetroHints {
  const h: RetroHints = { foco: [], horarios: [] }
  if (!stats || !hasWeekData(stats)) return h
  const tags = new Set(retro?.tags ?? [])
  const rate = completionRate(stats)
  const pct = Math.round(rate * 100)
  if (stats.planned > 0 && (rate < 0.6 || tags.has('plano-irreal'))) {
    h.horarios.push(`Você cumpriu ${pct}% do plano. Marque só os horários que você realmente consegue usar: um plano menor e cumprido rende mais.`)
    h.trim = rate < 0.4 ? 0.7 : 0.8
  } else if (stats.planned > 0 && rate >= 0.9) {
    h.horarios.push(`Você cumpriu ${pct}% do plano. Se sobrou fôlego, dá para acrescentar um horário.`)
  }
  if (tags.has('pouco-tempo')) h.horarios.push('Faltou tempo: janelas curtas (30–60 min) em dias corridos ainda contam. Que tal encaixar algumas?')
  if (tags.has('cansaco')) h.horarios.push('Cansaço: prefira estudar mais cedo e deixe a noite mais leve, com revisões e cartões.')
  if (tags.has('distracoes')) h.foco.push('Distrações: comece cada bloco pelo modo foco (Começar agora) e deixe o celular longe nos ciclos.')
  if (stats.weakestSubject && stats.weakestSubject.value < 60)
    h.foco.push(`${stats.weakestSubject.name} está com domínio de ${stats.weakestSubject.value}%. O planejador já dá mais tempo a ela${tags.has('materia-dificil') ? ', e vale aumentar o foco dessa área' : ''}.`)
  else if (tags.has('materia-dificil')) h.foco.push('Matéria difícil: aumente o foco da área dela; o planejador prioriza os tópicos de menor domínio.')
  const total = stats.minutesByArea.faculdade + stats.minutesByArea.ensino + stats.minutesByArea.idiomas
  if (total >= 60 && stats.minutesByArea.faculdade / total < 0.6)
    h.foco.push(`A faculdade ficou com ${Math.round((stats.minutesByArea.faculdade / total) * 100)}% do tempo estudado. A meta é pelo menos 2/3.`)
  const top = Object.entries(stats.errorsByReason).sort((a, b) => b[1] - a[1])[0]
  if (top && top[1] >= 3) {
    if (top[0] === 'desatencao') h.foco.push('Muitos erros por desatenção: releia o enunciado antes de responder nos desafios.')
    if (top[0] === 'tempo') h.foco.push('Muitos erros por falta de tempo: treine com desafios curtos e cronometrados.')
    if (top[0] === 'nao-sabia') h.foco.push('Muitos erros por conteúdo novo: use o Explicar no caderno antes dos desafios.')
  }
  return h
}

/** Enxuga cada janela pelo fim, mantendo `keep` da duração (mín. 30 min). */
export function trimAvailability(av: Availability, keep: number): Availability {
  return av.map((day) =>
    day.map((w) => {
      const len = w.end - w.start
      const next = Math.max(Math.min(30, len), Math.round((len * keep) / 15) * 15)
      return { start: w.start, end: w.start + next }
    }),
  )
}
