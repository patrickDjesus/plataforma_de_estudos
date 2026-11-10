import { useEffect, useState } from 'react'
import { Check, Play, RotateCcw, Trash2 } from 'lucide-react'
import { useSubjects, useTopics } from '../db/hooks'
import { addBlock, deleteBlock, rateReview, setBlockDone, startTimer, updateBlock } from '../db/repo'
import { RATING_LABEL } from '../lib/review'
import type { ReviewRating } from '../db/types'
import type { Block, BlockKind } from '../db/types'
import { DAY_NAMES, fmtDayMonth, fmtDuration, fmtTime, parseTime, weekDates } from '../lib/dates'
import { Btn, Field, Modal, inputCls } from './ui'

const KIND_LABEL: Record<BlockKind, string> = {
  study: 'Estudo',
  revisao: 'Revisão (agendada pela revisão espaçada)',
  compromisso: 'Compromisso (bloqueia o horário)',
  prova: 'Prova / entrega (vira prazo da matéria)',
}

export interface Draft {
  date: string
  start: number
}

export function BlockDialog({ weekId, block, draft, onClose }: { weekId: string; block?: Block; draft?: Draft; onClose: () => void }) {
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

  if (!open) return null
  const subjectTopics = topics.filter((t) => t.subjectId === subjectId)
  const needsSubject = kind !== 'compromisso'
  const valid = parseTime(end) > parseTime(start) && (!needsSubject || subjectId) && (kind === 'study' || kind === 'revisao' || title.trim() || subjectId)

  const save = async () => {
    const data = {
      weekId,
      date,
      start: parseTime(start),
      end: parseTime(end),
      kind,
      subjectId: needsSubject ? subjectId || undefined : undefined,
      topicId: (kind === 'study' || kind === 'revisao') ? topicId || undefined : undefined,
      title: title.trim() || undefined,
    }
    if (block) await updateBlock(block.id, data)
    else await addBlock(data)
    onClose()
  }

  const subject = subjects.find((s) => s.id === subjectId)
  const topic = topics.find((t) => t.id === topicId)

  return (
    <Modal open onClose={onClose} title={block ? 'Detalhes do bloco' : 'Novo bloco'}>
      <div className="space-y-4">
        {block && (block.kind === 'study' || block.kind === 'revisao') && (
          <div className="flex flex-wrap gap-2 rounded-2xl p-3" style={{ background: subject ? `${subject.color}14` : '#f8fafc' }}>
            <Btn
              variant="primary"
              onClick={() => {
                startTimer({ blockId: block.id, subjectId: block.subjectId, topicId: block.topicId, label: topic?.name ?? subject?.name ?? 'Estudo' })
                onClose()
              }}
            >
              <Play size={16} /> Começar
            </Btn>
            {block.kind === 'revisao' && !block.done && block.topicId ? (
              <div className="flex w-full flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted">Já revisou? Como foi:</span>
                {(['dificil', 'ok', 'facil'] as ReviewRating[]).map((r) => (
                  <Btn key={r} variant={r === 'ok' ? 'soft' : 'ghost'} onClick={() => rateReview(block.topicId!, r, block.id).then(onClose)}>
                    {RATING_LABEL[r].emoji} {RATING_LABEL[r].label}
                  </Btn>
                ))}
              </div>
            ) : (
              <Btn variant={block.done ? 'ghost' : 'soft'} onClick={() => setBlockDone(block.id, !block.done).then(onClose)}>
                {block.done ? <RotateCcw size={16} /> : <Check size={16} />} {block.done ? 'Desfazer' : 'Marcar como feito'}
              </Btn>
            )}
            {block.studiedSeconds > 0 && <span className="self-center text-sm text-muted">Estudado: {fmtDuration(block.studiedSeconds)}</span>}
          </div>
        )}

        <Field label="Tipo">
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as BlockKind)}>
            {(Object.keys(KIND_LABEL) as BlockKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>

        {needsSubject && (
          <Field label="Matéria">
            <select className={inputCls} value={subjectId} onChange={(e) => (setSubjectId(e.target.value), setTopicId(''))}>
              {subjects.length === 0 && <option value="">Cadastre uma matéria primeiro</option>}
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {(kind === 'study' || kind === 'revisao') && subjectTopics.length > 0 && (
          <Field label="Tópico">
            <select className={inputCls} value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">— Livre —</option>
              {subjectTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.done ? '✓ ' : ''}
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {kind !== 'study' && (
          <Field label="Título">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'prova' ? 'Ex.: P1 de Cálculo' : 'Ex.: Academia'} />
          </Field>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Field label="Dia">
            <select className={inputCls} value={date} onChange={(e) => setDate(e.target.value)}>
              {weekDates(weekId).map((d, i) => (
                <option key={d} value={d}>
                  {DAY_NAMES[i].slice(0, 3)} {fmtDayMonth(d)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Início">
            <input type="time" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Fim">
            <input type="time" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        <div className="flex justify-between gap-2 pt-2">
          {block ? (
            <Btn variant="danger" onClick={() => deleteBlock(block.id).then(onClose)}>
              <Trash2 size={16} /> Excluir
            </Btn>
          ) : (
            <span />
          )}
          <Btn variant="primary" onClick={save} disabled={!valid}>
            Salvar
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
