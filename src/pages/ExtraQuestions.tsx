import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { AREAS, useSubjects, useTopics } from '../db/hooks'
import { addExtraQuestions, deleteExtraQuestions } from '../db/practice'
import { addDays, toISODate } from '../lib/dates'
import { Capybara } from '../components/Capybara'
import { SubjectIcon } from '../components/SubjectIcon'
import { Card } from '../components/ui'
import { askConfirm } from '../components/confirm'
import { showMascot } from '../lib/mascotBus'

const QUICK = [5, 10, 15, 20, 30, 50]

function Stepper({ value, onChange, label, max }: { value: number; onChange: (n: number) => void; label: string; max?: number }) {
  const clamp = (n: number) => Math.max(0, Math.min(max ?? 999, Number.isFinite(n) ? Math.round(n) : 0))
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(clamp(value - 1))} className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1f2f5] hover:bg-[#e6e8ee]" aria-label={`Menos ${label}`}>
        <Minus size={18} />
      </button>
      <input type="number" inputMode="numeric" min={0} value={value} onChange={(e) => onChange(clamp(Number(e.target.value)))} onFocus={(e) => e.target.select()} aria-label={label} className="h-12 w-20 rounded-xl border border-line text-center font-display text-2xl font-extrabold outline-none focus:border-brand" />
      <button type="button" onClick={() => onChange(clamp(value + 1))} className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1f2f5] hover:bg-[#e6e8ee]" aria-label={`Mais ${label}`}>
        <Plus size={18} />
      </button>
    </div>
  )
}

/** Registrar questões feitas fora do site (livro, lista, simulado…). */
export function ExtraQuestions() {
  const subjects = useSubjects()
  const topics = useTopics()
  const today = toISODate(new Date())
  const [subjectId, setSubjectId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [count, setCount] = useState(10)
  const [withCorrect, setWithCorrect] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const recent = useLiveQuery(() => db.practice.where('source').equals('extra').reverse().sortBy('date'), [], [])
  const subject = subjects.find((s) => s.id === subjectId)
  const subjectTopics = topics.filter((t) => t.subjectId === subjectId).sort((a, b) => a.order - b.order)

  const save = async () => {
    if (!count) return
    setSaving(true)
    await addExtraQuestions({ date, subjectId: subjectId || undefined, topicId: topicId || undefined, done: count, correct: withCorrect ? correct : undefined, note: note.trim() || undefined })
    setSaving(false)
    setNote('')
    showMascot({
      pose: 'comemorando',
      title: `${count} ${count === 1 ? 'questão registrada' : 'questões registradas'}! 📝`,
      text: `${withCorrect && count ? `${Math.round((correct / count) * 100)}% de acerto. ` : ''}Já entrou no seu total de questões${subject ? ` de ${subject.name}` : ''} e no rank.`,
      autoHideMs: 6000,
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <Capybara pose="estudando" size={76} />
            <div>
              <h2 className="font-display text-2xl font-extrabold">Registrar questões extras</h2>
              <p className="text-sm text-muted">Fez questões no livro, numa lista ou num simulado? Conta aqui para entrar nas suas estatísticas, no rank e no domínio.</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <div className="mb-2 text-sm font-bold">Quantas você fez?</div>
              <Stepper value={count} onChange={(n) => (setCount(n), setCorrect((c) => Math.min(c, n)))} label="questões feitas" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK.map((n) => (
                  <button key={n} type="button" onClick={() => (setCount(n), setCorrect((c) => Math.min(c, n)))} className={`rounded-full px-3 py-1 text-xs font-bold transition ${count === n ? 'bg-brand text-white' : 'bg-[#f1f2f5] text-slate-600 hover:bg-[#e6e8ee]'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold">Matéria (opcional)</span>
                <select
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value)
                    setTopicId('')
                  }}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
                >
                  <option value="">Várias / geral</option>
                  {AREAS.map((a) => (
                    <optgroup key={a.id} label={a.name}>
                      {subjects
                        .filter((s) => s.areaId === a.id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold">Tópico (opcional)</span>
                <select value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!subjectTopics.length} className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand disabled:opacity-50">
                  <option value="">{subjectId ? 'Vários / geral' : 'Escolha a matéria'}</option>
                  {subjectTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-line p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={withCorrect} onChange={(e) => setWithCorrect(e.target.checked)} className="h-4 w-4 accent-[#3e63f2]" />
                Quero informar os acertos
              </label>
              <p className="mt-1 pl-6 text-[11px] text-muted">Com os acertos e um tópico, as questões também contam no domínio do tópico.</p>
              {withCorrect && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Stepper value={correct} onChange={setCorrect} label="acertos" max={count} />
                  <span className="text-sm font-bold text-muted">{count ? `${Math.round((correct / count) * 100)}% de acerto` : ''}</span>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold">Quando</span>
                <div className="flex gap-1.5">
                  {[
                    [today, 'Hoje'],
                    [addDays(today, -1), 'Ontem'],
                  ].map(([d, l]) => (
                    <button key={d} type="button" onClick={() => setDate(d)} className={`rounded-xl px-3 py-2 text-xs font-bold ${date === d ? 'bg-brand text-white' : 'bg-[#f1f2f5]'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold">De onde? (opcional)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: lista do professor, livro cap. 3, simulado ENEM" className="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-brand" />
              </label>
            </div>

            <button type="button" disabled={saving || !count} onClick={save} className="w-full rounded-2xl bg-brand py-3.5 font-display text-lg font-bold text-white shadow-[0_6px_0_#2a47c4] transition hover:brightness-110 active:translate-y-1 disabled:opacity-40 sm:w-auto sm:px-8">
              Registrar {count} {count === 1 ? 'questão' : 'questões'}
            </button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Registros recentes</h3>
          {!recent.length ? (
            <div className="flex flex-col items-center py-6 text-center text-sm text-muted">
              <Capybara pose="pensando" size={90} />
              Seus registros aparecem aqui.
            </div>
          ) : (
            <div className="thin-scroll max-h-[520px] divide-y divide-line overflow-y-auto pr-1">
              {[...recent]
                .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
                .slice(0, 50)
                .map((p) => {
                  const s = subjects.find((x) => x.id === p.subjectId)
                  const t = topics.find((x) => x.id === p.topicId)
                  return (
                    <div key={p.id} className="flex items-center gap-3 py-2.5">
                      <SubjectIcon subject={s} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">
                          {p.done} questões{p.correct !== undefined ? ` · ${Math.round((p.correct / p.done) * 100)}%` : ''}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {s?.name ?? 'Geral'}
                          {t ? ` · ${t.name}` : ''} · {p.date.split('-').reverse().slice(0, 2).join('/')}
                          {p.note ? ` · ${p.note}` : ''}
                        </div>
                      </div>
                      <button
                        onClick={async () => (await askConfirm(`Apagar o registro de ${p.done} questões?`)) && deleteExtraQuestions(p.id)}
                        className="rounded-lg p-1.5 text-muted hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Apagar registro"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )
                })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
