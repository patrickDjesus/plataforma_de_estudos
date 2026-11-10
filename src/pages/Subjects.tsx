import { useState } from 'react'
import { GripVertical, Layers, Plus, Trash2 } from 'lucide-react'
import { AREAS, useSubjects, useTopics } from '../db/hooks'
import { addSubject, addTopic, deleteSubject, deleteTopic, reorderTopics, updateSubject, updateTopic } from '../db/repo'
import type { AreaId, Subject, Topic } from '../db/types'
import { AREA_COLOR, tint } from '../lib/colors'
import { daysUntil, fmtDuration } from '../lib/dates'
import { askConfirm } from '../components/confirm'
import { SUBJECT_ICONS, SubjectIcon, guessIcon } from '../components/SubjectIcon'
import { Btn, Card, Field, Modal, PageHeader, inputCls } from '../components/ui'

export function SubjectsPage() {
  const subjects = useSubjects()
  const topics = useTopics()
  const [openId, setOpenId] = useState<string | null>(null)
  const open = subjects.find((s) => s.id === openId)
  return (
    <>
      <PageHeader icon={<Layers size={24} />} title="Matérias" subtitle="Organize suas áreas, matérias e tópicos. O planejador usa peso, obrigatoriedade e prazo." />
      <div className="space-y-6">
        {AREAS.map((area) => (
          <AreaSection
            key={area.id}
            areaId={area.id}
            name={area.name}
            subjects={subjects.filter((s) => s.areaId === area.id)}
            topics={topics}
            onOpen={setOpenId}
          />
        ))}
      </div>
      {open && <SubjectModal subject={open} topics={topics.filter((t) => t.subjectId === open.id)} onClose={() => setOpenId(null)} />}
    </>
  )
}

function AreaSection({ areaId, name, subjects, topics, onOpen }: { areaId: AreaId; name: string; subjects: Subject[]; topics: Topic[]; onOpen: (id: string) => void }) {
  const [newName, setNewName] = useState('')
  const add = async () => {
    if (!newName.trim()) return
    const id = await addSubject(areaId, newName)
    await updateSubject(id, { icon: guessIcon(newName) })
    setNewName('')
  }
  return (
    <Card className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-xl font-bold">
          <span className="h-3 w-3 rounded-full" style={{ background: AREA_COLOR[areaId], boxShadow: `0 0 0 4px ${tint(AREA_COLOR[areaId], 0.15)}` }} />
          {name}
        </h2>
        <div className="flex w-full max-w-sm gap-2">
          <input
            id={`new-subject-${areaId}`}
            className={inputCls}
            placeholder={`Nova matéria em ${name}…`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Btn variant="primary" onClick={add} disabled={!newName.trim()} aria-label="Adicionar matéria">
            <Plus size={16} />
          </Btn>
        </div>
      </div>
      {subjects.length === 0 ? (
        <p className="rounded-2xl bg-[#f6f7f9] px-4 py-6 text-center text-sm text-muted">Nenhuma matéria ainda. Digite um nome acima, por exemplo “Cálculo I”.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
          {subjects.map((s) => (
            <SubjectCard key={s.id} subject={s} topics={topics.filter((t) => t.subjectId === s.id)} onOpen={() => onOpen(s.id)} />
          ))}
        </div>
      )}
    </Card>
  )
}

function SubjectCard({ subject: s, topics, onOpen }: { subject: Subject; topics: Topic[]; onOpen: () => void }) {
  const done = topics.filter((t) => t.done).length
  const pct = topics.length ? Math.round((done / topics.length) * 100) : 0
  const deadline = s.deadline ? daysUntil(s.deadline) : null
  return (
    <button onClick={onOpen} className="group flex flex-col overflow-hidden rounded-[18px] border border-line bg-white text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-16px_rgba(16,24,40,0.25)]">
      <div className="relative grid h-32 place-items-center overflow-hidden" style={{ background: `radial-gradient(120% 90% at 50% 100%, ${tint(s.color, 0.22)}, ${tint(s.color, 0.05)})` }}>
        <span className="absolute -top-6 -right-6 h-20 w-20 rounded-full" style={{ background: tint(s.color, 0.12) }} />
        <span className="absolute bottom-3 left-4 h-2.5 w-2.5 rotate-45 rounded-[3px]" style={{ background: tint(s.color, 0.45) }} />
        <span className="absolute top-5 left-8 h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
        <span className="transition group-hover:scale-105 group-hover:-rotate-3">
          <SubjectIcon subject={s} size={70} />
        </span>
      </div>
      <div className="h-1 bg-[#eef0f4]">
        <div className="h-full" style={{ width: `${pct}%`, background: s.color }} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand">Progresso: {pct}%</span>
          {s.mandatory && <span className="rounded-full bg-[#f1f2f5] px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">Obrigatória</span>}
          {deadline !== null && deadline >= 0 && (
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-600">{deadline === 0 ? 'Prazo hoje' : `Prazo em ${deadline}d`}</span>
          )}
        </div>
        <div className="font-display text-[15px] font-bold">{s.name}</div>
        <div className="text-xs text-muted">
          {topics.length} tópico(s) · peso {s.weight}
        </div>
        <span className="mt-auto rounded-xl bg-[#f1f2f5] py-2 text-center text-xs font-semibold text-ink transition group-hover:bg-brand-soft group-hover:text-brand">Ver tópicos e ajustes</span>
      </div>
    </button>
  )
}

function SubjectModal({ subject: s, topics, onClose }: { subject: Subject; topics: Topic[]; onClose: () => void }) {
  const [topicName, setTopicName] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const addT = async () => {
    if (!topicName.trim()) return
    await addTopic(s.id, topicName)
    setTopicName('')
  }
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const ids = topics.map((t) => t.id).filter((id) => id !== dragId)
    ids.splice(ids.indexOf(targetId), 0, dragId)
    reorderTopics(ids)
    setDragId(null)
  }
  const iconKey = s.icon ?? guessIcon(s.name)

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      title={
        <span className="flex items-center gap-3">
          <SubjectIcon subject={s} size={40} />
          <input
            key={s.id}
            id="subject-name"
            defaultValue={s.name}
            onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && updateSubject(s.id, { name: e.target.value.trim() })}
            className="w-full min-w-0 rounded-lg bg-transparent px-1 font-display text-lg font-bold outline-none focus:bg-[#f6f7f9]"
            aria-label="Nome da matéria"
          />
        </span>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_1.15fr]">
        <div className="space-y-4">
          <Field label="Ícone">
            <div className="grid grid-cols-6 gap-1.5">
              {Object.entries(SUBJECT_ICONS).map(([key, def]) => (
                <button
                  key={key}
                  onClick={() => updateSubject(s.id, { icon: key })}
                  title={def.label}
                  className={`grid place-items-center rounded-xl p-1 transition ${iconKey === key ? 'ring-2 ring-offset-2' : 'opacity-60 hover:opacity-100'}`}
                  style={{ ['--tw-ring-color' as string]: s.color }}
                >
                  <SubjectIcon iconKey={key} color={s.color} size={34} />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Cor">
            <div className="flex items-center gap-3">
              <label className="relative h-10 w-16 cursor-pointer overflow-hidden rounded-xl" style={{ background: s.color }}>
                <input id="subject-color" type="color" value={s.color} onChange={(e) => updateSubject(s.id, { color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <span className="text-xs text-muted">Usada no calendário, no caderno e nos gráficos.</span>
            </div>
          </Field>
          <Field label="Peso no planejamento">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((w) => (
                <button
                  key={w}
                  onClick={() => updateSubject(s.id, { weight: w })}
                  className="h-9 flex-1 rounded-xl text-sm font-bold transition"
                  style={w <= s.weight ? { background: s.color, color: '#fff' } : { background: '#f1f2f5', color: '#6b7385' }}
                >
                  {w}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Obrigatória">
              <button
                onClick={() => updateSubject(s.id, { mandatory: !s.mandatory })}
                className={`flex h-[42px] w-full items-center justify-between rounded-xl px-3 text-sm font-semibold transition ${s.mandatory ? 'bg-brand-soft text-brand' : 'bg-[#f1f2f5] text-muted'}`}
              >
                {s.mandatory ? 'Sim' : 'Não'}
                <span className={`relative h-5 w-9 rounded-full transition ${s.mandatory ? 'bg-brand' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${s.mandatory ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
              </button>
            </Field>
            <Field label="Prazo (opcional)">
              <input id="subject-deadline" type="date" value={s.deadline ?? ''} onChange={(e) => updateSubject(s.id, { deadline: e.target.value || undefined })} className={inputCls} />
            </Field>
          </div>
          <Btn
            variant="danger"
            className="w-full"
            onClick={async () => {
              if (await askConfirm(`Excluir "${s.name}" com seus tópicos e notas? O histórico de estudo é mantido.`)) {
                onClose()
                await deleteSubject(s.id)
              }
            }}
          >
            <Trash2 size={16} /> Excluir matéria
          </Btn>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-muted">Tópicos (arraste para ordenar)</span>
            <span className="text-xs text-muted">
              {topics.filter((t) => t.done).length}/{topics.length} concluídos
            </span>
          </div>
          <div className="thin-scroll max-h-[340px] space-y-1 overflow-y-auto rounded-2xl bg-[#f6f7f9] p-2">
            {topics.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted">Adicione o primeiro tópico abaixo.</p>}
            {topics.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={() => setDragId(t.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(t.id)}
                className={`group flex items-center gap-2 rounded-xl bg-white px-2 py-2 shadow-[0_1px_2px_rgba(16,24,40,0.05)] ${dragId === t.id ? 'opacity-40' : ''}`}
              >
                <GripVertical size={14} className="cursor-grab text-slate-300" />
                <input id={`topic-done-${t.id}`} type="checkbox" checked={t.done} onChange={(e) => updateTopic(t.id, { done: e.target.checked })} style={{ accentColor: s.color }} className="h-4 w-4" />
                <input
                  id={`topic-name-${t.id}`}
                  className={`min-w-0 flex-1 bg-transparent text-sm font-medium outline-none ${t.done ? 'text-muted line-through' : ''}`}
                  defaultValue={t.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && updateTopic(t.id, { name: e.target.value.trim() })}
                />
                {t.studiedSeconds > 0 && <span className="text-xs text-muted">{fmtDuration(t.studiedSeconds)}</span>}
                <button onClick={() => deleteTopic(t.id)} className="text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-600" title="Excluir tópico">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input id="new-topic" className={inputCls} placeholder="Novo tópico…" value={topicName} onChange={(e) => setTopicName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addT()} />
            <Btn variant="primary" onClick={addT} disabled={!topicName.trim()} aria-label="Adicionar tópico">
              <Plus size={16} />
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  )
}
