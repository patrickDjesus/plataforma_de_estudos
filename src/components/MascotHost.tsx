import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { X } from 'lucide-react'
import { db } from '../db/db'
import { currentWeekId, setBlockDone, startTimer } from '../db/repo'
import { addDays, minutesNow, toISODate } from '../lib/dates'
import { capiQuestion, capiWelcome, type CapiContext } from '../lib/capiTalk'
import { onMascot, showMascot, type MascotMessage } from '../lib/mascotBus'
import { levelInfo, xpFrom } from '../lib/xp'
import { Capybara } from './Capybara'

/**
 * Onde o Capi mora: o botão no canto da tela, o balão de fala,
 * as boas-vindas ao abrir o site e o aviso de nível novo.
 */
export function MascotHost() {
  const navigate = useNavigate()
  const [msg, setMsg] = useState<MascotMessage | null>(null)
  const [key, setKey] = useState(0)
  const asked = useRef(0)
  const welcomed = useRef(false)
  const lastLevel = useRef<number | null>(null)
  const hideTimer = useRef<number | undefined>(undefined)

  const data = useLiveQuery(async () => {
    const weekId = currentWeekId()
    const todayIso = toISODate(new Date())
    const [settings, subjectsCount, week, todayBlocks, notesCount, timer, sessions, doneBlocks, topics, subjects] = await Promise.all([
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
    return { settings, subjectsCount, week, todayBlocks, notesCount, timer, sessions, doneBlocks, topics, subjects, todayIso }
  }, [])

  const say = useCallback((m: MascotMessage) => {
    window.clearTimeout(hideTimer.current)
    setMsg(m)
    setKey((k) => k + 1)
    if (m.autoHideMs) hideTimer.current = window.setTimeout(() => setMsg(null), m.autoHideMs)
  }, [])

  useEffect(() => onMascot(say), [say])

  const ctx = useMemo<CapiContext | null>(() => {
    if (!data) return null
    const now = new Date()
    const nm = minutesNow(now)
    const label = (topicId?: string, subjectId?: string) => data.topics.find((t) => t.id === topicId)?.name ?? data.subjects.find((s) => s.id === subjectId)?.name ?? 'estudo'
    const study = data.todayBlocks.filter((b) => b.kind === 'study' && !b.done).sort((a, b) => a.start - b.start)
    const toCapi = (b: (typeof study)[number]) => ({ id: b.id, label: label(b.topicId, b.subjectId), start: b.start, end: b.end })
    const days = new Set([...data.sessions.map((s) => toISODate(new Date(s.startedAt))), ...data.doneBlocks.map((b) => b.date)])
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
      nextToday: study.filter((b) => b.end > nm).map(toCapi)[0],
      missedToday: study.filter((b) => b.end <= nm && b.studiedSeconds === 0).map(toCapi),
      notesCount: data.notesCount,
      streak,
      timerRunning: !!data.timer,
      startBlock: (id: string) => {
        const b = data.todayBlocks.find((x) => x.id === id)
        if (b) startTimer({ blockId: b.id, subjectId: b.subjectId, topicId: b.topicId, label: label(b.topicId, b.subjectId) })
      },
      markDone: (id: string) => setBlockDone(id, true),
    }
  }, [data])

  // Boas-vindas ao abrir o site
  useEffect(() => {
    if (!ctx || !data || welcomed.current) return
    welcomed.current = true
    if (data.settings?.mascotWelcome === false) return
    // Sem limpar o timeout: os dados mudam logo após abrir e cancelariam as boas-vindas
    window.setTimeout(() => say(capiWelcome(ctx)), 700)
  }, [ctx, data, say])

  // Subiu de nível
  useEffect(() => {
    if (!data) return
    const lvl = levelInfo(xpFrom(data.sessions.reduce((a, s) => a + s.seconds, 0), data.doneBlocks.length)).level
    if (lastLevel.current !== null && lvl > lastLevel.current) {
      window.setTimeout(
        () => showMascot({ pose: 'formado', title: `Nível ${lvl}! 🎓`, text: 'Você subiu de nível. Cada minuto estudado está valendo a pena!', autoHideMs: 8000 }),
        6500,
      )
    }
    lastLevel.current = lvl
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

  return (
    <div
      className="pointer-events-none fixed right-0 bottom-0 z-50 flex items-end gap-2"
      style={{ paddingRight: 'max(16px, env(safe-area-inset-right, 0px))', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
    >
      {msg && (
        <div key={key} className="capi-pop pointer-events-auto relative mb-16 w-[min(340px,calc(100vw-120px))] rounded-[20px] border border-line bg-white p-4 shadow-[0_18px_40px_-14px_rgba(16,24,40,0.35)]">
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
        <Capybara key={msg ? `p-${key}` : 'idle'} pose={msg?.pose ?? 'relaxando'} size={msg ? 104 : 78} className="relative transition-all" />
      </button>
    </div>
  )
}
