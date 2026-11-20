import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { X } from 'lucide-react'
import { db } from '../db/db'
import { currentWeekId, replanMissed, setBlockDone } from '../db/repo'
import { addDays, minutesNow, toISODate } from '../lib/dates'
import { capiQuestion, capiWelcome, type CapiContext } from '../lib/capiTalk'
import { onCapiMood, onMascot, showMascot, type MascotMessage } from '../lib/mascotBus'
import { useLocation } from 'react-router-dom'
import { DEFAULT_DAILY_GOAL } from '../lib/dailyGoal'
import { loadQuestionStats } from './QuestionStats'
import { levelInfo, xpFrom } from '../lib/xp'
import { achievements, computeStats } from '../lib/achievements'
import { Capybara } from './Capybara'
import { useSyncStatus } from '../lib/cloud'

/**
 * Onde o Capi mora: o botão no canto da tela, o balão de fala,
 * as boas-vindas ao abrir o site e o aviso de nível novo.
 */
export function MascotHost() {
  const navigate = useNavigate()
  const [msg, setMsg] = useState<MascotMessage | null>(null)
  // Humor passageiro (pose sem balão) e humor pela hora/rota
  const [mood, setMood] = useState<MascotMessage['pose'] | null>(null)
  const moodTimer = useRef<number | undefined>(undefined)
  useEffect(
    () =>
      onCapiMood((pose, ms) => {
        window.clearTimeout(moodTimer.current)
        setMood(pose)
        moodTimer.current = window.setTimeout(() => setMood(null), ms)
      }),
    [],
  )
  const location = useLocation()
  const hour = new Date().getHours()
  const idlePose: MascotMessage['pose'] = hour >= 23 || hour < 6 ? 'dormindo' : location.pathname.startsWith('/desafio') || location.pathname.startsWith('/questoes') ? 'focado' : location.pathname.startsWith('/caderno') ? 'estudando' : 'relaxando'
  const [key, setKey] = useState(0)
  const asked = useRef(0)
  const welcomed = useRef(false)
  const lastLevel = useRef<number | null>(null)
  const hideTimer = useRef<number | undefined>(undefined)

  const sync = useSyncStatus()
  const data = useLiveQuery(async () => {
    const weekId = currentWeekId()
    const todayIso = toISODate(new Date())
    const [unlocked, cards, allBlocks, notes, reviews, settings, subjectsCount, week, todayBlocks, notesCount, timer, sessions, doneBlocks, topics, subjects] = await Promise.all([
      db.achievements.toArray(),
      db.cards.toArray(),
      db.blocks.toArray(),
      db.notes.toArray(),
      db.reviews.toArray(),
      db.settings.get('main'),
      db.subjects.count(),
      db.weeks.get(weekId),
      db.blocks.where('date').equals(todayIso).toArray(),
      db.notes.count(),
      db.timer.get('timer'),
      db.sessions.toArray(),
      db.blocks.filter((b) => b.done).toArray(),
      db.topics.toArray(),
      db.subjects.toArray(),
    ])
    return { unlocked, cards, allBlocks, notes, reviews, settings, subjectsCount, week, todayBlocks, notesCount, timer, sessions, doneBlocks, topics, subjects, todayIso }
  }, [])

  const say = useCallback((m: MascotMessage) => {
    window.clearTimeout(hideTimer.current)
    setMsg(m)
    setKey((k) => k + 1)
    if (m.autoHideMs) hideTimer.current = window.setTimeout(() => setMsg(null), m.autoHideMs)
  }, [])

  useEffect(() => onMascot(say), [say])

  // Replanejamento automático de blocos perdidos: ao abrir, a cada 5 min e ao voltar para a aba
  useEffect(() => {
    let first = true
    const run = async () => {
      const n = await replanMissed()
      if (!n) return
      const m: MascotMessage = {
        pose: 'pensando',
        title: 'Reorganizei sua semana',
        text: `${n === 1 ? '1 bloco ficou' : `${n} blocos ficaram`} pra trás, então remarquei o conteúdo nos próximos horários livres. Se você estudou mesmo assim, é só marcar como feito.`,
        actions: [{ label: 'Ver semana', primary: true, to: '/calendario' }, { label: 'Ok!' }],
      }
      // Na abertura, espera as boas-vindas passarem
      if (first) window.setTimeout(() => showMascot(m), 9000)
      else showMascot(m)
    }
    run().finally(() => (first = false))
    const i = window.setInterval(run, 5 * 60 * 1000)
    const onFocus = () => run()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(i)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const ctx = useMemo<CapiContext | null>(() => {
    if (!data) return null
    const now = new Date()
    const nm = minutesNow(now)
    const label = (topicId?: string, subjectId?: string) => data.topics.find((t) => t.id === topicId)?.name ?? data.subjects.find((s) => s.id === subjectId)?.name ?? 'estudo'
    const study = data.todayBlocks.filter((b) => (b.kind === 'study' || b.kind === 'revisao') && !b.done).sort((a, b) => a.start - b.start)
    const flexLeft = study.filter((b) => b.flex).reduce((a, b) => a + (b.end - b.start), 0)
    const toCapi = (b: (typeof study)[number]) => ({ id: b.id, label: label(b.topicId, b.subjectId), start: b.start, end: b.end, ...(b.flex ? { flexLeft } : {}) })
    const days = new Set(
      [...data.sessions.map((s) => toISODate(new Date(s.startedAt))), ...data.doneBlocks.map((b) => b.date), ...data.reviews.flatMap((r) => r.history.map((h) => h.date))].filter((x) => x <= data.todayIso),
    )
    let d = days.has(data.todayIso) ? data.todayIso : addDays(data.todayIso, -1)
    let streak = 0
    while (days.has(d)) {
      streak++
      d = addDays(d, -1)
    }
    return {
      name: data.settings?.userName?.trim() || 'estudante',
      now,
      hasSubjects: data.subjectsCount > 0,
      hasWeek: !!data.week,
      // Sem hora marcada, o bloco vale o dia todo: nunca "passou do horário" antes de o dia acabar
      nextToday: study.filter((b) => b.flex || b.end > nm).map(toCapi)[0],
      missedToday: study.filter((b) => !b.flex && b.end <= nm && b.studiedSeconds === 0).map(toCapi),
      notesCount: data.notesCount,
      reviewsDue: data.reviews.filter((r) => r.due <= data.todayIso).map((r) => data.topics.find((t) => t.id === r.topicId)?.name).filter((x): x is string => !!x),
      streak,
      timerRunning: !!data.timer,
      startBlock: (id: string) => {
        // Abre a sessão guiada (modo foco) do bloco
        if (data.todayBlocks.some((x) => x.id === id)) navigate(`/foco/${id}`)
      },
      markDone: (id: string) => setBlockDone(id, true),
    }
  }, [data])

  // Boas-vindas ao abrir o site
  useEffect(() => {
    if (!ctx || !data || welcomed.current || sync === 'carregando') return
    welcomed.current = true
    if (data.settings?.mascotWelcome === false) return
    // Sem limpar o timeout: os dados mudam logo após abrir e cancelariam as boas-vindas
    window.setTimeout(() => say(capiWelcome(ctx)), 700)
  }, [ctx, data, say, sync])

  // Meta do dia batida: a Capi dança (uma vez por dia)
  const goalDay = useRef<string | null>(null)
  useEffect(() => {
    if (!data) return
    let alive = true
    loadQuestionStats().then((st) => {
      if (!alive) return
      const today = data.todayIso
      const goal = data.settings?.dailyGoal ?? DEFAULT_DAILY_GOAL
      const done = st.byDay.get(today) ?? 0
      let seen: string | null = null
      try {
        seen = localStorage.getItem('mendonca-goal-day')
      } catch {
        /* ok */
      }
      if (goalDay.current === null) goalDay.current = seen
      if (done >= goal && goalDay.current !== today) {
        goalDay.current = today
        try {
          localStorage.setItem('mendonca-goal-day', today)
        } catch {
          /* ok */
        }
        window.setTimeout(() => showMascot({ pose: 'comemorando', title: `Meta do dia batida! 🎯 ${done}/${goal}`, text: 'Questões feitas, sequência garantida. Agora é lucro: quer continuar ou descansar?', autoHideMs: 9000 }), 1200)
      }
    })
    return () => {
      alive = false
    }
  }, [data])

  // Subiu de nível
  useEffect(() => {
    if (!data) return
    const lvl = levelInfo(xpFrom(data.sessions.reduce((a, s) => a + s.seconds, 0), data.doneBlocks.length, data.reviews.reduce((a, r) => a + r.history.length, 0), data.cards.reduce((a, c) => a + c.history.length, 0))).level
    if (lastLevel.current !== null && lvl > lastLevel.current) {
      window.setTimeout(
        () => showMascot({ pose: 'formado', title: `Nível ${lvl}! 🎓`, text: 'Você subiu de nível. Cada minuto estudado está valendo a pena!', autoHideMs: 8000 }),
        6500,
      )
    }
    lastLevel.current = lvl
  }, [data])

  // Conquistas novas: o Capi comemora (na primeira vez, registra sem alarde)
  useEffect(() => {
    if (!data) return
    const list = achievements(computeStats({ sessions: data.sessions, blocks: data.allBlocks, reviews: data.reviews, notes: data.notes, subjects: data.subjects }))
    const known = new Set(data.unlocked.map((u) => u.id))
    const fresh = list.filter((a) => a.unlocked && !known.has(a.id))
    if (!fresh.length) return
    db.achievements.bulkPut(fresh.map((a) => ({ id: a.id, unlockedAt: Date.now() })))
    if (!data.unlocked.length && fresh.length > 1) return // estado já existente antes da V3
    const a = fresh[0]
    window.setTimeout(
      () =>
        showMascot({
          pose: 'comemorando',
          title: `🏆 Conquista: ${a.title}`,
          text: `${a.description} Desbloqueada!${fresh.length > 1 ? ` E mais ${fresh.length - 1}.` : ''}`,
          actions: [{ label: 'Ver conquistas', primary: true, to: '/' }, { label: 'Uhuul!' }],
        }),
      7000,
    )
  }, [data])

  const ask = () => {
    if (!ctx) return
    if (msg) return setMsg(null)
    say(capiQuestion(ctx, asked.current++))
  }

  const runAction = async (a: NonNullable<MascotMessage['actions']>[number]) => {
    setMsg(null)
    if (a.to) navigate(a.to)
    if (a.run) await a.run()
  }

  // No celular a Capi fica menor, para não cobrir o conteúdo
  const phone = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches
  if (phone) return null
  return (
    <div
      className="pointer-events-none fixed right-0 bottom-0 z-50 flex items-end gap-2"
      style={{ paddingRight: `max(${phone ? 8 : 16}px, env(safe-area-inset-right, 0px))`, paddingBottom: `max(${phone ? 8 : 16}px, env(safe-area-inset-bottom, 0px))` }}
    >
      {msg && (
        <div key={key} className="capi-pop pointer-events-auto relative mb-16 w-[min(340px,calc(100vw-96px))] rounded-[20px] border border-line bg-white p-4 shadow-[0_18px_40px_-14px_rgba(16,24,40,0.35)]">
          <span className="absolute -right-2 bottom-6 h-4 w-4 rotate-45 border-t border-r border-line bg-white" />
          <button onClick={() => setMsg(null)} className="absolute top-2.5 right-2.5 rounded-full p-1 text-muted hover:bg-slate-100" aria-label="Fechar">
            <X size={15} />
          </button>
          {msg.title && <div className="mb-1 pr-6 font-display text-[15px] font-bold">{msg.title}</div>}
          <p className="text-sm leading-relaxed text-slate-600">{msg.text}</p>
          {msg.actions && msg.actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {msg.actions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => runAction(a)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition ${a.primary ? 'bg-brand text-white hover:brightness-110' : 'bg-[#f1f2f5] text-ink hover:bg-[#e8e9ee]'}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        onClick={ask}
        className="pointer-events-auto group relative grid place-items-center rounded-full transition hover:-translate-y-1"
        aria-label="Conversar com o Capi"
        title="Conversar com o Capi"
      >
        <span className="absolute inset-x-3 bottom-1 h-16 rounded-full bg-brand/15 blur-xl transition group-hover:bg-brand/25" />
        <Capybara key={msg ? `p-${key}` : 'idle'} pose={msg?.pose ?? mood ?? idlePose} size={phone ? (msg ? 72 : 46) : msg ? 104 : 78} className="relative transition-all" />
      </button>
    </div>
  )
}
