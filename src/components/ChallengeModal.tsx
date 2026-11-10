import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Copy, Loader2, Sparkles, X } from 'lucide-react'
import { db } from '../db/db'
import { AREAS } from '../db/hooks'
import { updateNote } from '../db/repo'
import type { Challenge } from '../db/types'
import { AIError, getAI } from '../lib/ai'
import { markdownToHtml } from '../lib/markdown'
import { explainPrompt, type StudyContext } from '../lib/prompts'
import { ChallengeRunner } from './ChallengeRunner'
import { SubjectIcon } from './SubjectIcon'

/** Contexto de estudo (área, matéria, tópico, nota) a partir dos ids. */
export function useStudyContext(subjectId?: string, topicId?: string) {
  return useLiveQuery(async () => {
    if (!subjectId) return undefined
    const subject = await db.subjects.get(subjectId)
    if (!subject) return undefined
    const topic = topicId ? await db.topics.get(topicId) : undefined
    const note = topic ? await db.notes.where('topicId').equals(topic.id).first() : undefined
    const ctx: StudyContext = { area: AREAS.find((a) => a.id === subject.areaId)?.name ?? '', subject: subject.name, topic: topic?.name, noteHtml: note?.content }
    return { subject, topic, note, ctx }
  }, [subjectId, topicId])
}

function Frame({ title, subtitle, icon, onClose, children }: { title: string; subtitle?: string; icon?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0b1026]/45 p-3 backdrop-blur-[3px] sm:items-center">
      <div className="capi-pop my-6 w-full max-w-2xl rounded-[28px] bg-white shadow-[0_40px_80px_-24px_rgba(11,16,38,0.55)]">
        <header className="flex items-center gap-3 border-b border-line px-6 py-4">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{title}</h2>
            {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-slate-100" aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

/** Desafio em janela: "Desafie-me", revisões e desafio livre. */
export function ChallengeModal({
  subjectId,
  topicId,
  origin,
  count = 5,
  onClose,
  onFinish,
}: {
  subjectId: string
  topicId?: string
  origin: Challenge['origin']
  count?: number
  onClose: () => void
  onFinish?: (c: Challenge) => void
}) {
  const data = useStudyContext(subjectId, topicId)
  if (!data) return null
  const color = data.subject.color
  return (
    <Frame
      title={origin === 'revisao' ? `Revisão: ${data.topic?.name ?? data.subject.name}` : `Desafio: ${data.topic?.name ?? data.subject.name}`}
      subtitle={origin === 'revisao' ? 'O resultado define a próxima revisão' : data.subject.name}
      icon={<SubjectIcon subject={data.subject} size={40} />}
      onClose={onClose}
    >
      <ChallengeRunner
        ctx={data.ctx}
        subjectId={subjectId}
        topicId={topicId}
        origin={origin}
        count={count}
        color={color}
        onCancel={onClose}
        onFinish={(c) => {
          onFinish?.(c)
          onClose()
        }}
      />
    </Frame>
  )
}

/** "Explicar este tópico": o Claude escreve uma introdução; você pode inserir na nota. */
export function ExplainModal({ subjectId, topicId, noteId, onClose, onInserted }: { subjectId: string; topicId?: string; noteId?: string; onClose: () => void; onInserted?: () => void }) {
  const data = useStudyContext(subjectId, topicId)
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'carregando' | 'pronto' | 'erro'>('carregando')
  const [error, setError] = useState('')
  const ready = !!data

  useEffect(() => {
    if (!ready) return
    const ctl = new AbortController()
    ;(async () => {
      const ai = await getAI()
      if (!ai) {
        setError('O Claude não está disponível aqui. Abra o Mendonça pelo claude.ai.')
        setStatus('erro')
        return
      }
      try {
        const full = await ai.text(explainPrompt(data!.ctx), { signal: ctl.signal, onText: setText })
        setText(full)
        setStatus('pronto')
      } catch (e) {
        if ((e as AIError).code === 'cancelled') return
        setError(e instanceof AIError ? e.message : 'Não consegui gerar a explicação.')
        setStatus('erro')
      }
    })()
    return () => ctl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  if (!data) return null
  const insert = async () => {
    const id = noteId ?? data.note?.id
    if (!id) return
    const note = await db.notes.get(id)
    const header = '<p><em>Explicação gerada pelo Claude — revise e reescreva com suas palavras.</em></p>'
    await updateNote(id, { content: `${note?.content ?? ''}${header}${markdownToHtml(text)}` })
    onInserted?.()
    onClose()
  }

  return (
    <Frame title={`Explicar: ${data.topic?.name ?? data.subject.name}`} subtitle={`${data.subject.name} · gerado pelo Claude, pode conter erros`} icon={<SubjectIcon subject={data.subject} size={40} />} onClose={onClose}>
      {status === 'carregando' && !text && (
        <p className="flex items-center gap-2 py-8 text-sm font-semibold text-muted">
          <Loader2 size={16} className="animate-spin" /> O Claude está escrevendo…
        </p>
      )}
      {status === 'erro' && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
      {text && <div className="prose-note max-h-[55vh] min-h-0 overflow-y-auto" dangerouslySetInnerHTML={{ __html: markdownToHtml(text) }} />}
      {status === 'pronto' && (
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <button
            onClick={() => navigator.clipboard?.writeText(text).catch(() => undefined)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            <Copy size={15} /> Copiar
          </button>
          {(noteId || data.note) && (
            <button onClick={insert} className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ background: data.subject.color }}>
              <Sparkles size={15} /> Inserir na nota
            </button>
          )}
        </div>
      )}
    </Frame>
  )
}
