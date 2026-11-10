import { db, uid } from './db'
import type { AreaId, AreaPercents, Availability, Block, Note, ReviewRating, Settings, Subject, TimerState, Topic, Week } from './types'
import { autoColor } from '../lib/colors'
import { addDays, minutesNow, toISODate, weekIdOf } from '../lib/dates'
import { applyRating, newReview, RATING_LABEL } from '../lib/review'
import { planWeek } from '../lib/planner'
import { showMascot } from '../lib/mascotBus'
import { XP_PER_BLOCK } from '../lib/xp'

// ---------- Configurações ----------

const eve = [{ start: 19 * 60, end: 22 * 60 }]
export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  blockMinutes: 50,
  minBlockMinutes: 25,
  maxBlockMinutes: 120,
  breakMinutes: 10,
  maxSameSubjectInRow: 2,
  reviewMinutes: 20,
  maxReviewShare: 0.2,
  defaultAvailability: [eve, eve, eve, eve, eve, [{ start: 9 * 60, end: 12 * 60 }], []],
  lastPercents: { faculdade: 70, ensino: 20, idiomas: 10 },
}

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('main')
  if (s) return s
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

export async function updateSettings(patch: Partial<Settings>) {
  const s = await getSettings()
  await db.settings.put({ ...s, ...patch, id: 'main' })
}

// ---------- Matérias ----------

export async function addSubject(areaId: AreaId, name: string): Promise<string> {
  const count = await db.subjects.where('areaId').equals(areaId).count()
  const id = uid()
  await db.subjects.add({
    id,
    areaId,
    name: name.trim(),
    color: autoColor(areaId, count),
    weight: 3,
    mandatory: areaId === 'faculdade',
    createdAt: Date.now(),
  })
  return id
}

export const updateSubject = (id: string, patch: Partial<Subject>) => db.subjects.update(id, patch)

export async function deleteSubject(id: string) {
  await db.transaction('rw', [db.subjects, db.topics, db.notes, db.blocks, db.reviews], async () => {
    await db.subjects.delete(id)
    await db.reviews.where('subjectId').equals(id).delete()
    await db.topics.where('subjectId').equals(id).delete()
    await db.notes.where('subjectId').equals(id).delete()
    // Mantém o histórico (blocos concluídos); remove só o que ainda não aconteceu
    await db.blocks.where('subjectId').equals(id).filter((b) => !b.done && b.studiedSeconds === 0).delete()
  })
}

// ---------- Tópicos ----------

export async function addTopic(subjectId: string, name: string): Promise<string> {
  const last = await db.topics.where('subjectId').equals(subjectId).sortBy('order')
  const id = uid()
  await db.topics.add({ id, subjectId, name: name.trim(), order: (last.at(-1)?.order ?? -1) + 1, done: false, studiedSeconds: 0 })
  return id
}

export const updateTopic = (id: string, patch: Partial<Topic>) => db.topics.update(id, patch)

/** Concluir um tópico inicia a revisão espaçada (1ª revisão amanhã). */
export async function setTopicDone(id: string, done: boolean) {
  const t = await db.topics.get(id)
  if (!t) return
  await db.topics.update(id, { done, doneAt: done ? (t.doneAt ?? Date.now()) : undefined })
  if (done && !(await db.reviews.get(id))) await db.reviews.put(newReview(id, t.subjectId, toISODate(new Date())))
}

// ---------- Revisões ----------

/** Registra como foi a revisão e agenda a próxima. */
export async function rateReview(topicId: string, rating: ReviewRating, blockId?: string) {
  const r = await db.reviews.get(topicId)
  if (!r) return
  const today = toISODate(new Date())
  const next = applyRating(r, rating, today)
  await db.reviews.put(next)
  const weekId = weekIdOf(new Date())
  // O bloco usado para revisar fica concluído; outros blocos pendentes dessa revisão
  // (por exemplo, agendados para outro dia) são liberados e o horário volta para o plano
  if (blockId) await db.blocks.update(blockId, { done: true })
  const others = await db.blocks
    .where('topicId')
    .equals(topicId)
    .filter((b) => b.kind === 'revisao' && !b.done && b.weekId === weekId && b.id !== blockId)
    .toArray()
  if (others.length) {
    await db.blocks.bulkDelete(others.map((b) => b.id))
    await regeneratePlan(weekId)
  }
  const topic = await db.topics.get(topicId)
  const when = next.intervalDays === 1 ? 'amanhã' : `daqui a ${next.intervalDays} dias`
  showMascot({
    pose: rating === 'dificil' ? 'pensando' : rating === 'facil' ? 'formado' : 'comemorando',
    title: `${RATING_LABEL[rating].emoji} Revisão registrada`,
    text: `${topic?.name ?? 'Tópico'}: próxima revisão ${when}.${rating === 'dificil' ? ' Vamos reforçar isso logo!' : ''}`,
    autoHideMs: 6000,
  })
}

export async function dueReviews(until = toISODate(new Date())) {
  return db.reviews.where('due').belowOrEqual(until).toArray()
}

// ---------- Blocos perdidos ----------

/**
 * Marca como perdidos os blocos que passaram do horário sem estudo
 * e replaneja o resto da semana para encaixar o conteúdo de novo.
 */
export async function replanMissed(now = new Date()): Promise<number> {
  const weekId = weekIdOf(now)
  const today = toISODate(now)
  const nm = minutesNow(now)
  const timer = await db.timer.get('timer')
  const missed = await db.blocks
    .where('weekId')
    .equals(weekId)
    .filter(
      (b) =>
        (b.kind === 'study' || b.kind === 'revisao') &&
        !b.done &&
        !b.missed &&
        b.studiedSeconds === 0 &&
        b.id !== timer?.blockId &&
        (b.date < today || (b.date === today && b.end <= nm)),
    )
    .toArray()
  if (!missed.length) return 0
  await Promise.all(missed.map((b) => db.blocks.update(b.id, { missed: true })))
  await regeneratePlan(weekId, now)
  return missed.length
}

export async function deleteTopic(id: string) {
  await db.transaction('rw', [db.topics, db.notes, db.blocks, db.reviews], async () => {
    await db.topics.delete(id)
    await db.reviews.delete(id)
    await db.notes.where('topicId').equals(id).modify({ topicId: undefined })
    await db.blocks.where('topicId').equals(id).modify({ topicId: undefined })
  })
}

export async function reorderTopics(ids: string[]) {
  await db.transaction('rw', db.topics, async () => {
    await Promise.all(ids.map((id, order) => db.topics.update(id, { order })))
  })
}

// ---------- Notas ----------

export async function createNote(subjectId: string, topicId: string | undefined, title: string): Promise<string> {
  const id = uid()
  await db.notes.add({ id, subjectId, topicId, title: title.trim() || 'Sem título', content: '', updatedAt: Date.now() })
  return id
}

export const updateNote = (id: string, patch: Partial<Note>) => db.notes.update(id, { ...patch, updatedAt: Date.now() })
export const deleteNote = (id: string) => db.notes.delete(id)

export async function findNoteByTitle(title: string): Promise<Note | undefined> {
  const t = title.trim().toLowerCase()
  return (await db.notes.toArray()).find((n) => n.title.trim().toLowerCase() === t)
}

// ---------- Semana e planejamento ----------

export async function saveCheckin(weekId: string, percents: AreaPercents, availability: Availability, pausedSubjectIds: string[]) {
  const existing = await db.weeks.get(weekId)
  const week: Week = { id: weekId, percents, availability, pausedSubjectIds, createdAt: existing?.createdAt ?? Date.now() }
  await db.weeks.put(week)
  await updateSettings({ defaultAvailability: availability, lastPercents: percents })
  await regeneratePlan(weekId)
}

/** Um bloco "intocado" é automático, não iniciado e ainda no futuro: pode ser regerado. */
function isRegenerable(b: Block, now: Date) {
  if (!b.auto || b.done || b.studiedSeconds > 0) return false
  const today = toISODate(now)
  return b.date > today || (b.date === today && b.start >= minutesNow(now))
}

export async function regeneratePlan(weekId: string, now = new Date()) {
  const week = await db.weeks.get(weekId)
  if (!week) return
  const settings = await getSettings()
  const [allSubjects, topics, blocks] = await Promise.all([
    db.subjects.toArray(),
    db.topics.toArray(),
    db.blocks.where('weekId').equals(weekId).toArray(),
  ])
  const toRemove = blocks.filter((b) => isRegenerable(b, now))
  const keep = blocks.filter((b) => !isRegenerable(b, now))
  // Revisões que vencem até o fim da semana e ainda não têm bloco fixo pendente
  const weekEnd = addDays(weekId, 6)
  const pinned = new Set(keep.filter((b) => b.kind === 'revisao' && !b.done && !b.missed && b.topicId).map((b) => b.topicId!))
  const reviews = (await db.reviews.where('due').belowOrEqual(weekEnd).toArray()).filter((r) => !pinned.has(r.topicId) && topics.some((t) => t.id === r.topicId))
  // Minutos perdidos por matéria ganham prioridade
  const carryOver: Record<string, number> = {}
  for (const b of keep) if (b.missed && !b.done && b.kind === 'study' && b.subjectId) carryOver[b.subjectId] = (carryOver[b.subjectId] ?? 0) + (b.end - b.start)
  const planned = planWeek({
    reviews,
    carryOver,
    weekId,
    availability: week.availability,
    percents: week.percents,
    subjects: allSubjects.filter((s) => !week.pausedSubjectIds.includes(s.id)),
    topics,
    busy: keep,
    settings,
    now,
  })
  await db.transaction('rw', db.blocks, async () => {
    await db.blocks.bulkDelete(toRemove.map((b) => b.id))
    await db.blocks.bulkAdd(planned.map((p) => ({ ...p, id: uid() })))
  })
}

export const currentWeekId = () => weekIdOf(new Date())

// ---------- Blocos ----------

export async function addBlock(b: Omit<Block, 'id' | 'done' | 'studiedSeconds' | 'auto'>) {
  const id = uid()
  await db.blocks.add({ ...b, id, done: false, studiedSeconds: 0, auto: false })
  if (b.kind === 'prova' && b.subjectId) await applyDeadline(b.subjectId, b.date)
  return id
}

async function applyDeadline(subjectId: string, date: string) {
  const s = await db.subjects.get(subjectId)
  if (s && (!s.deadline || s.deadline < toISODate(new Date()) || date < s.deadline)) {
    await db.subjects.update(subjectId, { deadline: date })
  }
}

export async function updateBlock(id: string, patch: Partial<Block>) {
  // Mexer à mão num bloco o torna "fixo": o replanejamento não o apaga mais
  await db.blocks.update(id, { ...patch, auto: false })
  const b = await db.blocks.get(id)
  if (b?.kind === 'prova' && b.subjectId) await applyDeadline(b.subjectId, b.date)
}

export const deleteBlock = (id: string) => db.blocks.delete(id)

export async function setBlockDone(id: string, done: boolean) {
  const b = await db.blocks.get(id)
  await db.blocks.update(id, { done })
  if (done && b && !b.done) celebrateBlock(b, 0)
  // Um bloco perdido que na verdade foi feito libera o horário remarcado
  if (b?.missed) await regeneratePlan(b.weekId)
}

const CHEERS = ['Mandou bem!', 'Isso aí!', 'Mais um pra conta!', 'Que orgulho!', 'Arrasou!', 'Capivarístico!']

async function celebrateBlock(b: Pick<Block, 'id' | 'kind' | 'topicId' | 'subjectId'>, seconds: number) {
  const [topic, subject] = await Promise.all([b.topicId ? db.topics.get(b.topicId) : undefined, b.subjectId ? db.subjects.get(b.subjectId) : undefined])
  const what = topic?.name ?? subject?.name ?? 'o bloco'
  const xp = Math.floor(seconds / 60) + XP_PER_BLOCK
  const title = CHEERS[Math.floor(Math.random() * CHEERS.length)]

  // Revisão: o Capi pergunta como foi
  if (b.kind === 'revisao' && topic && (await db.reviews.get(topic.id))) {
    showMascot({
      pose: 'pensando',
      title: `Revisão feita! +${xp} XP`,
      text: `Como foi revisar ${topic.name}?`,
      actions: (['dificil', 'ok', 'facil'] as ReviewRating[]).map((r) => ({
        label: `${RATING_LABEL[r].emoji} ${RATING_LABEL[r].label}`,
        primary: r === 'ok',
        run: () => rateReview(topic.id, r, b.id),
      })),
    })
    return
  }
  // Estudo de um tópico: pergunta se terminou
  if (b.kind === 'study' && topic && !topic.done) {
    showMascot({
      pose: 'comemorando',
      title,
      text: `+${xp} XP! Você terminou o tópico ${topic.name}?`,
      actions: [
        {
          label: 'Sim, concluí',
          primary: true,
          run: async () => {
            await setTopicDone(topic.id, true)
            showMascot({ pose: 'estudando', title: 'Tópico concluído ✅', text: `Agendei a primeira revisão de ${topic.name} para amanhã. Revisar é o que faz ficar na cabeça!`, autoHideMs: 7000 })
          },
        },
        { label: 'Ainda falta' },
      ],
    })
    return
  }
  showMascot({ pose: 'comemorando', title, text: `Você concluiu ${what}. +${xp} XP pra você! 🎉`, autoHideMs: 6000 })
}

// ---------- Cronômetro ----------

export async function getTimer(): Promise<TimerState | undefined> {
  return db.timer.get('timer')
}

export async function startTimer(opts: { blockId?: string; subjectId?: string; topicId?: string; label: string }) {
  const current = await getTimer()
  if (current) await stopTimer()
  await db.timer.put({ id: 'timer', ...opts, startedAt: Date.now(), accumulated: 0 })
}

export function elapsedOf(t: TimerState, nowMs = Date.now()): number {
  return t.accumulated + (t.startedAt ? (nowMs - t.startedAt) / 1000 : 0)
}

export async function pauseTimer() {
  const t = await getTimer()
  if (!t || !t.startedAt) return
  await db.timer.put({ ...t, accumulated: elapsedOf(t), startedAt: null })
}

export async function resumeTimer() {
  const t = await getTimer()
  if (!t || t.startedAt) return
  await db.timer.put({ ...t, startedAt: Date.now() })
}

/** Para o cronômetro e grava a sessão. `markDone` também conclui o bloco. */
export async function stopTimer(markDone = false) {
  const t = await getTimer()
  if (!t) return
  const seconds = Math.round(elapsedOf(t))
  await db.transaction('rw', [db.timer, db.sessions, db.blocks, db.topics], async () => {
    await db.timer.delete('timer')
    if (seconds >= 10) {
      await db.sessions.add({
        id: uid(),
        blockId: t.blockId,
        subjectId: t.subjectId,
        topicId: t.topicId,
        startedAt: Date.now() - seconds * 1000,
        seconds,
      })
      if (t.topicId) {
        const topic = await db.topics.get(t.topicId)
        if (topic) await db.topics.update(t.topicId, { studiedSeconds: topic.studiedSeconds + seconds })
      }
    }
    if (t.blockId) {
      const b = await db.blocks.get(t.blockId)
      if (b) await db.blocks.update(t.blockId, { studiedSeconds: b.studiedSeconds + seconds, done: b.done || markDone })
    }
  })
  const finished = markDone && t.blockId ? await db.blocks.get(t.blockId) : undefined
  if (finished) celebrateBlock(finished, seconds)
  else if (seconds >= 60)
    showMascot({ pose: 'focado', title: 'Sessão salva', text: `Foram ${Math.round(seconds / 60)} minutos de foco. +${Math.floor(seconds / 60)} XP!`, autoHideMs: 5000 })
}

// ---------- Backup ----------

const TABLES = ['subjects', 'topics', 'notes', 'weeks', 'blocks', 'sessions', 'settings', 'reviews'] as const

export async function exportBackup(): Promise<string> {
  const data: Record<string, unknown[]> = {}
  for (const t of TABLES) data[t] = await db.table(t).toArray()
  return JSON.stringify({ app: 'mendonca', version: 1, exportedAt: new Date().toISOString(), data }, null, 2)
}

export async function importBackup(json: string) {
  const parsed = JSON.parse(json)
  if (parsed?.app !== 'mendonca' || !parsed.data) throw new Error('Arquivo não é um backup do Mendonça.')
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      if (Array.isArray(parsed.data[t])) await db.table(t).bulkAdd(parsed.data[t])
    }
  })
}
