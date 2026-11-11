import { useEffect, useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { db } from '../db/db'
import { setBlockQuestions } from '../db/repo'
import type { Subject } from '../db/types'
import { onAskBlockQuestions } from '../lib/mascotBus'
import { Capybara } from './Capybara'
import { SubjectIcon } from './SubjectIcon'

interface Pending {
  blockId: string
  label: string
  subject?: Subject
}

/** Ao concluir um bloco, a Capi pergunta se você fez questões e quantas. */
export function QuestionsPromptHost() {
  const [queue, setQueue] = useState<Pending[]>([])
  const cur = queue[0]

  useEffect(
    () =>
      onAskBlockQuestions(async (blockId) => {
        const b = await db.blocks.get(blockId)
        if (!b) return
        const [topic, subject] = await Promise.all([b.topicId ? db.topics.get(b.topicId) : undefined, b.subjectId ? db.subjects.get(b.subjectId) : undefined])
        setQueue((q) => (q.some((x) => x.blockId === blockId) ? q : [...q, { blockId, label: topic?.name ?? subject?.name ?? 'este bloco', subject }]))
      }),
    [],
  )

  const next = () => setQueue((q) => q.slice(1))
  if (!cur) return null
  return <Prompt key={cur.blockId} p={cur} onDone={next} />
}

function Stepper({ value, onChange, label, max }: { value: number; onChange: (n: number) => void; label: string; max?: number }) {
  const clamp = (n: number) => Math.max(0, Math.min(max ?? 999, Number.isFinite(n) ? Math.round(n) : 0))
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(clamp(value - 1))} className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1f2f5] text-ink hover:bg-[#e6e8ee]" aria-label={`Menos ${label}`}>
        <Minus size={18} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        onFocus={(e) => e.target.select()}
        aria-label={label}
        className="h-12 w-20 rounded-xl border border-line text-center font-display text-2xl font-extrabold outline-none focus:border-brand"
      />
      <button type="button" onClick={() => onChange(clamp(value + 1))} className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1f2f5] text-ink hover:bg-[#e6e8ee]" aria-label={`Mais ${label}`}>
        <Plus size={18} />
      </button>
    </div>
  )
}

function Prompt({ p, onDone }: { p: Pending; onDone: () => void }) {
  const [count, setCount] = useState(10)
  const [withCorrect, setWithCorrect] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [saving, setSaving] = useState(false)
  const color = p.subject?.color ?? '#3e63f2'

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onDone()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onDone])

  const save = async (n: number) => {
    setSaving(true)
    await setBlockQuestions(p.blockId, n, n > 0 && withCorrect ? correct : undefined)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0b1026]/45 p-4 backdrop-blur-[2px]" onMouseDown={onDone}>
      <div className="capi-pop relative w-full max-w-md overflow-hidden rounded-[26px] bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 pt-6 pb-4" style={{ background: `radial-gradient(120% 120% at 0% 0%, color-mix(in srgb, ${color} 18%, #fff), #fff 70%)` }}>
          <Capybara pose="pensando" size={84} />
          <div className="min-w-0">
            <div className="font-display text-xl font-extrabold">Fez questões?</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
              {p.subject && <SubjectIcon subject={p.subject} size={20} />}
              <span className="truncate">{p.label}</span>
            </div>
          </div>
          <button onClick={onDone} className="absolute top-3 right-3 rounded-full p-1.5 text-muted hover:bg-slate-100" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 pb-6">
          <div>
            <div className="mb-2 text-sm font-bold">Quantas você fez?</div>
            <Stepper value={count} onChange={(n) => (setCount(n), setCorrect((c) => Math.min(c, n)))} label="questões feitas" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[5, 10, 15, 20, 30, 50].map((n) => (
                <button key={n} onClick={() => (setCount(n), setCorrect((c) => Math.min(c, n)))} className={`rounded-full px-3 py-1 text-xs font-bold transition ${count === n ? 'text-white' : 'bg-[#f1f2f5] text-slate-600 hover:bg-[#e6e8ee]'}`} style={count === n ? { background: color } : undefined}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-line p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={withCorrect} onChange={(e) => setWithCorrect(e.target.checked)} className="h-4 w-4 accent-[#3e63f2]" />
              Quero informar os acertos
            </label>
            {withCorrect && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Stepper value={correct} onChange={setCorrect} label="acertos" max={count} />
                <span className="text-sm font-bold text-muted">{count ? `${Math.round((correct / count) * 100)}% de acerto` : ''}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-between gap-2">
            <button disabled={saving} onClick={() => save(0)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Não fiz questões
            </button>
            <button disabled={saving || count === 0} onClick={() => save(count)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40" style={{ background: color }}>
              Salvar {count} {count === 1 ? 'questão' : 'questões'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
