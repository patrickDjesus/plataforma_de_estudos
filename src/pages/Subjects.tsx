import { useState } from 'react'
import { ChevronDown, ChevronRight, GripVertical, Layers, Plus, Trash2 } from 'lucide-react'
import { AREAS, useSubjects, useTopics } from '../db/hooks'
import { addSubject, addTopic, deleteSubject, deleteTopic, reorderTopics, updateSubject, updateTopic } from '../db/repo'
import type { AreaId, Subject, Topic } from '../db/types'
import { AREA_COLOR, tint } from '../lib/colors'
import { fmtDuration } from '../lib/dates'
import { askConfirm } from '../components/confirm'
import { Btn, Card, PageHeader, inputCls } from '../components/ui'

export function SubjectsPage() {
  const subjects = useSubjects()
  const topics = useTopics()
  return (
    <>
      <PageHeader icon={<Layers size={22} />} title="Matérias" subtitle="Organize Áreas → Matérias → Tópicos. O planejador usa peso, obrigatoriedade e prazo." />
      <div className="space-y-8">
        {AREAS.map((area) => (
          <AreaSection key={area.id} areaId={area.id} name={area.name} subjects={subjects.filter((s) => s.areaId === area.id)} topics={topics} />
        ))}
      </div>
    </>
  )
}

function AreaSection({ areaId, name, subjects, topics }: { areaId: AreaId; name: string; subjects: Subject[]; topics: Topic[] }) {
  const [newName, setNewName] = useState('')
  const add = async () => {
    if (!newName.trim()) return
    await addSubject(areaId, newName)
    setNewName('')
  }
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ background: AREA_COLOR[areaId] }} />
        <h2 className="text-lg font-bold">{name}</h2>
        <span className="text-sm text-muted">{subjects.length} matéria(s)</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {subjects.map((s) => (
          <SubjectCard key={s.id} subject={s} topics={topics.filter((t) => t.subjectId === s.id)} />
        ))}
        <Card className="flex items-center gap-2 border-dashed">
          <input className={inputCls} placeholder={`Nova matéria em ${name}…`} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <Btn variant="primary" onClick={add} disabled={!newName.trim()}>
            <Plus size={16} /> Adicionar
          </Btn>
        </Card>
      </div>
    </section>
  )
}

function SubjectCard({ subject: s, topics }: { subject: Subject; topics: Topic[] }) {
  const [open, setOpen] = useState(false)
  const [topicName, setTopicName] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const done = topics.filter((t) => t.done).length
  const pct = topics.length ? Math.round((done / topics.length) * 100) : 0

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

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: s.color }} />
      <div className="flex items-start gap-3">
        <label className="relative mt-0.5 h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-xl shadow-inner" style={{ background: s.color }} title="Mudar cor">
          <input type="color" value={s.color} onChange={(e) => updateSubject(s.id, { color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <div className="min-w-0 flex-1">
          <input
            className="w-full rounded-lg bg-transparent px-1 text-base font-bold outline-none focus:bg-slate-50"
            defaultValue={s.name}
            onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && updateSubject(s.id, { name: e.target.value.trim() })}
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-muted">
            <div className="flex items-center gap-1" title="Peso no planejamento">
              Peso
              {[1, 2, 3, 4, 5].map((w) => (
                <button
                  key={w}
                  onClick={() => updateSubject(s.id, { weight: w })}
                  className="h-4 w-4 rounded-full border-2 transition"
                  style={{ borderColor: s.color, background: w <= s.weight ? s.color : 'transparent' }}
                  aria-label={`Peso ${w}`}
                />
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={s.mandatory} onChange={(e) => updateSubject(s.id, { mandatory: e.target.checked })} className="accent-indigo-600" />
              Obrigatória
            </label>
            <label className="flex items-center gap-1.5">
              Prazo
              <input type="date" value={s.deadline ?? ''} onChange={(e) => updateSubject(s.id, { deadline: e.target.value || undefined })} className="rounded-lg border border-line px-1.5 py-0.5 text-ink" />
            </label>
          </div>
        </div>
        <button
          onClick={async () => (await askConfirm(`Excluir "${s.name}" com seus tópicos e notas? O histórico de estudo é mantido.`)) && deleteSubject(s.id)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          title="Excluir matéria"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <button onClick={() => setOpen(!open)} className="mt-4 flex w-full items-center gap-2 text-sm font-semibold">
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Tópicos
        <span className="text-muted">
          {done}/{topics.length}
        </span>
        <span className="ml-2 h-2 flex-1 overflow-hidden rounded-full" style={{ background: tint(s.color, 0.15) }}>
          <span className="block h-full rounded-full transition-all" style={{ width: `${pct}%`, background: s.color }} />
        </span>
        <span className="text-xs text-muted">{pct}%</span>
      </button>

      {open && (
        <div className="mt-3 space-y-1">
          {topics.map((t) => (
            <div
              key={t.id}
              draggable
              onDragStart={() => setDragId(t.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(t.id)}
              className={`group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-50 ${dragId === t.id ? 'opacity-40' : ''}`}
            >
              <GripVertical size={14} className="cursor-grab text-slate-300" />
              <input type="checkbox" checked={t.done} onChange={(e) => updateTopic(t.id, { done: e.target.checked })} style={{ accentColor: s.color }} />
              <input
                className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${t.done ? 'text-muted line-through' : ''}`}
                defaultValue={t.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && updateTopic(t.id, { name: e.target.value.trim() })}
              />
              {t.studiedSeconds > 0 && <span className="text-xs text-muted">{fmtDuration(t.studiedSeconds)}</span>}
              <button onClick={() => deleteTopic(t.id)} className="text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100" title="Excluir tópico">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <input className={inputCls} placeholder="Novo tópico…" value={topicName} onChange={(e) => setTopicName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addT()} />
            <Btn variant="soft" onClick={addT} disabled={!topicName.trim()}>
              <Plus size={16} />
            </Btn>
          </div>
        </div>
      )}
    </Card>
  )
}
