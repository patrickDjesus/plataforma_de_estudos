import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Check, Flag, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { useSubjectMap, useTopics, useWeek, useWeekBlocks } from '../db/hooks'
import { currentWeekId, regeneratePlan, updateBlock } from '../db/repo'
import type { Block } from '../db/types'
import { DAY_SHORT, fmtDayMonth, fmtDuration, fmtTime, fmtWeekRange, minutesNow, toISODate, weekDates } from '../lib/dates'
import { BlockDialog, type Draft } from '../components/BlockDialog'
import { Btn, Card, Chip, PageHeader } from '../components/ui'

const PPM = 0.85 // pixels por minuto
const SNAP = 15

type DragState = { id: string; mode: 'move' | 'resize'; x0: number; y0: number; orig: Block; moved: boolean }

export function CalendarPage() {
  const navigate = useNavigate()
  const weekId = currentWeekId()
  const week = useWeek(weekId)
  const blocks = useWeekBlocks(weekId)
  const subjects = useSubjectMap()
  const topics = useTopics()
  const topicMap = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics])
  const dates = weekDates(weekId)
  const todayIso = toISODate(new Date())

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
      if (b.kind !== 'study' || !b.subjectId) continue
      const e = acc.get(b.subjectId) ?? { planned: 0, done: 0 }
      e.planned += b.end - b.start
      if (b.done) e.done += b.end - b.start
      acc.set(b.subjectId, e)
    }
    return [...acc.entries()]
  }, [blocks])

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
        icon={<CalendarDays size={22} />}
        title="Minha semana"
        subtitle={fmtWeekRange(weekId)}
        actions={
          <>
            <Btn onClick={() => navigate('/checkin')}>
              <SlidersHorizontal size={16} /> Reajustar foco
            </Btn>
            <Btn onClick={() => regeneratePlan(weekId)} title="Refaz só os blocos automáticos ainda não iniciados">
              <RefreshCw size={16} /> Regerar plano
            </Btn>
            <Btn variant="primary" onClick={() => setDraft({ date: todayIso >= dates[0] && todayIso <= dates[6] ? todayIso : dates[0], start: 19 * 60 })}>
              <Plus size={16} /> Novo bloco
            </Btn>
          </>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="thin-scroll overflow-x-auto">
          <div className="min-w-[760px]">
            {/* Cabeçalho dos dias */}
            <div className="grid grid-cols-[56px_1fr] border-b border-line">
              <div />
              <div className="grid grid-cols-7">
                {dates.map((d, i) => {
                  const isToday = d === todayIso
                  return (
                    <div key={d} className="py-3 text-center">
                      <div className={`text-xs font-bold tracking-wider ${isToday ? 'text-indigo-600' : 'text-muted'}`}>{DAY_SHORT[i]}</div>
                      <div className={`mx-auto mt-1 w-fit rounded-full px-2.5 py-0.5 text-sm font-bold ${isToday ? 'bg-indigo-600 text-white' : ''}`}>{fmtDayMonth(d)}</div>
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
                        className="pointer-events-none absolute inset-x-1 rounded-xl bg-indigo-50/60"
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
                  const color = b.kind === 'compromisso' ? '#64748b' : (subject?.color ?? '#6366f1')
                  const h = (pos.end - pos.start) * PPM
                  const title = b.kind === 'study' ? (topic?.name ?? subject?.name ?? 'Estudo') : (b.title ?? subject?.name ?? 'Evento')
                  return (
                    <div
                      key={b.id}
                      onPointerDown={(e) => onPointerDown(e, b, 'move')}
                      onClick={(e) => e.stopPropagation()}
                      className={`group absolute z-10 cursor-grab touch-none overflow-hidden rounded-xl px-2 py-1.5 text-white shadow-md transition-shadow select-none hover:shadow-lg active:cursor-grabbing ${
                        preview?.id === b.id ? 'z-30 opacity-90 ring-4 ring-white' : ''
                      } ${b.done ? 'opacity-60' : ''}`}
                      style={{
                        top: (pos.start - rangeStart) * PPM + 1,
                        height: h - 2,
                        left: `calc(${(di / 7) * 100}% + 4px)`,
                        width: `calc(${100 / 7}% - 8px)`,
                        background:
                          b.kind === 'compromisso'
                            ? 'repeating-linear-gradient(135deg,#64748b,#64748b 8px,#718096 8px,#718096 16px)'
                            : `linear-gradient(160deg, ${color}, ${color}dd)`,
                        boxShadow: `0 6px 16px -8px ${color}`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="line-clamp-2 text-xs leading-tight font-bold">
                          {b.kind === 'prova' && <Flag size={11} className="mr-1 inline" />}
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

        {/* Legenda */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line p-4">
          {legend.length === 0 && <span className="text-sm text-muted">Nenhum bloco de estudo ainda. Cadastre matérias e regere o plano.</span>}
          {legend.map(([id, v]) => {
            const s = subjects.get(id)
            if (!s) return null
            return (
              <Chip key={id} color={s.color}>
                {s.name} <span className="opacity-70">{fmtDuration(v.done * 60)} / {fmtDuration(v.planned * 60)}</span>
              </Chip>
            )
          })}
          <span className="ml-auto text-xs text-muted">Arraste para mover · puxe a borda inferior para redimensionar · clique num espaço vazio para criar</span>
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
