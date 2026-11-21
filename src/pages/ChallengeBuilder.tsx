import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpenCheck, CheckSquare, FileText, ListChecks, MessageSquareText, PenLine, Search, Sparkles, ToggleLeft } from 'lucide-react'
import { AREAS, useNotes, useSubjects, useTopics, useSettings } from '../db/hooks'
import type { ChallengeType, Difficulty } from '../lib/prompts'
import { tint } from '../lib/colors'
import { Capybara } from '../components/Capybara'
import { ChallengeModal } from '../components/ChallengeModal'
import { SubjectIcon } from '../components/SubjectIcon'
import { Card } from '../components/ui'
import { VoiceTextarea } from '../components/Voice'
import { FxText, Fx } from '../components/Fx'

const TYPES: { id: ChallengeType; label: string; hint: string; icon: ReactNode }[] = [
  { id: 'multipla', label: 'Múltipla escolha', hint: '4 alternativas', icon: <ListChecks size={18} /> },
  { id: 'vf', label: 'Verdadeiro ou falso', hint: 'julgue a afirmação', icon: <ToggleLeft size={18} /> },
  { id: 'aberta', label: 'Resposta aberta', hint: 'curta, corrigida pelo Claude', icon: <MessageSquareText size={18} /> },
  { id: 'explique', label: 'Explique', hint: 'com suas palavras', icon: <PenLine size={18} /> },
  { id: 'lacunas', label: 'Lacunas', hint: 'frases das suas notas', icon: <CheckSquare size={18} /> },
]
const LEVELS: { id: Difficulty; label: string; emoji: string; hint: string }[] = [
  { id: 'facil', label: 'Fácil', emoji: '🌱', hint: 'conceitos básicos' },
  { id: 'medio', label: 'Médio', emoji: '🔥', hint: 'aplicar e relacionar' },
  { id: 'dificil', label: 'Difícil', emoji: '🚀', hint: 'situações novas e pegadinhas' },
]
const COUNTS = [3, 5, 10]
const Q_COUNTS = [5, 10, 20]

const hasText = (html?: string) => !!html && html.replace(/<[^>]+>/g, '').trim().length >= 40

/** Montador de desafio: escolha matéria, tópico, quantidade, dificuldade e tipos. */
const Q_STYLES: { id: string; label: string; hint: string; icon: ReactNode; types: ChallengeType[]; vestibular?: boolean }[] = [
  { id: 'vestibular', label: 'Estilo vestibular', hint: 'enunciado com contexto e 5 alternativas', icon: <ListChecks size={18} />, types: ['multipla'], vestibular: true },
  { id: 'discursiva', label: 'Discursivas', hint: 'respostas escritas, corrigidas pelo Claude', icon: <MessageSquareText size={18} />, types: ['aberta'] },
  { id: 'vf', label: 'Verdadeiro ou falso', hint: 'rápidas para revisar', icon: <ToggleLeft size={18} />, types: ['vf'] },
  { id: 'misto', label: 'Misto', hint: 'um pouco de tudo', icon: <Sparkles size={18} />, types: ['multipla', 'vf', 'aberta', 'explique'], vestibular: true },
]
const REQUEST_HINTS = ['Com cálculos e números', 'Focadas em interpretação', 'Do jeito que cai no ENEM', 'Com exemplos do dia a dia', 'Comparando conceitos parecidos']

export function ChallengeBuilderPage({ mode = 'desafio' }: { mode?: 'desafio' | 'questoes' }) {
  const settings = useSettings()
  const isQ = mode === 'questoes'
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const subjects = useSubjects()
  const topics = useTopics()
  const notes = useNotes()
  const [subjectId, setSubjectId] = useState(params.get('materia') ?? '')
  const [topicId, setTopicId] = useState(params.get('topico') ?? '')
  const [query, setQuery] = useState('')
  const [count, setCount] = useState(isQ ? 10 : 5)
  const [qStyle, setQStyle] = useState('vestibular')
  const [base, setBase] = useState<'notas' | 'geral'>('notas')
  const [request, setRequest] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('medio')
  const [types, setTypes] = useState<ChallengeType[]>(['multipla', 'vf', 'aberta', 'explique', 'lacunas'])
  const [running, setRunning] = useState(false)

  const subject = subjects.find((s) => s.id === subjectId)
  const color = subject?.color ?? '#3e63f2'
  const subjectTopics = topics.filter((t) => t.subjectId === subjectId)
  const visibleTopics = query.trim() ? subjectTopics.filter((t) => t.name.toLowerCase().includes(query.toLowerCase())) : subjectTopics
  const topic = subjectTopics.find((t) => t.id === topicId)
  const notedTopics = useMemo(() => new Set(notes.filter((n) => n.topicId && hasText(n.content)).map((n) => n.topicId!)), [notes])
  const fromNotes = (topic ? notedTopics.has(topic.id) : false) && !(isQ && base === 'geral')
  const effectiveTypes = types.filter((t) => t !== 'lacunas' || fromNotes)

  const toggleType = (t: ChallengeType) => setTypes((prev) => (prev.includes(t) ? (prev.length > 1 ? prev.filter((x) => x !== t) : prev) : [...prev, t]))

  const capiLine = isQ && !subject
    ? 'Que questões você quer resolver hoje?'
    : !subject
    ? 'Qual matéria vamos testar hoje?'
    : !topic
      ? `Boa! ${subject.name}. Quer um tópico específico ou a matéria inteira?`
      : fromNotes
        ? `Vou usar as suas anotações de "${topic.name}". Prepare-se!`
        : `"${topic.name}" ainda não tem anotações, então vou usar conhecimento geral.`

  return (
    <>
      {!isQ && (
        <button onClick={() => navigate('/recuperacao')} className="mb-3 flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white">
          <ArrowLeft size={16} /> Recuperação
        </button>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* 1. Matéria */}
          <Card className="p-6">
            <StepTitle n={1} title="Escolha a matéria" />
            <div className="space-y-4">
              {AREAS.map((a) => {
                const list = subjects.filter((s) => s.areaId === a.id)
                if (!list.length) return null
                return (
                  <div key={a.id}>
                    <div className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">{a.name}</div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                      {list.map((s) => {
                        const on = s.id === subjectId
                        const n = topics.filter((t) => t.subjectId === s.id).length
                        return (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSubjectId(s.id)
                              setTopicId('')
                              setQuery('')
                            }}
                            className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition hover:-translate-y-0.5 ${on ? 'border-transparent' : 'border-line bg-white'}`}
                            style={on ? { background: tint(s.color, 0.12), boxShadow: `inset 0 0 0 2px ${s.color}` } : undefined}
                          >
                            <SubjectIcon subject={s} size={36} />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold">{s.name}</span>
                              <span className="text-[11px] text-muted">{n} tópicos</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* 2. Tópico */}
          {subject && (
            <Card className="page-in p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <StepTitle n={2} title="Escolha o tópico" />
                <div className="relative w-full max-w-60">
                  <Search size={14} className="absolute top-2.5 left-3 text-muted" />
                  <input id="builder-topic-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tópico…" className="w-full rounded-xl border border-line bg-[#f8f9fb] py-2 pr-3 pl-8 text-sm outline-none focus:border-brand/50" />
                </div>
              </div>
              <div className="thin-scroll flex max-h-64 flex-wrap gap-2 overflow-y-auto pr-1">
                <Pill on={!topicId} color={color} onClick={() => setTopicId('')}>
                  <Fx name="sparkle" /> Matéria inteira
                </Pill>
                {visibleTopics.map((t) => (
                  <Pill key={t.id} on={t.id === topicId} color={color} onClick={() => setTopicId(t.id)} title={notedTopics.has(t.id) ? 'Tem anotações suas' : 'Sem anotações ainda'}>
                    {notedTopics.has(t.id) && <FileText size={12} />}
                    {t.name}
                  </Pill>
                ))}
              </div>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-muted">
                <FileText size={11} /> = tópico com anotações suas (o desafio usa o que você escreveu)
              </p>
            </Card>
          )}

          {/* 3. Ajustes */}
          {subject && (
            <Card className="page-in p-6">
              <StepTitle n={3} title="Deixe do seu jeito" />
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold text-muted">Quantas questões?</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(isQ ? Q_COUNTS : COUNTS).map((c) => (
                      <button key={c} onClick={() => setCount(c)} className={`rounded-2xl border py-3 text-center transition ${count === c ? 'border-transparent text-white' : 'border-line hover:bg-slate-50'}`} style={count === c ? { background: color } : undefined}>
                        <div className="font-display text-2xl font-extrabold">{c}</div>
                        <div className={`text-[11px] ${count === c ? 'text-white/80' : 'text-muted'}`}>≈ {String(c * 1.5).replace(".", ",")} min</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold text-muted">Dificuldade</div>
                  <div className="grid grid-cols-3 gap-2">
                    {LEVELS.map((l) => (
                      <button key={l.id} onClick={() => setDifficulty(l.id)} className={`rounded-2xl border py-2.5 text-center transition ${difficulty === l.id ? 'border-transparent text-white' : 'border-line hover:bg-slate-50'}`} style={difficulty === l.id ? { background: color } : undefined}>
                        <div className="text-xl"><FxText text={l.emoji} /></div>
                        <div className="text-xs font-bold">{l.label}</div>
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">{LEVELS.find((l) => l.id === difficulty)?.hint}</p>
                </div>
              </div>
              {isQ && (
                <div className="mt-5">
                  <div className="mb-2 text-xs font-semibold text-muted">Estilo das questões</div>
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {Q_STYLES.map((q) => {
                      const on = qStyle === q.id
                      return (
                        <button
                          key={q.id}
                          onClick={() => setQStyle(q.id)}
                          className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition ${on ? 'border-transparent' : 'border-line bg-white hover:bg-slate-50'}`}
                          style={on ? { background: tint(color, 0.1), boxShadow: `inset 0 0 0 2px ${color}`, color: `color-mix(in srgb, ${color} 80%, #000)` } : undefined}
                        >
                          {q.icon}
                          <span className="text-xs font-bold">{q.label}</span>
                          <span className="text-[10px] text-muted">{q.hint}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-5 grid gap-5 md:grid-cols-[auto_1fr]">
                    <div>
                      <div className="mb-2 text-xs font-semibold text-muted">Base</div>
                      <div className="flex rounded-2xl bg-[#f1f2f5] p-1">
                        {(['notas', 'geral'] as const).map((b) => (
                          <button key={b} onClick={() => setBase(b)} className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${base === b ? 'bg-white shadow-sm' : 'text-muted'}`} style={base === b ? { color } : undefined}>
                            {b === 'notas' ? <><Fx name="page" /> Minhas anotações</> : <><Fx name="globe" /> Conhecimento geral</>}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-xs font-semibold text-muted">Pedido livre (opcional)</div>
                      <VoiceTextarea
                        id="questoes-pedido"
                        color={color}
                        value={request}
                        onValue={setRequest}
                        rows={2}
                        placeholder='Ex.: "questões de pH com contas" ou "focadas em interpretação de gráficos"'
                        className="w-full rounded-2xl border border-line bg-[#f8f9fb] px-4 py-3 text-sm outline-none focus:border-brand/50 focus:bg-white"
                      />
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {REQUEST_HINTS.map((h) => (
                          <button key={h} onClick={() => setRequest(h)} className="rounded-full bg-[#f1f2f5] px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-[#e8e9ee]">
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className={isQ ? 'hidden' : 'mt-5'}>
                <div className="mb-2 text-xs font-semibold text-muted">Tipos de questão</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {TYPES.map((t) => {
                    const on = types.includes(t.id)
                    const disabled = t.id === 'lacunas' && !fromNotes
                    return (
                      <button
                        key={t.id}
                        onClick={() => !disabled && toggleType(t.id)}
                        disabled={disabled}
                        title={disabled ? 'Precisa de anotações no tópico' : undefined}
                        className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition disabled:opacity-40 ${on && !disabled ? 'border-transparent' : 'border-line bg-white'}`}
                        style={on && !disabled ? { background: tint(color, 0.1), boxShadow: `inset 0 0 0 2px ${color}`, color: `color-mix(in srgb, ${color} 80%, #000)` } : undefined}
                      >
                        {t.icon}
                        <span className="text-xs font-bold">{t.label}</span>
                        <span className="text-[10px] text-muted">{disabled ? 'precisa de anotações' : t.hint}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Resumo com a Mendi */}
        <div className="lg:sticky lg:top-24">
          <Card className="overflow-hidden p-0">
            <div className="relative flex flex-col items-center px-6 pt-6 pb-4 text-center" style={{ background: `radial-gradient(120% 90% at 50% 0%, ${tint(color, 0.18)}, transparent 70%)` }}>
              <div key={capiLine} className="capi-pop relative mb-1 rounded-2xl border border-line bg-white px-4 py-2.5 text-sm font-semibold shadow-sm">
                {capiLine}
                <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b border-line bg-white" />
              </div>
              <Capybara pose={!subject ? 'pensando' : topic && fromNotes ? 'estudando' : 'focado'} size={130} />
            </div>
            <div className="space-y-2 px-6 pb-6">
              <Row label="Matéria" value={subject ? subject.name : '—'} />
              <Row label="Tópico" value={subject ? (topic?.name ?? 'Matéria inteira') : '—'} />
              <Row label="Questões" value={`${count} · ${LEVELS.find((l) => l.id === difficulty)?.label}`} />
              <Row label="Base" value={topic ? (fromNotes ? 'Suas anotações' : 'Conhecimento geral') : 'Conhecimento geral'} />
              {isQ && request.trim() && <Row label="Pedido" value={request.trim()} />}
              <div className="flex flex-wrap gap-1 pt-1">
                {isQ ? (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: tint(color, 0.12), color }}>
                    {Q_STYLES.find((q) => q.id === qStyle)?.label}
                  </span>
                ) : (
                  effectiveTypes.map((t) => (
                    <span key={t} className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: tint(color, 0.12), color }}>
                      {TYPES.find((x) => x.id === t)?.label}
                    </span>
                  ))
                )}
              </div>
              <button
                onClick={() => setRunning(true)}
                disabled={!subject}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-lg font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-40"
                style={{ background: color, boxShadow: `0 16px 34px -16px ${color}` }}
              >
                <Sparkles size={20} /> {isQ ? `Gerar ${count} questões` : 'Gerar desafio'}
              </button>
              <p className="flex items-center justify-center gap-1 text-[11px] text-muted">
                <BookOpenCheck size={12} /> Erros e acertos ficam no histórico
              </p>
            </div>
          </Card>
        </div>
      </div>

      {running && subject && (
        <ChallengeModal
          subjectId={subject.id}
          topicId={topic?.id}
          origin={isQ ? 'questoes' : 'demanda'}
          count={count}
          options={
            isQ
              ? { types: Q_STYLES.find((q) => q.id === qStyle)!.types, vestibular: Q_STYLES.find((q) => q.id === qStyle)!.vestibular, difficulty, base, request, exam: settings.targetExam }
              : { types: effectiveTypes, difficulty, exam: settings.targetExam }
          }
          onClose={() => setRunning(false)}
        />
      )}
    </>
  )
}

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2.5 text-lg font-bold">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-ink font-sans text-xs font-bold text-white">{n}</span>
      {title}
    </h2>
  )
}

function Pill({ on, color, onClick, title, children }: { on: boolean; color: string; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button onClick={onClick} title={title} className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${on ? 'border-transparent text-white' : 'border-line bg-white hover:bg-slate-50'}`} style={on ? { background: color } : undefined}>
      {children}
    </button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-line pb-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="truncate text-right font-semibold">{value}</span>
    </div>
  )
}
