import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Layers3, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { Spinner } from './Voice'
import { db } from '../db/db'
import { addCards, deleteCard, updateCard } from '../db/repo'
import type { Flashcard, Note, Subject, Topic } from '../db/types'
import { AREAS } from '../db/hooks'
import { AIError, getAI, type AIProvider } from '../lib/ai'
import { contextBlock, flashcardPrompt } from '../lib/prompts'
import { tint } from '../lib/colors'
import { Card } from './ui'

type Draft = { front: string; back: string; key: string }

/** Flashcards do tópico da nota: criar à mão ou aprovar sugestões do Claude. */
export function CardsPanel({ note, subject, topic }: { note: Note; subject?: Subject; topic?: Topic }) {
  const cards = useLiveQuery(
    () => (topic ? db.cards.where('topicId').equals(topic.id).toArray() : db.cards.where('noteId').equals(note.id).toArray()),
    [topic?.id, note.id],
    [],
  )
  const [ai, setAI] = useState<AIProvider | null>(null)
  const [suggestions, setSuggestions] = useState<Draft[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [manual, setManual] = useState({ front: '', back: '' })
  const [editing, setEditing] = useState<string | null>(null)
  const color = subject?.color ?? '#c4471d'

  useEffect(() => {
    getAI().then(setAI)
  }, [])

  const ctx = { area: AREAS.find((a) => a.id === subject?.areaId)?.name ?? '', subject: subject?.name ?? '', topic: topic?.name ?? note.title, noteHtml: note.content }
  const fromNotes = contextBlock(ctx).fromNotes

  const suggest = async () => {
    if (!ai) return
    setLoading(true)
    setError('')
    try {
      const list = await ai.json<{ front?: string; back?: string }[]>(flashcardPrompt(ctx, [...cards.map((c) => c.front), ...suggestions.map((s) => s.front)]), { fresh: true })
      const valid = (Array.isArray(list) ? list : []).filter((c) => c?.front?.trim() && c?.back?.trim())
      setSuggestions((prev) => [...prev, ...valid.map((c, i) => ({ front: c.front!.trim(), back: c.back!.trim(), key: `${Date.now()}-${i}` }))])
      if (!valid.length) setError('O Claude não sugeriu cartões desta vez. Tente de novo.')
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Não consegui gerar os cartões.')
    } finally {
      setLoading(false)
    }
  }

  const base = { subjectId: note.subjectId, topicId: topic?.id, noteId: note.id }
  const approve = async (list: Draft[], source: Flashcard['source'] = 'ia') => {
    await addCards(list.map((d) => ({ ...base, front: d.front, back: d.back, source })))
    setSuggestions((prev) => prev.filter((s) => !list.some((d) => d.key === s.key)))
  }

  return (
    <Card className="mt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-sans text-sm font-bold">
          <Layers3 size={17} style={{ color }} /> Flashcards {topic ? `· ${topic.name}` : ''}
          <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: tint(color, 0.12), color }}>
            {cards.length}
          </span>
        </h3>
        {ai && (
          <button
            onClick={suggest}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-60"
            style={{ background: color }}
            title={fromNotes ? 'Cria cartões a partir desta nota' : 'A nota está vazia: os cartões virão do conhecimento geral sobre o tópico'}
          >
            {loading ? <Spinner size={14} /> : <Sparkles size={14} />} {loading ? 'Pensando…' : 'Sugerir com o Claude'}
          </button>
        )}
      </div>

      {ai && !fromNotes && suggestions.length === 0 && !loading && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Esta nota ainda está vazia, então as sugestões virão do conhecimento geral sobre o tópico. Escreva suas anotações para cartões mais personalizados.</p>
      )}
      {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}

      {/* Sugestões a aprovar */}
      {suggestions.length > 0 && (
        <div className="mb-4 rounded-2xl p-3" style={{ background: tint(color, 0.06), boxShadow: `inset 0 0 0 1.5px ${tint(color, 0.3)}` }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color }}>
              Sugestões do Claude ({suggestions.length}) · revise antes de aprovar
            </span>
            <div className="flex gap-1.5">
              <button onClick={() => setSuggestions([])} className="rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-white">
                Descartar todas
              </button>
              <button onClick={() => approve(suggestions)} className="rounded-lg px-2.5 py-1 text-xs font-bold text-white" style={{ background: color }}>
                Aprovar todas
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div key={s.key} className="grid gap-2 rounded-xl bg-white p-2.5 sm:grid-cols-[1fr_1fr_auto]">
                <textarea
                  aria-label="Frente"
                  value={s.front}
                  onChange={(e) => setSuggestions((prev) => prev.map((x) => (x.key === s.key ? { ...x, front: e.target.value } : x)))}
                  rows={2}
                  className="resize-none rounded-lg bg-[#f4f4f2] px-2.5 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand/20"
                />
                <textarea
                  aria-label="Verso"
                  value={s.back}
                  onChange={(e) => setSuggestions((prev) => prev.map((x) => (x.key === s.key ? { ...x, back: e.target.value } : x)))}
                  rows={2}
                  className="resize-none rounded-lg bg-[#f4f4f2] px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand/20"
                />
                <div className="flex items-start gap-1">
                  <button onClick={() => approve([s])} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50" title="Aprovar">
                    <Check size={16} />
                  </button>
                  <button onClick={() => setSuggestions((prev) => prev.filter((x) => x.key !== s.key))} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Descartar">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cartões existentes */}
      {cards.length > 0 && (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {cards.map((c) =>
            editing === c.id ? (
              <EditCard key={c.id} card={c} onDone={() => setEditing(null)} />
            ) : (
              <div key={c.id} className="group relative rounded-xl border border-line p-3">
                <div className="pr-12 text-sm font-semibold">{c.front}</div>
                <div className="mt-1 text-xs text-muted">{c.back}</div>
                <div className="mt-2 text-[10px] font-semibold text-muted">
                  {c.count === 0 ? 'Novo' : `Próxima: ${c.due.split('-').reverse().slice(0, 2).join('/')}`}
                  {c.source === 'ia' ? ' · sugerido pelo Claude' : ''}
                </div>
                <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => setEditing(c.id)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" title="Editar">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deleteCard(c.id)} className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Excluir">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {/* Novo cartão manual */}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input id={`card-front-${note.id}`} value={manual.front} onChange={(e) => setManual({ ...manual, front: e.target.value })} placeholder="Frente: pergunta ou conceito" className="rounded-xl border border-line bg-[#f7f7f5] px-3 py-2 text-sm outline-none focus:border-brand/50 focus:bg-white" />
        <input
          id={`card-back-${note.id}`}
          value={manual.back}
          onChange={(e) => setManual({ ...manual, back: e.target.value })}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && manual.front.trim() && manual.back.trim()) {
              await approve([{ ...manual, key: 'm' }], 'manual')
              setManual({ front: '', back: '' })
            }
          }}
          placeholder="Verso: resposta"
          className="rounded-xl border border-line bg-[#f7f7f5] px-3 py-2 text-sm outline-none focus:border-brand/50 focus:bg-white"
        />
        <button
          disabled={!manual.front.trim() || !manual.back.trim()}
          onClick={async () => {
            await approve([{ ...manual, key: 'm' }], 'manual')
            setManual({ front: '', back: '' })
          }}
          className="flex items-center justify-center gap-1 rounded-xl bg-[#efefed] px-3 py-2 text-xs font-bold text-ink hover:bg-[#e7e7e4] disabled:opacity-50"
        >
          <Plus size={14} /> Cartão
        </button>
      </div>
    </Card>
  )
}

function EditCard({ card, onDone }: { card: Flashcard; onDone: () => void }) {
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  return (
    <div className="space-y-1.5 rounded-xl border-2 border-brand/30 p-2.5">
      <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} className="w-full resize-none rounded-lg bg-[#f4f4f2] px-2.5 py-1.5 text-sm font-semibold outline-none" />
      <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={2} className="w-full resize-none rounded-lg bg-[#f4f4f2] px-2.5 py-1.5 text-sm outline-none" />
      <div className="flex justify-end gap-1.5">
        <button onClick={onDone} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-muted hover:bg-slate-100">
          Cancelar
        </button>
        <button
          onClick={async () => {
            await updateCard(card.id, { front: front.trim(), back: back.trim() })
            onDone()
          }}
          className="rounded-lg bg-brand px-2.5 py-1 text-xs font-bold text-white"
        >
          Salvar
        </button>
      </div>
    </div>
  )
}
