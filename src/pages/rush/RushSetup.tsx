import { useState } from 'react'
import { Check, ChevronDown, Rocket, Save, Search } from 'lucide-react'
import { AREAS, useSettings, useSubjects, useTopics } from '../../db/hooks'
import type { RushCfg, RushSubjectCfg } from '../../lib/rush'
import { tint } from '../../lib/colors'
import { SubjectIcon } from '../../components/SubjectIcon'
import { RushCapi } from './RushCapi'
import { rush } from './store'
import { sfx, startRush, toast, ensureFill } from './actions'
import { centerOf, confetti } from '../../lib/sfx'

const GOALS = [50, 100, 200, 300, 500]

export function RushSetup() {
  const S = rush.get()
  const subjects = useSubjects()
  const topics = useTopics()
  const settings = useSettings()
  const [d, setD] = useState<RushCfg>(() => structuredClone(S.cfg))
  const [more, setMore] = useState(false)
  const [err, setErr] = useState('')
  const [openTopics, setOpenTopics] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const isOn = (id: string) => d.subjects.some((x) => x.id === id)
  const toggle = (id: string, el: HTMLElement) => {
    if (isOn(id)) setD({ ...d, subjects: d.subjects.filter((x) => x.id !== id) })
    else {
      setD({ ...d, subjects: [...d.subjects, { id, focus: '', topicIds: [] }] })
      sfx('pop')
      const s = subjects.find((x) => x.id === id)
      confetti(...centerOf(el), 16, [s?.color ?? '#3e63f2', '#ffc93c', '#ffffff'])
    }
    setErr('')
  }
  const patchSub = (id: string, patch: Partial<RushSubjectCfg>) => setD({ ...d, subjects: d.subjects.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  const names = d.subjects.map((x) => subjects.find((s) => s.id === x.id)?.name).filter(Boolean)

  const go = (el: HTMLElement) => {
    const subs = d.subjects.filter((x) => subjects.some((s) => s.id === x.id))
    if (!subs.length) {
      setErr('Escolha pelo menos uma matéria!')
      sfx('bad')
      return
    }
    const cfg = { ...d, subjects: subs.map((x) => ({ ...x, focus: x.focus.trim() })), level: d.level.trim() || (settings.targetExam ? `estilo ${settings.targetExam}` : '') }
    if (!S.started) {
      rush.update((s) => (s.cfg = cfg))
      confetti(...centerOf(el), 90)
      startRush()
    } else {
      rush.update((s) => {
        s.cfg = cfg
        s.view = 'rush'
      })
      ensureFill()
      toast('Ajustes salvos! Valem para as próximas questões.')
    }
  }

  const byArea = AREAS.map((a) => ({ a, list: subjects.filter((s) => s.areaId === a.id) })).filter((x) => x.list.length)

  return (
    <div>
      <div className="relative isolate mb-6 flex flex-wrap items-center gap-5 overflow-hidden rounded-[24px] bg-[#16181d] p-5 text-white sm:p-7">
        <span className="pointer-events-none absolute -top-24 -left-16 -z-10 h-72 w-72 rounded-full bg-[#3e63f2]/35 blur-3xl" />
        <span className="pointer-events-none absolute -right-10 -bottom-28 -z-10 h-72 w-72 rounded-full bg-[#b3122e]/30 blur-3xl" />
        <span className="pointer-events-none absolute inset-0 -z-10 opacity-[.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:28px_28px]" />
        <RushCapi mood="idle" size={104} talk={false} />
        <div className="min-w-[220px] flex-1">
          <div className="text-[11px] font-bold tracking-[.3em] text-[#9db0ff] uppercase">Modo treino</div>
          <h2 className="mt-1 font-display text-5xl leading-none font-extrabold tracking-tight sm:text-6xl">{S.started ? 'Ajustes' : 'Rush'}</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['Combo', 'Chefões', 'Missões', 'Itens', 'Revisões'].map((t) => (
              <span key={t} className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white/75">
                {t}
              </span>
            ))}
          </div>
          <p className="mt-3 max-w-2xl text-sm text-white/65">
            {S.started
              ? 'O que você mudar aqui vale para as próximas questões. As que já estão na fila continuam lá.'
              : 'Escolha as matérias e vá resolvendo sem parar. Errou? Eu explico na hora e trago a mesma ideia de volta umas questões depois, até você dominar. Cada questão conta nas suas estatísticas, no rank e no domínio do tópico.'}
          </p>
        </div>
      </div>

      {/* 1. Matérias */}
      <Step n={1} title="Quais matérias hoje?">
        {!subjects.length && <p className="text-sm text-muted">Cadastre matérias em Matérias para começar.</p>}
        <div className="space-y-4">
          {byArea.map(({ a, list }) => (
            <div key={a.id}>
              <div className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">{a.name}</div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((s) => {
                  const on = isOn(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={(e) => toggle(s.id, e.currentTarget)}
                      className={`relative flex items-center gap-2.5 rounded-2xl border-2 p-2.5 text-left transition hover:-translate-y-0.5 ${on ? 'shadow-[0_6px_14px_-8px_rgba(16,24,40,.35)]' : 'border-line bg-white'}`}
                      style={on ? { borderColor: s.color, background: tint(s.color, 0.1) } : undefined}
                    >
                      <SubjectIcon subject={s} size={36} />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{s.name}</span>
                      <span className={`absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full text-white transition ${on ? 'scale-100' : 'scale-0'}`} style={{ background: s.color }}>
                        <Check size={14} strokeWidth={3} />
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {names.length > 0 && <p className="mt-3 text-sm font-semibold text-muted">{names.length > 1 ? `As questões vão vir misturadas: ${names.join(', ')}.` : `Rush só de ${names[0]}.`}</p>}

        {/* Foco por matéria */}
        {d.subjects.length > 0 && (
          <div className="mt-4 space-y-2">
            {d.subjects.map((x) => {
              const s = subjects.find((y) => y.id === x.id)
              if (!s) return null
              const ts = topics.filter((t) => t.subjectId === s.id).sort((a, b) => a.order - b.order)
              const open = openTopics === s.id
              const shown = ts.filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()))
              return (
                <div key={s.id} className="capi-pop rounded-2xl border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex w-36 shrink-0 items-center gap-2 text-sm font-bold">
                      <SubjectIcon subject={s} size={24} /> <span className="truncate">{s.name}</span>
                    </span>
                    <input
                      value={x.focus}
                      onChange={(e) => patchSub(s.id, { focus: e.target.value })}
                      placeholder="Foco (opcional): ex. funções, geometria"
                      className="min-w-[180px] flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                    {ts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenTopics(open ? null : s.id)
                          setQ('')
                        }}
                        className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold"
                        style={{ background: tint(s.color, 0.12), color: s.color }}
                      >
                        {x.topicIds.length ? `${x.topicIds.length} tópico${x.topicIds.length > 1 ? 's' : ''}` : 'Escolher tópicos'}
                        <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                  {open && (
                    <div className="mt-3">
                      <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#f6f7f9] px-3 py-1.5">
                        <Search size={14} className="text-muted" />
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tópico…" className="flex-1 bg-transparent text-sm outline-none" />
                        {x.topicIds.length > 0 && (
                          <button onClick={() => patchSub(s.id, { topicIds: [] })} className="text-xs font-bold text-muted hover:text-ink">
                            Limpar
                          </button>
                        )}
                      </div>
                      <div className="thin-scroll flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                        {shown.map((t) => {
                          const on = x.topicIds.includes(t.id)
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => patchSub(s.id, { topicIds: on ? x.topicIds.filter((i) => i !== t.id) : [...x.topicIds, t.id] })}
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${on ? 'text-white' : 'border-line bg-white text-slate-600 hover:border-slate-300'}`}
                              style={on ? { background: s.color, borderColor: s.color } : undefined}
                            >
                              {t.name}
                            </button>
                          )
                        })}
                      </div>
                      <p className="mt-2 text-[11px] text-muted">Com tópicos escolhidos, as questões contam no domínio de cada tópico.</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Step>

      {/* 2. Meta */}
      <Step n={2} title="Quantas questões de meta?">
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <Pill key={g} on={d.goal === g} onClick={() => (setD({ ...d, goal: g }), sfx('pop'))}>
              {g}
            </Pill>
          ))}
        </div>
      </Step>

      {/* Mais opções */}
      <div className="mb-5 rounded-2xl border-2 border-dashed border-line">
        <button type="button" onClick={() => setMore(!more)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold text-muted">
          Mais opções (contas x teoria, formato, nível, correção)
          <ChevronDown size={16} className={`transition ${more ? 'rotate-180' : ''}`} />
        </button>
        {more && (
          <div className="grid gap-5 px-4 pb-4 md:grid-cols-2">
            <Field label="Contas x teoria" hint="Em matéria sem conta (História, Português…) vem só teoria.">
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={100} step={10} value={d.mix} onChange={(e) => setD({ ...d, mix: Number(e.target.value) })} className="flex-1 accent-[#3e63f2]" />
                <span className="w-36 text-xs font-bold">
                  {d.mix}% contas · {100 - d.mix}% teoria
                </span>
              </div>
            </Field>
            <Field label="Formato">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['misturado', 'Misturado'],
                    ['aberta', 'Só digitar'],
                    ['multipla', 'Só alternativas'],
                  ] as const
                ).map(([v, l]) => (
                  <Pill key={v} on={d.format === v} onClick={() => setD({ ...d, format: v })}>
                    {l}
                  </Pill>
                ))}
              </div>
            </Field>
            <Field label="Nível">
              <input value={d.level} onChange={(e) => setD({ ...d, level: e.target.value })} placeholder="Ex.: ENEM, vestibular, 1º ano do médio" className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand" />
            </Field>
            <Field label="Correção das que você digita">
              <div className="flex flex-wrap gap-2">
                <Pill on={d.grading === 'rapida'} onClick={() => setD({ ...d, grading: 'rapida' })}>
                  Rápida
                </Pill>
                <Pill on={d.grading === 'caprichada'} onClick={() => setD({ ...d, grading: 'caprichada' })}>
                  Caprichada (mais lenta)
                </Pill>
              </div>
            </Field>
            <Field label="Checagem final" hint="Quando você acerta as revisões de um erro, volta mais uma questão daquela ideia umas 18 questões depois, para ver se fixou.">
              <Pill on={d.longReview} onClick={() => setD({ ...d, longReview: !d.longReview })}>
                📌 Revisão espaçada {d.longReview ? 'ligada' : 'desligada'}
              </Pill>
            </Field>
          </div>
        )}
      </div>

      {err && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={(e) => go(e.currentTarget)} className="rk-shine-host flex items-center gap-2 rounded-2xl bg-brand px-8 py-4 font-display text-xl font-bold text-white shadow-[0_6px_0_#2a47c4] transition hover:brightness-110 active:translate-y-1 active:shadow-[0_2px_0_#2a47c4]">
          {S.started ? (
            <>
              Salvar e voltar <Save size={18} />
            </>
          ) : (
            <>
              Começar! <Rocket size={18} />
            </>
          )}
        </button>
        {S.started && (
          <button type="button" onClick={() => rush.update((s) => (s.view = 'rush'))} className="rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
        )}
      </div>

      {!S.started && (
        <div className="mt-8 border-t-2 border-dotted border-line pt-5">
          <div className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">Como a fila se mexe quando você erra</div>
          <div className="flex flex-wrap gap-1">
            {['✗', '+1', '+2', 'R1', '+4', '+5', '+6', 'R2', '+8', '+9', '+10', '+11', 'R3'].map((t, i) => (
              <span key={i} className={`capi-pop grid h-8 w-9 place-items-center rounded-xl text-[11px] font-extrabold ${t === '✗' ? 'bg-rose-500 text-white' : t[0] === 'R' ? 'bg-amber-300 text-amber-900' : 'bg-[#f1f2f5] text-muted'}`} style={{ animationDelay: `${i * 50}ms` }}>
                {t}
              </span>
            ))}
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Errou ou apertou "Não sei": aparece a resolução na hora e 3 variações da mesma ideia (outra situação, a última um pouco mais difícil) entram na fila daqui a 3, 7 e 12 questões. Errou a revisão também? Vêm mais 2. Acertou no
            chute? Tem um botão para mandar de novo. Os erros também vão para o seu Caderno de erros.
          </p>
        </div>
      )}
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 flex items-center gap-2.5 font-display text-lg font-bold">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm text-white">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold tracking-wider text-muted uppercase">{label}</div>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  )
}

export function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition ${on ? 'scale-105 border-brand bg-brand text-white shadow-[0_3px_0_#2a47c4]' : 'border-line bg-white hover:border-brand/50'}`}>
      {children}
    </button>
  )
}
