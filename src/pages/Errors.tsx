import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Eye, Trash2, X } from 'lucide-react'
import { db } from '../db/db'
import { useSubjectMap } from '../db/hooks'
import { deleteErrorEntry, reviewErrorEntry, setErrorReason } from '../db/repo'
import type { ErrorEntry, ErrorReason } from '../db/types'
import { CATEGORY_LABEL, REASON_LABEL } from '../lib/errors'
import { toISODate } from '../lib/dates'
import { Capybara } from '../components/Capybara'
import { SubjectIcon } from '../components/SubjectIcon'
import { Card, Tabs } from '../components/ui'

const SOURCE_LABEL = { desafio: 'Desafio', questoes: 'Questões', flashcard: 'Flashcard', escrita: 'Escrita', rush: 'Rush', simulado: 'Simulado' }

/** Caderno de erros (seção da Recuperação): revise cada erro até acertar 2 vezes seguidas. */
export function ErrorsSection() {
  const today = toISODate(new Date())
  const all = useLiveQuery(() => db.errors.orderBy('createdAt').reverse().toArray(), [], [])
  const subjects = useSubjectMap()
  const [tab, setTab] = useState<'revisar' | 'todos'>('revisar')
  const [i, setI] = useState(0)
  const due = useMemo(() => all.filter((e) => !e.resolved && e.due <= today), [all, today])
  const open = all.filter((e) => !e.resolved)
  const byReason = useMemo(() => {
    const m = new Map<ErrorReason, number>()
    for (const e of all) if (e.reason) m.set(e.reason, (m.get(e.reason) ?? 0) + 1)
    return m
  }, [all])

  return (
    <>
      <p className="mb-4 text-sm text-muted">Cada erro volta até você acertar 2 vezes seguidas.</p>
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <Stat label="Para revisar hoje" value={due.length} color="#b23a2a" />
        <Stat label="Em aberto" value={open.length} color="#a8742a" />
        <Stat label="Resolvidos" value={all.length - open.length} color="#4d7a57" />
        <Card className="p-4">
          <div className="text-xs font-semibold text-muted">Por que errou?</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {(Object.keys(REASON_LABEL) as ErrorReason[]).map((r) => (
              <span key={r}>
                {REASON_LABEL[r].label} <b className="font-mono">{byReason.get(r) ?? 0}</b>
              </span>
            ))}
          </div>
        </Card>
      </div>
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={(v) => {
            setTab(v)
            setI(0)
          }}
          items={[
            { id: 'revisar', label: `Revisar (${due.length})` },
            { id: 'todos', label: `Todos (${all.length})` },
          ]}
        />
      </div>

      {tab === 'revisar' ? (
        due.length === 0 ? (
          <Card className="flex flex-col items-center p-10 text-center">
            <Capybara pose={all.length ? 'relaxando' : 'pensando'} size={130} />
            <p className="mt-2 text-sm font-semibold">{all.length ? 'Nenhum erro para revisar hoje.' : 'Ainda não há erros. Eles chegam dos desafios, questões, flashcards difíceis e treinos de escrita.'}</p>
          </Card>
        ) : (
          <ReviewCard key={due[Math.min(i, due.length - 1)].id} e={due[Math.min(i, due.length - 1)]} subjects={subjects} position={`${Math.min(i, due.length - 1) + 1} de ${due.length}`} onNext={() => setI((x) => x)} />
        )
      ) : (
        <Card className="p-2">
          {all.length === 0 && <p className="p-4 text-sm text-muted">Nada por aqui ainda.</p>}
          <div className="divide-y divide-line">
            {all.map((e) => {
              const s = e.subjectId ? subjects.get(e.subjectId) : undefined
              return (
                <div key={e.id} className="group flex items-center gap-3 px-3 py-2.5">
                  {s ? <SubjectIcon subject={s} size={32} /> : <span className="grid h-8 w-8 place-items-center rounded-md border border-line font-mono text-[10px] text-muted">TXT</span>}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{e.question}</div>
                    <div className="text-[11px] text-muted">
                      {SOURCE_LABEL[e.source]}
                      {e.category ? ` · ${CATEGORY_LABEL[e.category]}` : ''}
                      {e.reason ? ` · ${REASON_LABEL[e.reason].label}` : ''} · {e.resolved ? 'resolvido ✓' : `próxima: ${e.due.split('-').reverse().slice(0, 2).join('/')}`}
                    </div>
                  </div>
                  <button onClick={() => deleteErrorEntry(e.id)} className="rounded-lg p-1.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-600" title="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="font-display text-3xl font-extrabold" style={{ color }}>
        {value}
      </div>
    </Card>
  )
}

export function ReviewCard({ e, subjects, position, onNext }: { e: ErrorEntry; subjects: ReturnType<typeof useSubjectMap>; position: string; onNext: () => void }) {
  const [shown, setShown] = useState(false)
  const s = e.subjectId ? subjects.get(e.subjectId) : undefined
  const color = s?.color ?? '#2f5f7e'
  const answer = async (ok: boolean) => {
    await reviewErrorEntry(e.id, ok)
    onNext()
  }
  return (
    <div className="page-in mx-auto max-w-2xl">
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="flex items-center justify-between gap-2 px-6 py-3 text-xs font-semibold" style={{ background: `${color}14`, color }}>
          <span className="flex items-center gap-2">
            {s && <SubjectIcon subject={s} size={22} />} {s?.name ?? 'Treino de escrita'} · {SOURCE_LABEL[e.source]}
            {e.category ? ` · ${CATEGORY_LABEL[e.category]}` : ''}
          </span>
          <span className="text-muted">
            {position} · acertos seguidos: {e.streak}/2
          </span>
        </div>
        <div className="px-7 py-8">
          <p className="text-center font-display text-xl leading-snug font-bold">{e.question}</p>
          {!shown ? (
            <button onClick={() => setShown(true)} className="mx-auto mt-6 flex items-center gap-2 rounded-2xl bg-ink px-6 py-3 font-bold text-white hover:bg-black">
              <Eye size={18} /> Pensei na resposta, mostrar
            </button>
          ) : (
            <div className="capi-pop mt-6 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl bg-rose-50 p-3.5 text-sm">
                  <div className="text-[11px] font-bold text-rose-600 uppercase">Você tinha respondido</div>
                  <div className="font-semibold">{e.yourAnswer || '—'}</div>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3.5 text-sm">
                  <div className="text-[11px] font-bold text-emerald-700 uppercase">Certo</div>
                  <div className="font-semibold">{e.correctAnswer}</div>
                </div>
              </div>
              {e.explanation && <p className="text-sm text-slate-600">{e.explanation}</p>}
              {!e.reason && (
                <div>
                  <div className="mb-1.5 text-xs font-semibold text-muted">Por que você errou da primeira vez?</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(REASON_LABEL) as ErrorReason[]).map((r) => (
                      <button key={r} onClick={() => setErrorReason(e.id, r)} className="rounded-md bg-[#efefed] px-3 py-1.5 text-xs font-semibold hover:bg-[#e7e7e4]">
                        {REASON_LABEL[r].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={() => answer(false)} className="flex items-center justify-center gap-2 rounded-2xl bg-rose-50 py-3 font-bold text-rose-700 hover:bg-rose-100">
                  <X size={18} /> Errei de novo
                </button>
                <button onClick={() => answer(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 py-3 font-bold text-emerald-700 hover:bg-emerald-100">
                  <Check size={18} /> Acertei agora
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
