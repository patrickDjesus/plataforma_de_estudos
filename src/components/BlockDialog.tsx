import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Check, Clock3, Coffee, Flag, Play, RotateCcw, Trash2, X } from 'lucide-react'
import { AREAS, useSubjects, useTopics } from '../db/hooks'
import { addBlock, deleteBlock, rateReview, setBlockDone, updateBlock } from '../db/repo'
import type { Block, BlockKind, ReviewRating } from '../db/types'
import { RATING_LABEL } from '../lib/review'
import { tint } from '../lib/colors'
import { DAY_NAMES, DAY_SHORT, fmtDayMonth, fmtDuration, fmtTime, parseTime, toISODate, weekDates } from '../lib/dates'
import { SubjectIcon } from './SubjectIcon'
import { Capybara } from './Capybara'

export interface Draft {
  date: string
  start: number
}

const KINDS: { id: BlockKind; label: string; hint: string; icon: ReactNode }[] = [
  { id: 'study', label: 'Estudo', hint: 'Um bloco focado numa matéria', icon: <BookOpen size={20} /> },
  { id: 'compromisso', label: 'Compromisso', hint: 'Bloqueia o horário do plano', icon: <Coffee size={20} /> },
  { id: 'prova', label: 'Prova ou entrega', hint: 'Vira prazo da matéria', icon: <Flag size={20} /> },
]
const REVIEW_KIND = { id: 'revisao' as BlockKind, label: 'Revisão', hint: 'Agendada pela revisão espaçada', icon: <RotateCcw size={20} /> }

const DURATIONS = [25, 50, 60, 90, 120]
const TITLE_HINTS: Partial<Record<BlockKind, string[]>> = {
  compromisso: ['Aula', 'Trabalho', 'Academia', 'Consulta', 'Descanso'],
  prova: ['P1', 'P2', 'Trabalho', 'Seminário', 'Entrega'],
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-2 font-sans text-[13px] font-semibold text-ink">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[#eef0f4] text-[11px] font-bold text-muted">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}

export function BlockDialog({ weekId, block, draft, onClose }: { weekId: string; block?: Block; draft?: Draft; onClose: () => void }) {
  const navigate = useNavigate()
  const subjects = useSubjects()
  const topics = useTopics()
  const open = !!block || !!draft
  const [kind, setKind] = useState<BlockKind>('study')
  const [subjectId, setSubjectId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('19:00')
  const [end, setEnd] = useState('19:50')

  useEffect(() => {
    if (block) {
      setKind(block.kind)
      setSubjectId(block.subjectId ?? '')
      setTopicId(block.topicId ?? '')
      setTitle(block.title ?? '')
      setDate(block.date)
      setStart(fmtTime(block.start))
      setEnd(fmtTime(block.end))
    } else if (draft) {
      setKind('study')
      setSubjectId(subjects[0]?.id ?? '')
      setTopicId('')
      setTitle('')
      setDate(draft.date)
      setStart(fmtTime(draft.start))
      setEnd(fmtTime(Math.min(draft.start + 50, 24 * 60 - 1)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block, draft])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const subject = subjects.find((s) => s.id === subjectId)
  const topic = topics.find((t) => t.id === topicId)
  const subjectTopics = topics.filter((t) => t.subjectId === subjectId)
  const needsSubject = kind !== 'compromisso'
  const hasTopic = kind === 'study' || kind === 'revisao'
  const s = parseTime(start)
  const e = parseTime(end)
  const minutes = e - s
  const valid = minutes > 0 && (!needsSubject || !!subjectId) && (hasTopic || !!title.trim() || !!subjectId)
  const color = kind === 'compromisso' ? '#64748b' : (subject?.color ?? '#3e63f2')
  const dates = weekDates(weekId)
  const todayIso = toISODate(new Date())
  const kinds = kind === 'revisao' ? [...KINDS, REVIEW_KIND] : KINDS
  const previewTitle = hasTopic ? (topic?.name ?? subject?.name ?? 'Escolha a matéria') : title.trim() || (kind === 'prova' ? 'Prova' : 'Compromisso')

  const setDuration = (m: number) => setEnd(fmtTime(Math.min(s + m, 24 * 60 - 1)))

  const save = async () => {
    const data = {
      weekId,
      date,
      start: s,
      end: e,
      kind,
      subjectId: needsSubject ? subjectId || undefined : undefined,
      topicId: hasTopic ? topicId || undefined : undefined,
      title: title.trim() || undefined,
    }
    if (block) await updateBlock(block.id, data)
    else await addBlock(data)
    onClose()
  }

  const status = block ? (block.done ? { label: 'Concluído', cls: 'bg-emerald-400/25' } : block.missed ? { label: 'Perdido · remarcado', cls: 'bg-rose-500/30' } : { label: 'Pendente', cls: 'bg-white/20' }) : { label: 'Novo bloco', cls: 'bg-white/20' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1026]/45 p-3 backdrop-blur-[3px]" onMouseDown={onClose}>
      <div className="capi-pop flex max-h-[94vh] w-full max-w-[920px] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_40px_80px_-24px_rgba(11,16,38,0.55)] md:flex-row" onMouseDown={(ev) => ev.stopPropagation()}>
        {/* Painel de pré-visualização */}
        <aside
          className="relative flex shrink-0 flex-col overflow-hidden p-6 text-white md:w-[300px]"
          style={{ background: `radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, ${color} 75%, #fff) 0%, ${color} 45%, color-mix(in srgb, ${color} 70%, #0b1026) 100%)` }}
        >
          <span className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10" />
          <span className="absolute right-10 bottom-24 h-3 w-3 rotate-45 rounded-[3px] bg-white/30" />
          <div className="relative flex items-center justify-between">
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase ${status.cls}`}>{status.label}</span>
            <button onClick={onClose} className="rounded-full bg-white/15 p-1.5 hover:bg-white/25 md:hidden" aria-label="Fechar">
              <X size={16} />
            </button>
          </div>

          <div className="relative mt-6 flex items-center gap-3">
            {kind === 'compromisso' ? (
              <span className="subject-icon h-14 w-14 rounded-[18px] bg-white/20">
                <Coffee size={26} />
              </span>
            ) : (
              <span className="rounded-[20px] bg-white/25 p-1">
                <SubjectIcon subject={subject} size={52} />
              </span>
            )}
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white/75">{kinds.find((k) => k.id === kind)?.label}</div>
              <div className="truncate font-display text-lg font-bold">{kind === 'compromisso' ? 'Seu horário' : (subject?.name ?? 'Sem matéria')}</div>
            </div>
          </div>

          {/* Cartão como aparece no calendário */}
          <div className="relative mt-6 rounded-2xl bg-white/95 p-1.5 shadow-xl">
            <div
              className="flex min-h-[92px] flex-col justify-between rounded-[14px] p-3"
              style={
                kind === 'revisao'
                  ? { background: tint(color, 0.12), border: `2px dashed ${tint(color, 0.7)}`, color: `color-mix(in srgb, ${color} 75%, #000)` }
                  : { background: kind === 'compromisso' ? 'repeating-linear-gradient(135deg,#6b7280,#6b7280 8px,#737a87 8px,#737a87 16px)' : color, color: '#fff' }
              }
            >
              <div className="flex items-start justify-between gap-2">
                <span className="line-clamp-2 text-[13px] leading-snug font-bold">
                  {kind === 'prova' && <Flag size={12} className="mr-1 inline" />}
                  {previewTitle}
                </span>
                <span className="shrink-0 rounded-full bg-white/30 px-1.5 py-0.5 text-[10px] font-bold">{minutes > 0 ? fmtDuration(minutes * 60) : '—'}</span>
              </div>
              <span className="text-[11px] font-medium opacity-85 tabular-nums">
                {start}–{end}
              </span>
            </div>
          </div>

          <dl className="relative mt-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-white/70">Dia</dt>
              <dd className="font-semibold">{date ? `${DAY_NAMES[dates.indexOf(date)] ?? ''}, ${fmtDayMonth(date)}` : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/70">Horário</dt>
              <dd className="font-semibold tabular-nums">
                {start} → {end}
              </dd>
            </div>
            {block && block.studiedSeconds > 0 && (
              <div className="flex justify-between">
                <dt className="text-white/70">Já estudado</dt>
                <dd className="font-semibold">{fmtDuration(block.studiedSeconds)}</dd>
              </div>
            )}
          </dl>

          {/* Ações do bloco existente */}
          {block && (block.kind === 'study' || block.kind === 'revisao') && (
            <div className="relative mt-5 space-y-2">
              {!block.done && (
                <button
                  onClick={() => {
                    onClose()
                    navigate(`/foco/${block.id}`)
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-bold text-ink shadow-lg transition hover:-translate-y-0.5"
                >
                  <Play size={16} style={{ color }} /> Começar agora
                </button>
              )}
              {block.kind === 'revisao' && !block.done && block.topicId ? (
                <div className="rounded-2xl bg-white/15 p-2.5">
                  <div className="mb-2 text-center text-[11px] font-semibold text-white/80">Já revisou? Como foi?</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['dificil', 'ok', 'facil'] as ReviewRating[]).map((r) => (
                      <button key={r} onClick={() => rateReview(block.topicId!, r, block.id).then(onClose)} className="rounded-xl bg-white/20 py-2 text-xs font-bold hover:bg-white/30">
                        <span className="block text-base">{RATING_LABEL[r].emoji}</span>
                        {RATING_LABEL[r].label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button onClick={() => setBlockDone(block.id, !block.done).then(onClose)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/15 py-2.5 text-sm font-bold hover:bg-white/25">
                  {block.done ? <RotateCcw size={16} /> : <Check size={16} />} {block.done ? 'Desfazer conclusão' : 'Marcar como feito'}
                </button>
              )}
            </div>
          )}

          <div className="pointer-events-none relative mt-auto hidden justify-end pt-4 md:flex">
            <Capybara pose={kind === 'prova' ? 'focado' : kind === 'compromisso' ? 'relaxando' : kind === 'revisao' ? 'pensando' : 'estudando'} size={92} />
          </div>
        </aside>

        {/* Formulário */}
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-line px-6 py-4">
            <div>
              <h2 className="text-lg font-bold">{block ? 'Editar bloco' : 'Criar bloco'}</h2>
              <p className="text-xs text-muted">{block ? 'Mudou de ideia? Ajuste o que quiser.' : 'Monte o bloco e veja a prévia ao lado.'}</p>
            </div>
            <button onClick={onClose} className="hidden rounded-full p-2 text-muted hover:bg-slate-100 md:block" aria-label="Fechar">
              <X size={18} />
            </button>
          </header>

          <div className="thin-scroll flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <Section n={1} title="Que tipo de bloco?">
              <div className={`grid gap-2 ${kinds.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
                {kinds.map((k) => {
                  const on = kind === k.id
                  return (
                    <button
                      key={k.id}
                      onClick={() => setKind(k.id)}
                      className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${on ? 'border-transparent' : 'border-line hover:border-slate-300 hover:bg-slate-50'}`}
                      style={on ? { background: tint(color, 0.08), boxShadow: `inset 0 0 0 2px ${color}` } : undefined}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={on ? { background: color, color: '#fff' } : { background: '#f1f2f5', color: '#6b7385' }}>
                        {k.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{k.label}</span>
                        <span className="block text-[11px] leading-tight text-muted">{k.hint}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </Section>

            {needsSubject && (
              <Section n={2} title="Qual matéria?">
                {subjects.length === 0 ? (
                  <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Cadastre uma matéria em Matérias primeiro.</p>
                ) : (
                  <div className="space-y-2.5">
                    {AREAS.map((a) => {
                      const list = subjects.filter((x) => x.areaId === a.id)
                      if (!list.length) return null
                      return (
                        <div key={a.id}>
                          <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">{a.name}</div>
                          <div className="flex flex-wrap gap-2">
                            {list.map((x) => {
                              const on = x.id === subjectId
                              return (
                                <button
                                  key={x.id}
                                  onClick={() => {
                                    setSubjectId(x.id)
                                    setTopicId('')
                                  }}
                                  className={`flex items-center gap-2 rounded-2xl border py-1.5 pr-3.5 pl-1.5 text-sm font-semibold transition ${on ? 'border-transparent' : 'border-line hover:bg-slate-50'}`}
                                  style={on ? { background: tint(x.color, 0.12), boxShadow: `inset 0 0 0 2px ${x.color}`, color: `color-mix(in srgb, ${x.color} 80%, #000)` } : undefined}
                                >
                                  <SubjectIcon subject={x} size={28} />
                                  {x.name}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>
            )}

            {hasTopic && subject && (
              <Section n={3} title="Qual tópico?">
                <div className="thin-scroll flex max-h-44 flex-wrap gap-2 overflow-y-auto pr-1">
                  {[{ id: '', name: 'Livre', done: false }, ...subjectTopics].map((t) => {
                    const on = t.id === topicId
                    return (
                      <button
                        key={t.id || 'livre'}
                        onClick={() => setTopicId(t.id)}
                        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${on ? 'border-transparent text-white' : t.done ? 'border-line text-muted' : 'border-line hover:bg-slate-50'}`}
                        style={on ? { background: subject.color } : undefined}
                      >
                        {t.done && <Check size={13} />}
                        {t.name}
                      </button>
                    )
                  })}
                </div>
                {subjectTopics.length === 0 && <p className="mt-2 text-xs text-muted">Essa matéria ainda não tem tópicos. Você pode criar em Matérias.</p>}
              </Section>
            )}

            {!hasTopic && (
              <Section n={needsSubject ? 3 : 2} title={kind === 'prova' ? 'Nome da prova ou entrega' : 'O que é?'}>
                <input
                  id="block-title"
                  value={title}
                  onChange={(ev) => setTitle(ev.target.value)}
                  placeholder={kind === 'prova' ? 'Ex.: P1 de Cálculo' : 'Ex.: Academia'}
                  className="w-full rounded-2xl border border-line bg-[#f8f9fb] px-4 py-3 text-sm font-semibold outline-none focus:border-brand/50 focus:bg-white focus:ring-4 focus:ring-brand/10"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(TITLE_HINTS[kind] ?? []).map((h) => (
                    <button key={h} onClick={() => setTitle(kind === 'prova' && subject ? `${h} de ${subject.name}` : h)} className="rounded-full bg-[#f1f2f5] px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-[#e8e9ee]">
                      {h}
                    </button>
                  ))}
                </div>
              </Section>
            )}

            <Section n={hasTopic ? (subject ? 4 : 3) : needsSubject ? 4 : 3} title="Quando?">
              <div className="grid grid-cols-7 gap-1.5">
                {dates.map((d, i) => {
                  const on = d === date
                  const past = d < todayIso
                  return (
                    <button
                      key={d}
                      onClick={() => setDate(d)}
                      className={`relative flex flex-col items-center rounded-2xl border py-2 transition ${on ? 'border-transparent text-white' : 'border-line hover:bg-slate-50'} ${past && !on ? 'opacity-45' : ''}`}
                      style={on ? { background: color, boxShadow: `0 8px 18px -10px ${color}` } : undefined}
                    >
                      <span className={`text-[10px] font-bold tracking-wider ${on ? 'text-white/80' : 'text-muted'}`}>{DAY_SHORT[i]}</span>
                      <span className="text-base font-bold tabular-nums">{d.slice(8)}</span>
                      {d === todayIso && <span className={`absolute bottom-1 h-1 w-1 rounded-full ${on ? 'bg-white' : 'bg-brand'}`} />}
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-[#f6f7f9] p-3">
                <Clock3 size={18} className="text-muted" />
                <label className="flex flex-col">
                  <span className="text-[10px] font-semibold text-muted uppercase">Início</span>
                  <input id="block-start" type="time" value={start} onChange={(ev) => setStart(ev.target.value)} className="bg-transparent font-display text-xl font-bold outline-none" />
                </label>
                <span className="text-muted">→</span>
                <label className="flex flex-col">
                  <span className="text-[10px] font-semibold text-muted uppercase">Fim</span>
                  <input id="block-end" type="time" value={end} onChange={(ev) => setEnd(ev.target.value)} className="bg-transparent font-display text-xl font-bold outline-none" />
                </label>
                <div className="ml-auto flex flex-wrap gap-1.5">
                  {DURATIONS.map((m) => {
                    const on = minutes === m
                    return (
                      <button
                        key={m}
                        onClick={() => setDuration(m)}
                        className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${on ? 'text-white' : 'bg-white text-slate-600 shadow-sm hover:bg-slate-50'}`}
                        style={on ? { background: color } : undefined}
                      >
                        {fmtDuration(m * 60)}
                      </button>
                    )
                  })}
                </div>
              </div>
              {minutes <= 0 && <p className="mt-2 text-xs font-semibold text-rose-600">O fim precisa ser depois do início.</p>}
            </Section>
          </div>

          <footer className="flex items-center gap-2 border-t border-line px-6 py-4">
            {block && (
              <button onClick={() => deleteBlock(block.id).then(onClose)} className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                <Trash2 size={16} /> Excluir
              </button>
            )}
            <button onClick={onClose} className="ml-auto rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={!valid}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              style={{ background: color, boxShadow: `0 10px 22px -10px ${color}` }}
            >
              <Check size={16} /> {block ? 'Salvar alterações' : 'Criar bloco'}
            </button>
          </footer>
        </div>
      </div>
    </div>
  )
}
