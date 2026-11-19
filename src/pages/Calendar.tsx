import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarRange, Check, CheckCheck, Clock3, Flag, LayoutGrid, Plus, RefreshCw, RotateCcw, SlidersHorizontal, Sun, Trash2 } from 'lucide-react'
import { tint } from '../lib/colors'
import { useSubjectMap, useTopics, useWeek, useWeekBlocks } from '../db/hooks'
import { currentWeekId, deleteBlock, regeneratePlan, setBlockDone, updateBlock } from '../db/repo'
import type { Block } from '../db/types'
import { DAY_SHORT, addDays, fmtDayMonth, fmtDuration, fmtTime, fmtWeekRange, minutesNow, toISODate, weekDates } from '../lib/dates'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { BlockDialog, type Draft } from '../components/BlockDialog'
import { Btn, Card, Chip, Tabs } from '../components/ui'
import { HeroStat, PageHeader, TileIcon } from '../components/dash'
import type { Subject, Topic } from '../db/types'

const PPM = 0.85 // pixels por minuto
const SNAP = 15

type DragState = { id: string; mode: 'move' | 'resize'; x0: number; y0: number; orig: Block; moved: boolean }

export function CalendarPage() {
  const navigate = useNavigate()
  // Fim de semana: se a próxima semana já foi planejada, dá para alternar entre as duas
  const thisWeek = currentWeekId()
  const nextWeekId = addDays(thisWeek, 7)
  const nextPlanned = useLiveQuery(async () => !!(await db.weeks.get(nextWeekId)), [nextWeekId], false)
  const thisPlanned = useLiveQuery(async () => !!(await db.weeks.get(thisWeek)), [thisWeek], true)
  const [pickNext, setPickNext] = useState<boolean | null>(null)
  const showNext = nextPlanned && (pickNext ?? !thisPlanned)
  const weekId = showNext ? nextWeekId : thisWeek
  const week = useWeek(weekId)
  const blocks = useWeekBlocks(weekId)
  const subjects = useSubjectMap()
  const topics = useTopics()
  const topicMap = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics])
  const dates = weekDates(weekId)
  const todayIso = toISODate(new Date())

  const [view, setView] = useState<'cartoes' | 'horario'>('cartoes')
  const [selected, setSelected] = useState<Block | undefined>()
  const [draft, setDraft] = useState<Draft | undefined>()
  const [preview, setPreview] = useState<Pick<Block, 'id' | 'date' | 'start' | 'end'> | null>(null)
  const drag = useRef<DragState | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrolled = useRef(false)

  // Faixa de horas mostrada: cobre disponibilidade e blocos, com 1h de folga
  const [rangeStart, rangeEnd] = useMemo(() => {
    const mins = [...blocks.map((b) => b.start), ...(week?.availability.flat().map((w) => w.start) ?? [])]
    const maxs = [...blocks.map((b) => b.end), ...(week?.availability.flat().map((w) => w.end) ?? [])]
    if (!mins.length) return [8 * 60, 22 * 60]
    return [Math.max(0, Math.floor(Math.min(...mins) / 60) * 60 - 60), Math.min(24 * 60, Math.ceil(Math.max(...maxs) / 60) * 60 + 60)]
  }, [blocks, week])
  const height = (rangeEnd - rangeStart) * PPM

  // Ao abrir, rola até o primeiro horário com blocos
  useEffect(() => {
    if (scrolled.current || !scrollRef.current || blocks.length === 0) return
    scrolled.current = true
    const first = Math.min(...blocks.map((b) => b.start))
    scrollRef.current.scrollTop = Math.max(0, (first - rangeStart - 30) * PPM)
  }, [blocks, rangeStart])

  const legend = useMemo(() => {
    const acc = new Map<string, { planned: number; done: number }>()
    for (const b of blocks) {
      if ((b.kind !== 'study' && b.kind !== 'revisao') || !b.subjectId || (b.missed && !b.done)) continue
      const e = acc.get(b.subjectId) ?? { planned: 0, done: 0 }
      e.planned += b.end - b.start
      if (b.done) e.done += b.end - b.start
      acc.set(b.subjectId, e)
    }
    return [...acc.entries()]
  }, [blocks])

  const weekStats = useMemo(() => {
    const study = blocks.filter((b) => b.kind === 'study' || b.kind === 'revisao')
    const done = study.filter((b) => b.done)
    return {
      total: study.length,
      done: done.length,
      plannedMin: study.reduce((a, b) => a + b.end - b.start, 0),
      doneMin: done.reduce((a, b) => a + b.end - b.start, 0),
      today: study.filter((b) => b.date === todayIso && !b.done).length,
    }
  }, [blocks, todayIso])

  const snap = (m: number) => Math.round(m / SNAP) * SNAP

  const onPointerDown = (e: RPointerEvent, b: Block, mode: DragState['mode']) => {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { id: b.id, mode, x0: e.clientX, y0: e.clientY, orig: b, moved: false }
  }

  const onPointerMove = (e: RPointerEvent) => {
    const d = drag.current
    if (!d || !gridRef.current) return
    const dx = e.clientX - d.x0
    const dy = e.clientY - d.y0
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    d.moved = true
    const dm = snap(dy / PPM)
    const len = d.orig.end - d.orig.start
    if (d.mode === 'move') {
      const colW = gridRef.current.getBoundingClientRect().width / 7
      const dayIdx = Math.max(0, Math.min(6, dates.indexOf(d.orig.date) + Math.round(dx / colW)))
      const start = Math.max(rangeStart, Math.min(rangeEnd - len, d.orig.start + dm))
      setPreview({ id: d.id, date: dates[dayIdx], start, end: start + len })
    } else {
      const end = Math.max(d.orig.start + SNAP, Math.min(rangeEnd, d.orig.end + dm))
      setPreview({ id: d.id, date: d.orig.date, start: d.orig.start, end })
    }
  }

  const onPointerUp = async () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moved) {
      setSelected(d.orig)
      return
    }
    if (preview) await updateBlock(d.id, { date: preview.date, start: preview.start, end: preview.end })
    setPreview(null)
  }

  const onColumnClick = (e: React.MouseEvent<HTMLDivElement>, date: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const start = Math.floor((rangeStart + (e.clientY - rect.top) / PPM) / 30) * 30
    setDraft({ date, start })
  }

  const nowLine = dates.includes(todayIso) ? (minutesNow() - rangeStart) * PPM : -1

  return (
    <>
      <PageHeader
        icon={<CalendarRange size={28} />}
        color="#c4471d"
        title="Mapa da semana"
        subtitle="Seu progresso e sua rotina de estudos."
        stats={
          <>
            <HeroStat tile={<TileIcon color="#c4471d"><CheckCheck size={22} /></TileIcon>} value={<>{weekStats.done}<span className="text-sm text-muted">/{weekStats.total}</span></>} label="blocos feitos" />
            <HeroStat tile={<TileIcon color="#9a4a6a"><Clock3 size={22} /></TileIcon>} value={`${Math.round(weekStats.doneMin / 60)}h`} label={`estudadas de ${Math.round(weekStats.plannedMin / 60)}h`} accent="#9a4a6a" />
            <HeroStat tile={<TileIcon color="#b5612a"><Sun size={22} /></TileIcon>} value={weekStats.today} label={weekStats.today === 1 ? 'bloco hoje' : 'blocos hoje'} accent="#b5612a" />
          </>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
          <div>
            <h2 className="text-xl font-bold">{fmtWeekRange(weekId)}</h2>
            {nextPlanned && (
              <div className="mt-1.5 inline-flex gap-1 rounded-md bg-[#efefed] p-1 text-xs font-bold">
                <button onClick={() => setPickNext(false)} className={`rounded-md px-3 py-1 ${!showNext ? 'bg-white text-brand shadow-sm' : 'text-muted'}`}>
                  Esta semana
                </button>
                <button onClick={() => setPickNext(true)} className={`rounded-md px-3 py-1 ${showNext ? 'bg-white text-brand shadow-sm' : 'text-muted'}`}>
                  Próxima semana
                </button>
              </div>
            )}
            {week?.themes && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {Object.values(week.themes)
                  .map((id) => (id ? subjects.get(id) : undefined))
                  .filter((s): s is Subject => !!s)
                  .map((s) => (
                    <span key={s.id} className="rounded-md px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: s.color }}>
                      Semana de {s.name}
                    </span>
                  ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={view}
              onChange={setView}
              items={[
                { id: 'cartoes', label: 'Cartões', icon: <LayoutGrid size={15} /> },
                { id: 'horario', label: 'Horário', icon: <Clock3 size={15} /> },
              ]}
            />
            <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
            <Btn onClick={() => navigate('/checkin')} title="Mudar o foco e os horários da semana">
              <SlidersHorizontal size={16} /> Reajustar foco
            </Btn>
            <Btn onClick={() => regeneratePlan(weekId)} title="Refaz só os blocos automáticos ainda não iniciados">
              <RefreshCw size={16} /> Regerar
            </Btn>
            <Btn variant="primary" onClick={() => setDraft({ date: todayIso >= dates[0] && todayIso <= dates[6] ? todayIso : dates[0], start: 19 * 60 })}>
              <Plus size={16} /> Novo bloco
            </Btn>
          </div>
        </div>

        {view === 'cartoes' && (
          <div className="sm:hidden">
            <PhoneView dates={dates} todayIso={todayIso} blocks={blocks} subjects={subjects} topicMap={topicMap} onOpen={setSelected} />
          </div>
        )}
        {view === 'cartoes' ? (
          <div className="hidden sm:block">
          <CardsView
            dates={dates}
            todayIso={todayIso}
            blocks={blocks}
            subjects={subjects}
            topicMap={topicMap}
            onOpen={setSelected}
            onCreate={(date, start) => setDraft({ date, start })}
          />
          </div>
        ) : (
        <div className="thin-scroll overflow-x-auto border-t border-line">
          <div className="min-w-[760px]">
            {/* Cabeçalho dos dias */}
            <div className="grid grid-cols-[56px_1fr] border-b border-line">
              <div />
              <div className="grid grid-cols-7">
                {dates.map((d, i) => {
                  const isToday = d === todayIso
                  return (
                    <div key={d} className="py-3 text-center">
                      <div className={`text-xs font-bold tracking-wider ${isToday ? 'text-brand' : 'text-muted'}`}>{DAY_SHORT[i]}</div>
                      <div className={`mx-auto mt-1 w-fit rounded-md px-2.5 py-0.5 text-sm font-bold ${isToday ? 'bg-brand text-white' : ''}`}>{fmtDayMonth(d)}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Grade */}
            <div ref={scrollRef} className="thin-scroll grid max-h-[74vh] grid-cols-[56px_1fr] overflow-y-auto">
              <div className="relative" style={{ height }}>
                {Array.from({ length: (rangeEnd - rangeStart) / 60 }, (_, i) => (
                  <div key={i} className="absolute right-2 -translate-y-2 text-[11px] font-semibold text-muted" style={{ top: i * 60 * PPM }}>
                    {i === 0 ? '' : fmtTime(rangeStart + i * 60)}
                  </div>
                ))}
              </div>
              <div ref={gridRef} className="relative grid grid-cols-7" style={{ height }} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
                {/* linhas de hora */}
                {Array.from({ length: (rangeEnd - rangeStart) / 60 }, (_, i) => (
                  <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-line/70" style={{ top: i * 60 * PPM }} />
                ))}
                {dates.map((date, di) => (
                  <div key={date} className={`relative border-l border-line/70 ${date < todayIso ? 'bg-slate-50/60' : ''}`} onClick={(e) => onColumnClick(e, date)}>
                    {/* disponibilidade */}
                    {week?.availability[di]?.map((w, i) => (
                      <div
                        key={i}
                        className="pointer-events-none absolute inset-x-1 rounded-xl bg-brand-soft/70"
                        style={{ top: (w.start - rangeStart) * PPM, height: (w.end - w.start) * PPM }}
                      />
                    ))}
                    {date === todayIso && nowLine >= 0 && nowLine <= height && (
                      <div className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-rose-500" style={{ top: nowLine }}>
                        <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
                      </div>
                    )}
                  </div>
                ))}

                {/* blocos */}
                {blocks.map((b) => {
                  const pos = preview?.id === b.id ? preview : b
                  const di = dates.indexOf(pos.date)
                  if (di < 0) return null
                  const subject = b.subjectId ? subjects.get(b.subjectId) : undefined
                  const topic = b.topicId ? topicMap.get(b.topicId) : undefined
                  const color = b.kind === 'compromisso' ? '#6b6b66' : (subject?.color ?? '#6366f1')
                  const h = (pos.end - pos.start) * PPM
                  const title = b.kind === 'study' || b.kind === 'revisao' ? (topic?.name ?? subject?.name ?? 'Estudo') : (b.title ?? subject?.name ?? 'Evento')
                  const isReview = b.kind === 'revisao'
                  return (
                    <div
                      key={b.id}
                      onPointerDown={(e) => onPointerDown(e, b, 'move')}
                      onClick={(e) => e.stopPropagation()}
                      className={`group absolute z-10 cursor-grab touch-none overflow-hidden rounded-xl px-2 py-1.5 text-white shadow-md transition-shadow select-none hover:shadow-lg active:cursor-grabbing ${
                        preview?.id === b.id ? 'z-30 opacity-90 ring-4 ring-white' : ''
                      } ${b.done ? 'opacity-60' : ''} ${b.missed && !b.done ? 'opacity-40 grayscale-[.4]' : ''}`}
                      style={{
                        top: (pos.start - rangeStart) * PPM + 1,
                        height: h - 2,
                        left: `calc(${(di / 7) * 100}% + 4px)`,
                        width: `calc(${100 / 7}% - 8px)`,
                        background:
                          b.kind === 'compromisso'
                            ? 'repeating-linear-gradient(135deg,#6b6b66,#6b6b66 8px,#718096 8px,#718096 16px)'
                            : isReview
                              ? `repeating-linear-gradient(135deg, ${color}, ${color} 6px, ${color}cc 6px, ${color}cc 12px)`
                              : color,
                        boxShadow: `0 6px 16px -8px ${color}`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="line-clamp-2 text-xs leading-tight font-bold">
                          {b.kind === 'prova' && <Flag size={11} className="mr-1 inline" />}
                          {isReview && <RotateCcw size={11} className="mr-1 inline" />}
                          {title}
                        </div>
                        {b.done && <Check size={14} className="shrink-0" />}
                      </div>
                      {h > 34 && (
                        <div className="mt-0.5 truncate text-[10px] font-medium opacity-85">
                          {fmtTime(pos.start)}–{fmtTime(pos.end)}
                          {b.kind === 'study' && topic && subject ? ` · ${subject.name}` : ''}
                        </div>
                      )}
                      <div
                        onPointerDown={(e) => onPointerDown(e, b, 'resize')}
                        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100"
                        style={{ background: 'rgba(255,255,255,.35)' }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Legenda */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4">
          {legend.length === 0 && <span className="text-sm text-muted">Nenhum bloco de estudo ainda. Cadastre matérias e regere o plano.</span>}
          {legend.map(([id, v]) => {
            const s = subjects.get(id)
            if (!s) return null
            return (
              <Chip key={id} color={s.color}>
                {s.name} <span className="font-medium opacity-70">{fmtDuration(v.done * 60)} / {fmtDuration(v.planned * 60)}</span>
              </Chip>
            )
          })}
          <span className="ml-auto text-xs text-muted">
            <span className="hidden sm:inline">{view === 'cartoes' ? 'Arraste um cartão para outro dia · clique num espaço vazio para criar' : 'Arraste para mover · puxe a borda inferior para redimensionar · clique num espaço vazio para criar'}</span>
            <span className="sm:hidden">Toque num bloco para ver detalhes · "Feito?" marca como concluído</span>
          </span>
        </div>
      </Card>

      <BlockDialog
        weekId={weekId}
        block={selected}
        draft={draft}
        onClose={() => {
          setSelected(undefined)
          setDraft(undefined)
        }}
      />
    </>
  )
}

/** Visão em colunas de cartões, um por bloco, em ordem de horário. */
function CardsView({
  dates,
  todayIso,
  blocks,
  subjects,
  topicMap,
  onOpen,
  onCreate,
}: {
  dates: string[]
  todayIso: string
  blocks: Block[]
  subjects: Map<string, Subject>
  topicMap: Map<string, Topic>
  onOpen: (b: Block) => void
  onCreate: (date: string, start: number) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overDate, setOverDate] = useState<string | null>(null)
  const byDay = dates.map((d) => blocks.filter((b) => b.date === d).sort((a, b) => a.start - b.start))
  const rows = Math.max(4, ...byDay.map((l) => l.length)) + 1

  const drop = async (date: string) => {
    setOverDate(null)
    if (!dragId) return
    const b = blocks.find((x) => x.id === dragId)
    setDragId(null)
    if (b && b.date !== date) await updateBlock(b.id, { date })
  }

  return (
    <div className="thin-scroll overflow-x-auto px-5 pb-5">
      <div className="grid min-w-[880px] grid-cols-7 gap-3">
        {dates.map((date, i) => {
          const isToday = date === todayIso
          const list = byDay[i]
          const nextStart = list.length ? list[list.length - 1].end + 10 : 19 * 60
          return (
            <div
              key={date}
              onDragOver={(e) => {
                e.preventDefault()
                setOverDate(date)
              }}
              onDragLeave={() => setOverDate((d) => (d === date ? null : d))}
              onDrop={() => drop(date)}
              className={`flex flex-col gap-2.5 rounded-2xl p-1 transition ${overDate === date ? 'bg-brand-soft' : ''}`}
            >
              <div className="pt-1 pb-1.5 text-center">
                <div className={`text-[11px] font-bold tracking-wider ${isToday ? 'text-brand' : 'text-muted'}`}>{['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO', 'DOMINGO'][i]}</div>
                <div className={`mx-auto mt-1 w-fit rounded-md px-2.5 py-0.5 text-sm font-bold tabular-nums ${isToday ? 'bg-brand text-white' : ''}`}>{fmtDayMonth(date)}</div>
              </div>
              {list.map((b) => {
                const subject = b.subjectId ? subjects.get(b.subjectId) : undefined
                const topic = b.topicId ? topicMap.get(b.topicId) : undefined
                const color = b.kind === 'compromisso' ? '#6b6b66' : (subject?.color ?? '#c4471d')
                const title = b.kind === 'study' || b.kind === 'revisao' ? (topic?.name ?? subject?.name ?? 'Estudo') : (b.title ?? subject?.name ?? 'Evento')
                const isReview = b.kind === 'revisao'
                const ink = `color-mix(in srgb, ${color} 75%, #000)`
                return (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={() => setDragId(b.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => onOpen(b)}
                    className={`group relative flex min-h-[84px] cursor-pointer flex-col justify-between rounded-2xl p-3 transition ${isReview ? '' : 'text-white'} ${dragId === b.id ? 'opacity-40' : ''} ${b.done ? 'opacity-55' : ''} ${b.missed && !b.done ? 'opacity-45 grayscale-[.4]' : ''}`}
                    style={{
                      background: b.kind === 'compromisso' ? 'repeating-linear-gradient(135deg,#6b6b66,#6b6b66 8px,#6b6b66 8px,#6b6b66 16px)' : isReview ? tint(color, 0.12) : color,
                      border: isReview ? `2px dashed ${tint(color, 0.7)}` : undefined,
                      color: isReview ? ink : undefined,
                      boxShadow: isReview ? undefined : `0 8px 18px -10px ${color}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className={`line-clamp-2 text-[13px] leading-snug font-bold ${b.missed && !b.done ? 'line-through' : ''}`}>
                        {b.kind === 'prova' && <Flag size={12} className="mr-1 inline" />}
                        {isReview && <RotateCcw size={12} className="mr-1 inline" />}
                        {title}
                      </div>
                      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${isReview ? 'bg-white/70' : 'bg-white/25'}`}>{fmtDuration((b.end - b.start) * 60)}</span>
                    </div>
                    {b.missed && !b.done && <div className="-mt-1 truncate text-[11px] font-bold">Perdido · remarcado</div>}
                    {!b.missed && isReview && <div className="-mt-1 truncate text-[11px] font-semibold opacity-80">Revisão · {subject?.name}</div>}
                    {!b.missed && b.kind === 'study' && topic && <div className="-mt-1 truncate text-[11px] font-semibold text-white/80">{subject?.name}</div>}
                    {b.kind !== 'study' && !isReview && <div className="-mt-1 truncate text-[11px] font-semibold text-white/80">{b.kind === 'prova' ? `Prova${subject ? ` · ${subject.name}` : ''}` : 'Compromisso'}</div>}
                    <div className={`mt-2 flex items-end justify-between gap-1 text-[11px] font-medium ${isReview ? 'opacity-80' : 'text-white/85'}`}>
                      <span className="min-w-0 truncate tabular-nums">
                        {fmtTime(b.start)}–{fmtTime(b.end)}
                      </span>
                      <span className="flex shrink-0 gap-0.5">
                        {(b.kind === 'study' || (isReview && b.done)) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setBlockDone(b.id, !b.done)
                            }}
                            className={`rounded-md p-0.5 hover:bg-white/20 ${b.done ? '' : 'opacity-0 group-hover:opacity-100'}`}
                            title={b.done ? 'Desfazer' : 'Marcar como feito'}
                          >
                            <Check size={14} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteBlock(b.id)
                          }}
                          className="rounded-md p-0.5 opacity-70 hover:bg-black/10 hover:opacity-100"
                          title="Excluir"
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    </div>
                  </div>
                )
              })}
              {Array.from({ length: rows - list.length }, (_, k) => (
                <button
                  key={k}
                  onClick={() => onCreate(date, Math.min(nextStart, 23 * 60))}
                  className="group grid min-h-[84px] place-items-center rounded-md border border-dashed border-line text-transparent transition hover:bg-brand-soft hover:text-brand"
                  aria-label={`Criar bloco em ${fmtDayMonth(date)}`}
                >
                  <Plus size={18} />
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Celular: hoje em destaque, lista completa e botão "Feito"; outros dias dobrados. */
function PhoneView({ dates, todayIso, blocks, subjects, topicMap, onOpen }: { dates: string[]; todayIso: string; blocks: Block[]; subjects: Map<string, Subject>; topicMap: Map<string, Topic>; onOpen: (b: Block) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const ordered = [...dates].sort((a, b) => (a === todayIso ? -1 : b === todayIso ? 1 : a < todayIso && b >= todayIso ? 1 : a >= todayIso && b < todayIso ? -1 : a.localeCompare(b)))
  const names = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
  const row = (b: Block, big: boolean) => {
    const subject = b.subjectId ? subjects.get(b.subjectId) : undefined
    const topic = b.topicId ? topicMap.get(b.topicId) : undefined
    const color = b.kind === 'compromisso' ? '#6b6b66' : (subject?.color ?? '#c4471d')
    const title = b.kind === 'study' || b.kind === 'revisao' ? (topic?.name ?? subject?.name ?? 'Estudo') : (b.title ?? subject?.name ?? 'Evento')
    const canDone = b.kind === 'study' || b.kind === 'revisao'
    return (
      <div key={b.id} onClick={() => onOpen(b)} className={`flex items-center gap-3 rounded-2xl border border-line bg-white p-3 ${b.done ? 'opacity-60' : ''} ${b.missed && !b.done ? 'opacity-50' : ''}`} style={{ borderLeft: `5px solid ${color}` }}>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-bold ${b.missed && !b.done ? 'line-through' : ''}`}>
            {b.kind === 'revisao' && <RotateCcw size={12} className="mr-1 inline" />}
            {b.kind === 'prova' && <Flag size={12} className="mr-1 inline" />}
            {title}
          </div>
          <div className="text-xs text-muted">
            {fmtTime(b.start)}–{fmtTime(b.end)} · {b.kind === 'revisao' ? 'Revisão · ' : ''}
            {subject?.name ?? (b.kind === 'compromisso' ? 'Compromisso' : '')}
            {b.missed && !b.done ? ' · perdido' : ''}
          </div>
        </div>
        {canDone && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setBlockDone(b.id, !b.done)
            }}
            className={`flex shrink-0 items-center gap-1 rounded-xl font-bold ${big ? 'px-3.5 py-2.5 text-sm' : 'px-2.5 py-2 text-xs'} ${b.done ? 'bg-emerald-100 text-emerald-700' : 'bg-ink text-white'}`}
          >
            <Check size={big ? 16 : 14} /> {b.done ? 'Feito' : 'Feito?'}
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="space-y-3 px-4 pb-5">
      {ordered.map((date) => {
        const list = blocks.filter((b) => b.date === date).sort((a, b) => a.start - b.start)
        const isToday = date === todayIso
        const idx = dates.indexOf(date)
        const expanded = isToday || open === date
        const done = list.filter((b) => b.done).length
        return (
          <div key={date} className={`rounded-2xl ${isToday ? 'bg-brand-soft/60 p-3' : 'border border-line p-2'}`}>
            <button onClick={() => !isToday && setOpen(expanded ? null : date)} className="flex w-full items-center justify-between gap-2 px-1 py-1 text-left">
              <span className={`text-sm font-bold ${isToday ? 'text-brand' : ''}`}>
                {isToday ? 'Hoje · ' : ''}
                {names[idx]} {fmtDayMonth(date)}
              </span>
              <span className="text-xs text-muted">
                {list.length ? `${done}/${list.length} feitos` : 'livre'}
                {!isToday && <span className="ml-1">{expanded ? '▾' : '▸'}</span>}
              </span>
            </button>
            {expanded && <div className="mt-2 space-y-2">{list.length ? list.map((b) => row(b, isToday)) : <p className="px-1 text-xs text-muted">Nada planejado.</p>}</div>}
          </div>
        )
      })}
    </div>
  )
}
