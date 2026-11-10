export const DAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
export const DAY_SHORT = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Segunda-feira da semana de `d`, no formato YYYY-MM-DD. */
export function weekIdOf(d: Date = new Date()): string {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (copy.getDay() + 6) % 7 // 0 = segunda
  copy.setDate(copy.getDate() - dow)
  return toISODate(copy)
}

/** Índice do dia na semana (0 = segunda). */
export function dayIndex(d: Date = new Date()): number {
  return (d.getDay() + 6) % 7
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function weekDates(weekId: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekId, i))
}

export function minutesNow(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes()
}

export function fmtTime(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

export function parseTime(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function fmtDayMonth(iso: string): string {
  const d = fromISODate(iso)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function fmtWeekRange(weekId: string): string {
  const a = fromISODate(weekId)
  const b = fromISODate(addDays(weekId, 6))
  return `${pad(a.getDate())} de ${MONTHS[a.getMonth()]} – ${pad(b.getDate())} de ${MONTHS[b.getMonth()]}`
}

export function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h${pad(m)}`
}

export function fmtClock(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function daysUntil(iso: string, from: Date = new Date()): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  return Math.round((fromISODate(iso).getTime() - a) / 86400000)
}
