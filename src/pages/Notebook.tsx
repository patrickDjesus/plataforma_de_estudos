import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Sparkles, Swords, Waypoints, ChevronDown, ChevronRight, FilePlus2, FileText, Link2, Search, Trash2 } from 'lucide-react'
import { AREAS, useNote, useNotes, useSubjects, useTopics } from '../db/hooks'
import { createNote, deleteNote, updateNote } from '../db/repo'
import { db } from '../db/db'
import type { Note } from '../db/types'
import { AREA_COLOR, tint } from '../lib/colors'
import { linkedTitles, renameLinks } from '../lib/wikilink'
import { NoteEditor } from '../components/NoteEditor'
import { CardsPanel } from '../components/CardsPanel'
import { ChallengeModal, ExplainModal } from '../components/ChallengeModal'
import { SubjectIcon } from '../components/SubjectIcon'
import { NotebookScene } from '../components/Scenes'
import { askConfirm } from '../components/confirm'
import { Btn, Card, inputCls } from '../components/ui'

export function NotebookPage() {
  const { noteId } = useParams()
  const navigate = useNavigate()
  const subjects = useSubjects()
  const topics = useTopics()
  const notes = useNotes()
  const note = useNote(noteId)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<'desafio' | 'explicar' | null>(null)
  const [editorVersion, setEditorVersion] = useState(0)
  // Matérias começam fechadas (são muitas); a da nota aberta abre sozinha
  const [toggled, setToggled] = useState<Set<string>>(new Set())

  const allTitles = useMemo(() => new Set(notes.map((n) => n.title.trim().toLowerCase())), [notes])
  const backlinks = useMemo(() => {
    if (!note) return []
    const t = note.title.trim().toLowerCase()
    return notes.filter((n) => n.id !== note.id && linkedTitles(n.content).some((x) => x.trim().toLowerCase() === t))
  }, [notes, note])
  const outgoing = useMemo(() => {
    if (!note) return []
    const titles = new Set(linkedTitles(note.content).map((x) => x.trim().toLowerCase()))
    return notes.filter((n) => n.id !== note.id && titles.has(n.title.trim().toLowerCase()))
  }, [notes, note])

  const filtered = query.trim()
    ? notes.filter((n) => (n.title + ' ' + n.content.replace(/<[^>]+>/g, ' ')).toLowerCase().includes(query.toLowerCase()))
    : null

  const newNote = async (subjectId: string, topicId?: string) => {
    const id = await createNote(subjectId, topicId, 'Nova nota')
    navigate(`/caderno/${id}`)
  }

  const toggle = (id: string) => {
    const next = new Set(toggled)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setToggled(next)
  }

  const rename = async (n: Note, title: string) => {
    const clean = title.trim()
    if (!clean || clean === n.title) return
    await db.transaction('rw', db.notes, async () => {
      await updateNote(n.id, { title: clean })
      for (const other of await db.notes.toArray()) {
        const html = renameLinks(other.content, n.title, clean)
        if (html !== other.content) await db.notes.update(other.id, { content: html })
      }
    })
  }

  const subject = note ? subjects.find((s) => s.id === note.subjectId) : undefined
  const NoteItem = ({ n }: { n: Note }) => (
    <Link
      to={`/caderno/${n.id}`}
      className={`flex items-center gap-2 truncate rounded-lg px-2 py-1 text-sm ${n.id === noteId ? 'bg-brand-soft font-semibold text-brand' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      <FileText size={14} className="shrink-0 opacity-60" />
      <span className="truncate">{n.title}</span>
    </Link>
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* Árvore */}
      <Card className="h-fit p-4 lg:sticky lg:top-24">
        <div className="relative mb-3">
          <Search size={15} className="absolute top-2.5 left-3 text-muted" />
          <input className={`${inputCls} pl-9`} placeholder="Buscar nas notas…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="thin-scroll max-h-[68vh] space-y-3 overflow-y-auto pr-1">
          {filtered ? (
            filtered.length ? filtered.map((n) => <NoteItem key={n.id} n={n} />) : <p className="px-2 text-sm text-muted">Nada encontrado.</p>
          ) : subjects.length === 0 ? (
            <p className="px-2 text-sm text-muted">
              Cadastre matérias em{' '}
              <Link to="/materias" className="font-semibold text-brand">
                Matérias
              </Link>{' '}
              para começar o caderno.
            </p>
          ) : (
            AREAS.map((area) => {
              const list = subjects.filter((s) => s.areaId === area.id)
              if (!list.length) return null
              return (
                <div key={area.id}>
                  <div className="mb-1 flex items-center gap-2 px-2 text-xs font-bold tracking-wider text-muted uppercase">
                    <span className="h-2 w-2 rounded-full" style={{ background: AREA_COLOR[area.id] }} />
                    {area.name}
                  </div>
                  {list.map((s) => {
                    const sTopics = topics.filter((t) => t.subjectId === s.id)
                    const loose = notes.filter((n) => n.subjectId === s.id && !n.topicId)
                    const startsOpen = s.id === note?.subjectId
                    const open = toggled.has(s.id) ? !startsOpen : startsOpen
                    return (
                      <div key={s.id} className="mb-1">
                        <div className="group flex items-center gap-1 rounded-xl px-1.5 py-1.5" style={{ background: tint(s.color, 0.08) }}>
                          <button onClick={() => toggle(s.id)} className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold" style={{ color: `color-mix(in srgb, ${s.color} 85%, #000)` }}>
                            <SubjectIcon subject={s} size={24} />
                            <span className="truncate">{s.name}</span>
                            {open ? <ChevronDown size={14} className="ml-auto opacity-60" /> : <ChevronRight size={14} className="ml-auto opacity-60" />}
                          </button>
                          <button onClick={() => newNote(s.id)} className="rounded p-1 opacity-0 group-hover:opacity-100" style={{ color: s.color }} title="Nova nota na matéria">
                            <FilePlus2 size={15} />
                          </button>
                        </div>
                        {open && (
                          <div className="mt-1 ml-3 space-y-0.5 border-l-2 pl-2" style={{ borderColor: tint(s.color, 0.3) }}>
                            {sTopics.map((t) => {
                              const tNotes = notes.filter((n) => n.topicId === t.id)
                              // Tópico com um único documento de mesmo nome: mostra só o documento
                              if (tNotes.length === 1 && tNotes[0].title.startsWith(t.name)) return <NoteItem key={t.id} n={tNotes[0]} />
                              return (
                                <div key={t.id}>
                                  <div className="group flex items-center justify-between px-2 py-0.5 text-xs font-semibold text-slate-500">
                                    <span className="truncate">{t.name}</span>
                                    <button onClick={() => newNote(s.id, t.id)} className="opacity-0 group-hover:opacity-100" title="Nova nota no tópico">
                                      <FilePlus2 size={13} />
                                    </button>
                                  </div>
                                  {tNotes.map((n) => (
                                    <NoteItem key={n.id} n={n} />
                                  ))}
                                </div>
                              )
                            })}
                            {loose.map((n) => (
                              <NoteItem key={n.id} n={n} />
                            ))}
                            {sTopics.length === 0 && loose.length === 0 && (
                              <button onClick={() => newNote(s.id)} className="px-2 py-1 text-xs text-muted hover:text-brand">
                                + primeira nota
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </Card>

      {/* Nota aberta */}
      {note ? (
        <div className="min-w-0">
          <Card className="relative overflow-hidden px-6 py-6 sm:px-10">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <SubjectIcon subject={subject} size={28} />
              <select
                className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold"
                style={{ color: subject?.color }}
                value={note.subjectId}
                onChange={(e) => updateNote(note.id, { subjectId: e.target.value, topicId: undefined })}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-600"
                value={note.topicId ?? ''}
                onChange={(e) => updateNote(note.id, { topicId: e.target.value || undefined })}
              >
                <option value="">Sem tópico</option>
                {topics
                  .filter((t) => t.subjectId === note.subjectId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
              <span className="ml-auto text-xs text-muted">Salvo automaticamente</span>
              <button onClick={() => setModal('desafio')} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft" title="Teste o que você sabe sobre este tópico">
                <Swords size={14} /> Desafie-me
              </button>
              <button onClick={() => setModal('explicar')} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft" title="O Claude explica o tópico para você começar a anotar">
                <Sparkles size={14} /> Explicar
              </button>
              <button onClick={() => navigate(`/mapa?nota=${note.id}`)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft" title="Ver as conexões desta nota no mapa">
                <Waypoints size={14} /> Ver no mapa
              </button>
              <button
                onClick={async () => {
                  if (!(await askConfirm(`Excluir a nota "${note.title}"?`))) return
                  await deleteNote(note.id)
                  navigate('/caderno')
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                title="Excluir nota"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <input
              key={note.id + note.title}
              defaultValue={note.title}
              onBlur={(e) => rename(note, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="mb-4 w-full bg-transparent text-3xl font-extrabold tracking-tight outline-none"
            />
            <NoteEditor key={note.id} note={note} subject={subject} allTitles={allTitles} reloadToken={editorVersion} />
          </Card>

          {modal === 'desafio' && <ChallengeModal subjectId={note.subjectId} topicId={note.topicId} origin="demanda" onClose={() => setModal(null)} />}
          {modal === 'explicar' && (
            <ExplainModal subjectId={note.subjectId} topicId={note.topicId} noteId={note.id} onClose={() => setModal(null)} onInserted={() => setEditorVersion((v) => v + 1)} />
          )}
          <CardsPanel key={`cards-${note.id}`} note={note} subject={subject} topic={topics.find((t) => t.id === note.topicId)} />

          {(backlinks.length > 0 || outgoing.length > 0) && (
            <Card className="mt-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <Link2 size={16} /> Conexões
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <ConnList title="Esta nota cita" notes={outgoing} subjects={subjects} />
                <ConnList title="Citada por" notes={backlinks} subjects={subjects} />
              </div>
            </Card>
          )}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <NotebookScene />
          <h2 className="mt-5 text-xl font-bold">Seu caderno</h2>
          <p className="mt-1 max-w-sm text-sm text-muted">Escolha uma nota à esquerda ou crie uma nova. Use [[Nome]] para conectar notas entre matérias.</p>
          {subjects[0] && (
            <Btn variant="primary" className="mt-5" onClick={() => newNote(subjects[0].id)}>
              <FilePlus2 size={16} /> Nova nota
            </Btn>
          )}
        </Card>
      )}
    </div>
  )
}

function ConnList({ title, notes, subjects }: { title: string; notes: Note[]; subjects: { id: string; color: string; name: string }[] }) {
  return (
    <div>
      <div className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">{title}</div>
      {notes.length === 0 && <p className="text-sm text-muted">—</p>}
      <div className="flex flex-wrap gap-2">
        {notes.map((n) => {
          const s = subjects.find((x) => x.id === n.subjectId)
          return (
            <Link key={n.id} to={`/caderno/${n.id}`} className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: tint(s?.color ?? '#3e63f2'), color: s?.color }}>
              {n.title}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
