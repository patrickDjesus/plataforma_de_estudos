import { db, uid } from './db'
import type { AreaId, AreaPercents, Availability, Block, Challenge, ErrorReason, Flashcard, Writing, Note, ReviewRating, Session, Settings, Subject, TimerState, Topic, Week } from './types'
import { autoColor, mutedVersion } from '../lib/colors'
import { addDays, fromISODate, minutesNow, toISODate, weekIdOf } from '../lib/dates'
import { applyRating, newReview, nextInterval, RATING_LABEL } from '../lib/review'
import { errorsFromChallenge, reviewError } from '../lib/errors'
import { planWeek } from '../lib/planner'
import { themedSubjects, type Themes } from '../lib/themes'
import { loadMastery } from './mastery'
import { askBlockQuestions, capiMood, showMascot } from '../lib/mascotBus'
import { XP_PER_BLOCK } from '../lib/xp'
import { SEED_SUBJECTS, SEED_VERSION } from '../data/seedContent'

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
  focusMinutes: 25,
  focusPauseMinutes: 5,
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
  await db.transaction('rw', [db.subjects, db.topics, db.notes, db.blocks, db.reviews, db.cards, db.errors], async () => {
    await db.subjects.delete(id)
    await db.errors.where('subjectId').equals(id).delete()
    await db.cards.where('subjectId').equals(id).delete()
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
 * Marca como perdidos os blocos que passaram 24h do fim sem estudo nem "feito"
 * e replaneja o resto da semana para encaixar o conteúdo de novo.
 */
/** Prazo para marcar um bloco como feito depois que o horário dele acaba. */
export const GRACE_MS = 24 * 60 * 60 * 1000
/** Quando o bloco termina (data + hora de fim), em milissegundos. */
export const blockEndMs = (b: Pick<Block, 'date' | 'end' | 'flex'>) => fromISODate(b.date).getTime() + (b.flex ? 24 * 60 : b.end) * 60000
/** Bloco de estudo/revisão que já acabou, ainda não foi marcado e está dentro das 24h de prazo. */
export const isPending = (b: Block, now = Date.now()) =>
  (b.kind === 'study' || b.kind === 'revisao') && !b.done && !b.missed && blockEndMs(b) <= now && now - blockEndMs(b) < GRACE_MS

/** "Não fiz": marca o bloco como perdido agora (sem esperar o prazo) e remarca o conteúdo. */
export async function markBlockMissed(id: string) {
  const b = await db.blocks.get(id)
  if (!b || b.done) return
  await db.blocks.update(id, { missed: true })
  await regeneratePlan(b.weekId)
}

export async function replanMissed(now = new Date()): Promise<number> {
  const weekId = weekIdOf(now)
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
        // 24h de prazo depois do fim do bloco para marcar como feito
        now.getTime() - blockEndMs(b) >= GRACE_MS,
    )
    .toArray()
  if (!missed.length) return 0
  capiMood('chorando', 6000)
  await Promise.all(missed.map((b) => db.blocks.update(b.id, { missed: true })))
  await regeneratePlan(weekId, now)
  return missed.length
}

export async function deleteTopic(id: string) {
  await db.transaction('rw', [db.topics, db.notes, db.blocks, db.reviews, db.cards, db.errors], async () => {
    await db.topics.delete(id)
    await db.errors.where('topicId').equals(id).delete()
    await db.cards.where('topicId').equals(id).delete()
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

export async function saveCheckin(weekId: string, percents: AreaPercents, availability: Availability, pausedSubjectIds: string[], themes?: Themes | null, dailyMinutes?: number[] | null) {
  const existing = await db.weeks.get(weekId)
  const week: Week = {
    id: weekId,
    percents,
    availability,
    pausedSubjectIds,
    createdAt: existing?.createdAt ?? Date.now(),
    ...(existing?.retro ? { retro: existing.retro } : {}),
    ...(themes ? { themes } : {}),
    ...(dailyMinutes ? { dailyMinutes } : {}),
  }
  await db.weeks.put(week)
  await updateSettings({
    defaultAvailability: availability,
    lastPercents: percents,
    ...(themes !== undefined ? { themeWeeks: !!themes } : {}),
    ...(dailyMinutes !== undefined ? { scheduleMode: dailyMinutes ? 'horas' : 'horarios', ...(dailyMinutes ? { defaultDailyMinutes: dailyMinutes } : {}) } : {}),
  })
  await regeneratePlan(weekId)
}

/** Um bloco "intocado" é automático, não iniciado e ainda no futuro: pode ser regerado. */
function isRegenerable(b: Block, now: Date, timerBlockId?: string) {
  if (!b.auto || b.done || b.studiedSeconds > 0 || b.id === timerBlockId) return false
  const today = toISODate(now)
  // Sem hora marcada: o dia de hoje ainda está todo em aberto
  if (b.flex) return b.date >= today && !b.missed
  return b.date > today || (b.date === today && b.start >= minutesNow(now))
}

/**
 * Um replanejamento por vez: dois rodando juntos (ex.: ao voltar para a aba e no
 * intervalo de 5 min, ou em duas abas) apagariam os mesmos blocos e criariam dois planos.
 */
let planChain: Promise<unknown> = Promise.resolve()
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (navigator as Navigator & { locks?: { request<R>(name: string, cb: () => Promise<R>): Promise<R> } }).locks
  let ran = false
  const once = () => {
    ran = true
    return fn()
  }
  // Se o navegador recusar o cadeado (ex.: página isolada), roda sem ele
  const run = (): Promise<T> => (locks ? locks.request<T>('mendonca-plan', once).catch((e) => (ran ? Promise.reject(e) : fn())) : fn())
  const next = planChain.then(run, run)
  planChain = next.catch(() => undefined)
  return next
}

export function regeneratePlan(weekId: string, now = new Date()) {
  return exclusive(() => regeneratePlanNow(weekId, now))
}

async function regeneratePlanNow(weekId: string, now: Date) {
  const week = await db.weeks.get(weekId)
  if (!week) return
  const settings = await getSettings()
  const [allSubjects, topics, blocks, timer] = await Promise.all([
    db.subjects.toArray(),
    db.topics.toArray(),
    db.blocks.where('weekId').equals(weekId).toArray(),
    db.timer.get('timer'),
  ])
  const toRemove = blocks.filter((b) => isRegenerable(b, now, timer?.blockId))
  const keep = blocks.filter((b) => !isRegenerable(b, now, timer?.blockId))
  // Revisões que vencem até o fim da semana e ainda não têm bloco fixo pendente
  const weekEnd = addDays(weekId, 6)
  const pinned = new Set(keep.filter((b) => b.kind === 'revisao' && !b.done && !b.missed && b.topicId).map((b) => b.topicId!))
  const reviews = (await db.reviews.where('due').belowOrEqual(weekEnd).toArray()).filter((r) => !pinned.has(r.topicId) && topics.some((t) => t.id === r.topicId))
  // Minutos perdidos por matéria ganham prioridade
  const carryOver: Record<string, number> = {}
  for (const b of keep) if (b.missed && !b.done && b.kind === 'study' && b.subjectId) carryOver[b.subjectId] = (carryOver[b.subjectId] ?? 0) + (b.end - b.start)
  // Domínio: prioriza tópicos e matérias mais fracos
  const mm = await loadMastery(now.getTime())
  const planned = planWeek({
    mastery: Object.fromEntries([...mm.topics.entries()].map(([k, v]) => [k, v.value])),
    subjectMastery: Object.fromEntries(mm.subjects),
    reviews,
    carryOver,
    weekId,
    availability: week.availability,
    percents: week.percents,
    // Semana temática: estudo novo só da matéria da semana de cada área (revisões continuam)
    subjects: themedSubjects(allSubjects.filter((s) => !week.pausedSubjectIds.includes(s.id)), week.themes),
    topics,
    busy: keep,
    // Modo flexível: horas por dia, sem pausa entre blocos
    ...(week.dailyMinutes ? { dailyMinutes: week.dailyMinutes, settings: { ...settings, breakMinutes: 0 } } : { settings }),
    now,
  })
  await db.transaction('rw', db.blocks, async () => {
    await db.blocks.bulkDelete(toRemove.map((b) => b.id))
    await db.blocks.bulkAdd(planned.map((p) => ({ ...p, id: uid(), ...(week.dailyMinutes ? { flex: true } : {}) })))
  })
}

export const currentWeekId = () => weekIdOf(new Date())

// ---------- Blocos ----------

export async function addBlock(b: Omit<Block, 'id' | 'done' | 'studiedSeconds' | 'auto'>) {
  const id = uid()
  await db.blocks.add({ ...b, id, done: false, studiedSeconds: 0, auto: false })
  if (b.kind === 'prova' && b.subjectId) await applyDeadline(b.subjectId, b.date)
  // Os blocos automáticos se reorganizam em volta do novo bloco (sem sobreposição)
  await regeneratePlan(b.weekId)
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
  if (b) await regeneratePlan(b.weekId)
}

/** Registra as questões feitas num bloco (acertos opcionais, nunca acima do total). */
export async function setBlockQuestions(id: string, questions: number, correct?: number) {
  const q = Math.max(0, Math.round(questions || 0))
  const c = correct === undefined || Number.isNaN(correct) ? undefined : Math.min(q, Math.max(0, Math.round(correct)))
  await db.blocks.update(id, { questions: q, correct: c })
}

/** Apagar um bloco libera o horário para o plano automático. */
export async function deleteBlock(id: string) {
  const b = await db.blocks.get(id)
  await db.blocks.delete(id)
  if (b && !b.auto) await regeneratePlan(b.weekId)
}

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
  // Pergunta se fez questões (uma vez por bloco)
  if (b.kind === 'study' || b.kind === 'revisao') {
    const full = await db.blocks.get(b.id)
    if (full && full.questions === undefined) askBlockQuestions(b.id)
  }

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
/** Para o cronômetro e grava a sessão. Devolve o id da sessão gravada (se houver). `quiet` não chama o Capi. */
export async function stopTimer(markDone = false, quiet = false, maxSeconds?: number): Promise<string | undefined> {
  const t = await getTimer()
  if (!t) return
  const seconds = Math.round(Math.min(elapsedOf(t), maxSeconds ?? Infinity))
  let sessionId: string | undefined
  await db.transaction('rw', [db.timer, db.sessions, db.blocks, db.topics], async () => {
    await db.timer.delete('timer')
    if (seconds >= 10) {
      sessionId = uid()
      await db.sessions.add({
        id: sessionId,
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
  if (quiet) return sessionId
  const finished = markDone && t.blockId ? await db.blocks.get(t.blockId) : undefined
  if (finished) celebrateBlock(finished, seconds)
  else if (seconds >= 60)
    showMascot({ pose: 'focado', title: 'Sessão salva', text: `Foram ${Math.round(seconds / 60)} minutos de foco. +${Math.floor(seconds / 60)} XP!`, autoHideMs: 5000 })
  return sessionId
}

export const updateSession = (id: string, patch: Partial<Session>) => db.sessions.update(id, patch)

/** Registra uma sessão curta (ex.: modo foco encerrado rápido), para não perder a autoavaliação. */
export async function addSession(s: Omit<Session, 'id'>) {
  const id = uid()
  await db.sessions.add({ ...s, id })
  return id
}

// ---------- Desafios ----------

export const saveChallenge = (c: Challenge) => db.challenges.put(c)

// ---------- Caderno de erros ----------

/** Registra os erros de um desafio concluído (sem duplicar; contestados saem). */
export async function logChallengeErrors(c: Challenge) {
  const today = toISODate(new Date())
  const errs = errorsFromChallenge(c, today)
  const existing = await db.errors.bulkGet(errs.map((e) => e.id))
  const fresh = errs.filter((_, i) => !existing[i])
  if (fresh.length) await db.errors.bulkAdd(fresh)
  const contested = c.results.map((r, k) => (r?.contested ? `${c.id}-${k}` : null)).filter((x): x is string => !!x)
  if (contested.length) await db.errors.bulkDelete(contested)
}

export async function reviewErrorEntry(id: string, ok: boolean) {
  const e = await db.errors.get(id)
  if (e) await db.errors.put(reviewError(e, ok, toISODate(new Date())))
}

export const setErrorReason = (id: string, reason: ErrorReason) => db.errors.update(id, { reason })
export const deleteErrorEntry = (id: string) => db.errors.delete(id)

/** Treino de escrita: salva o texto e manda cada desvio para o caderno de erros. */
export async function saveWriting(w: Writing) {
  const today = toISODate(new Date())
  await db.writings.put(w)
  await db.errors.bulkPut(
    w.deviations.map((d, k) => ({
      id: `${w.id}-${k}`,
      source: 'escrita' as const,
      question: `Corrija: "${d.excerpt}"`,
      yourAnswer: d.excerpt,
      correctAnswer: d.correction,
      explanation: d.explanation,
      category: d.category,
      createdAt: w.createdAt,
      due: addDays(today, 1),
      streak: 0,
      resolved: false,
      history: [],
    })),
  )
}

// ---------- Flashcards ----------

export async function addCards(cards: Pick<Flashcard, 'subjectId' | 'topicId' | 'noteId' | 'front' | 'back' | 'source'>[]) {
  const today = toISODate(new Date())
  await db.cards.bulkAdd(cards.map((c) => ({ ...c, front: c.front.trim(), back: c.back.trim(), id: uid(), createdAt: Date.now(), due: today, intervalDays: 0, count: 0, history: [] })))
}

export const updateCard = (id: string, patch: Partial<Flashcard>) => db.cards.update(id, patch)
export const deleteCard = (id: string) => db.cards.delete(id)

/** Avalia um flashcard e agenda a próxima vez, com a mesma escada das revisões. */
export async function rateCard(id: string, rating: ReviewRating) {
  const c = await db.cards.get(id)
  if (!c) return
  const today = toISODate(new Date())
  const intervalDays = c.count === 0 ? (rating === 'dificil' ? 1 : rating === 'ok' ? 1 : 7) : nextInterval(c.intervalDays, rating)
  await db.cards.update(id, { intervalDays, due: addDays(today, intervalDays), count: c.count + 1, history: [...c.history, { date: today, rating }] })
  // Cartão difícil também entra no caderno de erros
  if (rating === 'dificil' && !(await db.errors.get(`card-${id}`)))
    await db.errors.add({ id: `card-${id}`, source: 'flashcard', subjectId: c.subjectId, topicId: c.topicId, question: c.front, yourAnswer: '(achei difícil)', correctAnswer: c.back, createdAt: Date.now(), due: addDays(today, 1), streak: 0, resolved: false, history: [] })
}

// ---------- Backup ----------

const TABLES = ['subjects', 'topics', 'notes', 'weeks', 'blocks', 'sessions', 'settings', 'reviews', 'mapPositions', 'mapLinks', 'achievements', 'cards', 'challenges', 'errors', 'writings', 'practice'] as const

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
      await wipeTable(t)
      if (Array.isArray(parsed.data[t])) await db.table(t).bulkAdd(parsed.data[t])
    }
  })
}

/** Apaga registro por registro (e não com clear()) para a nuvem receber cada exclusão. */
async function wipeTable(t: string) {
  const keys = await db.table(t).toCollection().primaryKeys()
  if (keys.length) await db.table(t).bulkDelete(keys)
}

/** Reinicia o Mendonça: apaga tudo neste navegador e, pela sincronização, na nuvem. */
export async function resetAllData() {
  await db.transaction('rw', [...TABLES.map((t) => db.table(t)), db.timer], async () => {
    for (const t of TABLES) await wipeTable(t)
    await db.timer.clear()
  })
}

// ---------- Conteúdos padrão ----------

/**
 * Cria as matérias padrão (Ensino Médio e Inglês) com seus tópicos e um documento
 * vazio por tópico. Usa ids fixos: rodar de novo, ou em dois dispositivos, nunca duplica.
 * Só adiciona o que estiver faltando; não mexe no que você já editou.
 */
export async function applySeed(): Promise<number> {
  const base = Date.now()
  const pad = (n: number) => String(n + 1).padStart(3, '0')
  const subjects: Subject[] = []
  const topics: Topic[] = []
  const notes: Note[] = []
  const usedTitles = new Set((await db.notes.toArray()).map((n) => n.title.trim().toLowerCase()))
  SEED_SUBJECTS.forEach((s, i) => {
    const sid = `seed-${s.slug}`
    subjects.push({ id: sid, areaId: s.areaId, name: s.name, color: s.color, icon: s.icon, weight: 3, mandatory: false, createdAt: base + i })
    s.topics.forEach((name, k) => {
      const tid = `${sid}-t${pad(k)}`
      topics.push({ id: tid, subjectId: sid, name, order: k, done: false, studiedSeconds: 0 })
      // Títulos únicos para as ligações [[…]] do caderno
      let title = name
      if (usedTitles.has(title.toLowerCase())) title = `${name} (${s.name})`
      usedTitles.add(title.toLowerCase())
      notes.push({ id: `${sid}-n${pad(k)}`, subjectId: sid, topicId: tid, title, content: '', updatedAt: base })
    })
  })
  let added = 0
  await db.transaction('rw', [db.subjects, db.topics, db.notes], async () => {
    for (const [table, list] of [
      [db.subjects, subjects],
      [db.topics, topics],
      [db.notes, notes],
    ] as const) {
      const existing = await (table as typeof db.subjects).bulkGet(list.map((x) => x.id))
      const missing = list.filter((_, i) => !existing[i])
      if (missing.length) await (table as typeof db.subjects).bulkAdd(missing as never[])
      added += missing.length
    }
  })
  await updateSettings({ seedVersion: SEED_VERSION })
  return added
}

/** Aplica os conteúdos padrão uma vez (primeiro uso ou depois de reiniciar os dados). */
export async function ensureSeed() {
  const s = await getSettings()
  if ((s.seedVersion ?? 0) >= SEED_VERSION) return 0
  return applySeed()
}

/** Desfaz as cores sóbrias gravadas pela versão 33 (tema descartado): volta cada matéria à cor viva original. */
export async function restoreVividColors() {
  const originals = [...SEED_SUBJECTS.map((s) => s.color)]
  for (const area of ['faculdade', 'ensino', 'idiomas'] as AreaId[]) for (let i = 0; i < 12; i++) originals.push(autoColor(area, i))
  const back = new Map<string, string>()
  for (const c of originals) {
    const m = mutedVersion(c).toLowerCase()
    if (m !== c.toLowerCase() && !back.has(m)) back.set(m, c)
  }
  for (const s of await db.subjects.toArray()) {
    const orig = back.get(s.color.toLowerCase())
    if (orig) await db.subjects.update(s.id, { color: orig })
  }
}
