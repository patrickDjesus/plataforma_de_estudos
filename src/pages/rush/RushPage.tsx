import { useEffect, useState } from 'react'
import { BarChart3, CheckCircle2, ListOrdered, NotebookPen, Pause, Pencil, Play, RotateCcw, SlidersHorizontal, Star, Target, Thermometer, TrendingUp, Volume2, VolumeX } from 'lucide-react'
import { useSubjectMap, useTopics } from '../../db/hooks'
import { famStatus, fmtLong, ITEMS, type ItemId, type RushState } from '../../lib/rush'
import { tint } from '../../lib/colors'
import { SubjectIcon } from '../../components/SubjectIcon'
import { Spinner } from '../../components/Voice'
import { confetti } from '../../lib/sfx'
import { RushCapi } from './RushCapi'
import { RushSetup } from './RushSetup'
import { RushQuestion } from './RushQuestion'
import { RushReport } from './RushReport'
import { Arena, arenaHeat, Banner, BossIntro, ComboMeter, FxLayer, useCountUp } from './RushFx'
import { generatingFor, rush, runtime, useRuntime, useRush } from './store'
import { checkAI, ensureFill, errCopy, fill, goNext, onMega, onToast, restartRush, setLookups, sfx, togglePause, toast, type Toast } from './actions'
import { FxText, Fx } from '../../components/Fx'

export function RushPage() {
  const S = useRush()
  const R = useRuntime()
  const subjects = useSubjectMap()
  const topics = useTopics()

  // nomes para os prompts
  useEffect(() => {
    const tmap = new Map(topics.map((t) => [t.id, t.name]))
    setLookups({ subject: (id) => subjects.get(id)?.name ?? 'Matéria', topic: (id) => tmap.get(id) })
  }, [subjects, topics])

  // ao abrir: confere a IA e retoma a fila
  useEffect(() => {
    checkAI()
    const s = rush.get()
    if (s.started && !s.current && s.queue.length) goNext(true)
    else ensureFill()
  }, [])

  const showSide = S.started && S.view === 'rush'
  const onFire = S.started && S.view === 'rush' && S.stats.streak >= 5
  return (
    <Arena heat={arenaHeat(S)} boss={!!(S.view === 'rush' && S.current?.boss)} onFire={onFire}>
      <Toasts />
      <Mega />
      <FxLayer />
      <BossIntro S={S} />
      <EndScreen S={S} />
      {S.started && <TopBar S={S} />}
      <div className={`grid items-start gap-5 ${showSide ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
        <div className="min-w-0">
          {!S.started || S.view === 'setup' ? (
            <div className="rush-enter">
              <RushSetup />
            </div>
          ) : S.view === 'report' ? (
            <div className="rush-enter rounded-[26px] border border-line bg-white p-5 sm:p-7">
              <RushReport S={S} />
            </div>
          ) : S.current ? (
            <div className="pt-12">
              <RushQuestion S={S} />
            </div>
          ) : (
            <Loading S={S} fillError={R.fillError} aiFatal={R.aiFatal} inFlight={R.freshInFlight} />
          )}
        </div>
        {showSide && <Side S={S} />}
      </div>
    </Arena>
  )
}

function Bubble({ icon, children, title, hot }: { icon: React.ReactNode; children: React.ReactNode; title: string; hot?: boolean }) {
  return (
    <span title={title} className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-display text-sm font-bold tabular-nums ${hot ? 'bg-orange-100 text-orange-700' : 'bg-[#f1f2f5]'}`}>
      {icon}
      {children}
    </span>
  )
}

function TopBar({ S }: { S: RushState }) {
  const st = S.stats
  const acc = st.done ? Math.round((100 * st.correct) / st.done) + '%' : '–'
  const [armed, setArmed] = useState(false)
  const canItems = S.view === 'rush' && S.current && S.phase === 'answer' && !S.paused
  return (
    <div className="mb-5 overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_8px_24px_-12px_rgba(16,24,40,0.08)]">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="flex gap-1 rounded-full bg-[#f1f2f5] p-1">
          {(
            [
              ['rush', 'Rush', <Target key="t" size={15} />],
              ['report', 'Relatório', <TrendingUp key="r" size={15} />],
            ] as const
          ).map(([v, l, ic]) => (
            <button key={v} onClick={() => rush.update((d) => (d.view = v))} className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold transition ${S.view === v ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-ink'}`}>
              {ic} {l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 lg:ml-auto">
          <Bubble icon={<Pencil size={14} className="text-brand" />} title="Questões feitas / meta">
            {st.done}
            <small className="font-sans text-[11px] text-muted">/{S.cfg.goal}</small>
          </Bubble>
          <Bubble icon={<CheckCircle2 size={14} className="text-brand" />} title="Acerto">
            {acc}
          </Bubble>
          <ComboMeter streak={st.streak} best={st.best} />
          <Score value={S.score} />
          <Bubble icon={<Thermometer size={14} className="text-rose-500" />} title="Dificuldade atual das questões novas (0 a 10)">
            {S.level.toFixed(1)}
          </Bubble>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn title={S.sound ? 'Desligar som' : 'Ligar som'} onClick={() => (rush.update((d) => ((d.sound = !d.sound), (d.soundChosen = true))), rush.get().sound && sfx('pop'))}>
            {S.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </IconBtn>
          {S.view === 'rush' && S.current && S.phase === 'answer' && (
            <IconBtn title={S.paused ? 'Continuar' : 'Pausar'} onClick={togglePause}>
              {S.paused ? <Play size={16} /> : <Pause size={16} />}
            </IconBtn>
          )}
          <IconBtn title="Ajustes do Rush" onClick={() => rush.update((d) => (d.view = 'setup'))}>
            <SlidersHorizontal size={16} />
          </IconBtn>
          <button
            title="Começa um Rush novo. Suas estatísticas no Mendonça continuam."
            onClick={() => {
              if (!armed) {
                setArmed(true)
                window.setTimeout(() => setArmed(false), 3500)
                return
              }
              restartRush()
              setArmed(false)
            }}
            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition ${armed ? 'bg-rose-500 text-white' : 'border border-line bg-white hover:bg-slate-50'}`}
          >
            <RotateCcw size={13} /> {armed ? 'Zerar o Rush atual? Clique de novo' : 'Novo Rush'}
          </button>
        </div>
      </div>
      {/* itens */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2">
        <span className="text-[11px] font-bold tracking-wider text-muted uppercase">Itens</span>
        {(Object.keys(ITEMS) as ItemId[]).map((id) => (
          <span
            key={id}
            title={ITEMS[id].desc}
            className={`flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-0.5 text-xs font-extrabold ${S.items[id] ? 'border-line bg-white' : 'border-line bg-white opacity-40'} ${canItems && S.items[id] ? '' : ''}`}
          >
            <Fx name={id === 'fifty' ? 'target' : id === 'shield' ? 'shield' : 'skip'} /> {ITEMS[id].name}
            <span className="rounded-full bg-[#f1f2f5] px-1.5">×{S.items[id]}</span>
          </span>
        ))}
        <span className="text-[11px] text-muted">50/50 e Pular aparecem na questão; o escudo é automático.</span>
      </div>
      {/* progresso até a meta */}
      <div className="h-3 bg-[#eef0f4]">
        <i className="rush-stripes block h-full rounded-r-full transition-[width] duration-700" style={{ width: `${Math.min(100, (100 * st.done) / Math.max(1, S.cfg.goal))}%` }} />
      </div>
    </div>
  )
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-xl border border-line bg-white text-slate-600 hover:bg-slate-50">
      {children}
    </button>
  )
}

const TIPS = ['Acordando as mitocôndrias…', 'Balanceando as equações…', 'Calibrando o acelerador de partículas…', 'Replicando o DNA das questões…', 'Fazendo fotossíntese de ideias…', 'Contando os átomos de carbono…', 'Medindo a gravidade…', 'Separando as fases da mitose…']

function Loading({ S, fillError, aiFatal, inFlight }: { S: RushState; fillError: string | null; aiFatal: string | null; inFlight: number }) {
  const [tip, setTip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])
  useEffect(() => {
    const i = window.setInterval(() => setTip(TIPS[Math.floor(Math.random() * TIPS.length)]), 3000)
    return () => window.clearInterval(i)
  }, [])
  const box = (children: React.ReactNode) => <div className="rush-enter flex flex-col items-center gap-3 rounded-[26px] border border-line bg-white px-6 py-12 text-center">{children}</div>
  if (aiFatal)
    return box(
      <>
        <RushCapi mood="sad" size={120} talk={false} />
        <h3 className="font-display text-2xl font-bold">A IA não está disponível aqui</h3>
        <p className="max-w-md text-muted">{errCopy(aiFatal)}</p>
      </>,
    )
  if (fillError && !inFlight)
    return box(
      <>
        <RushCapi mood="sad" size={120} talk={false} />
        <h3 className="font-display text-2xl font-bold">Ops, não consegui gerar as questões</h3>
        <p className="max-w-md text-muted">{errCopy(fillError)}</p>
        <button
          onClick={() => {
            runtime.update({ fillError: null })
            fill(5)
          }}
          className="flex items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 font-bold text-white"
        >
          Tentar de novo <RotateCcw size={16} />
        </button>
      </>,
    )
  return box(
    <>
      <RushCapi mood="think" size={130} talk={false} />
      <h3 className="font-display text-2xl font-bold">{S.stats.done ? 'Buscando mais questões…' : 'Preparando suas questões…'}</h3>
      <Spinner size={26} />
      <p key={tip} className="capi-pop font-bold text-muted">
        {tip}
      </p>
      <p className="text-xs text-muted">A primeira leva demora uns 20 a 60 segundos. Depois a fila se enche sozinha enquanto você resolve.</p>
    </>,
  )
}

function Panel({ icon, title, extra, children }: { icon: React.ReactNode; title: string; extra?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-line bg-white p-4 shadow-[0_8px_24px_-14px_rgba(16,24,40,0.1)]">
      <h3 className="mb-3 flex items-center gap-2 font-sans text-sm font-semibold">
        <span className="text-brand">{icon}</span> {title}
        {extra && <em className="ml-auto text-xs font-bold text-muted not-italic">{extra}</em>}
      </h3>
      {children}
    </div>
  )
}

function Side({ S }: { S: RushState }) {
  const R = useRuntime()
  const subjects = useSubjectMap()
  const fams = Object.entries(S.families).sort((a, b) => b[1].ts - a[1].ts)
  const recovered = fams.filter(([id, f]) => famStatus(S, id, f, generatingFor(id)).tone === 'ok').length
  const subs = [...new Set([...S.cfg.subjects.map((x) => x.id), ...Object.keys(S.bySubj)])].filter((id) => subjects.has(id))
  return (
    <aside className="grid min-w-0 gap-4">
      {R.aiFatal && <p className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{errCopy(R.aiFatal)}</p>}
      <Panel icon={<Target size={16} />} title="Missões" extra={`${S.missionsDone} feitas`}>
        <div className="divide-y-2 divide-dashed divide-line">
          {S.missions.map((m, i) => (
            <div key={m.id + i} className={`grid gap-1 py-2 first:pt-0 last:pb-0 ${m.done ? 'opacity-60' : ''}`}>
              <div className="flex justify-between gap-2 text-sm font-bold">
                <span>{m.text}</span>
                <span className="font-display whitespace-nowrap text-muted">
                  {m.p}/{m.n}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#eef0f4]">
                <i className="relative block h-full overflow-hidden rounded-full bg-[#3e63f2] transition-all duration-700" style={{ width: `${Math.round((100 * m.p) / m.n)}%` }}>
                  <span className="rk-shimmer absolute inset-0" />
                </i>
              </div>
              <div className="text-[11px] font-bold text-muted">
                +{m.xp} pts{m.item ? ` · ${ITEMS[m.item].name}` : ''}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel icon={<ListOrdered size={16} />} title="Próximas" extra={`${S.queue.length} prontas`}>
        {R.tasks.length > 0 && (
          <div className="mb-2 grid gap-1.5">
            {R.tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs font-bold text-muted">
                <Spinner size={14} /> {t.label}
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-1.5">
          {S.queue.slice(0, 12).map((q, i) => {
            const sub = subjects.get(q.materia)
            const rev = q.kind === 'revisao'
            return (
              <div key={q.id} className="rush-slide grid grid-cols-[26px_26px_1fr] items-center gap-2 text-[13px] font-bold" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
                <span className="text-right text-[11px] text-muted">+{i + 1}</span>
                <SubjectIcon subject={sub} size={24} />
                <span className="truncate" title={rev ? q.conceito : q.topico || sub?.name}>
                  <b className={`mr-1 rounded-full px-1.5 py-px text-[10px] ${q.boss ? 'bg-[#3a0a12] text-rose-200' : rev ? 'bg-amber-100 text-amber-800' : 'bg-brand-soft text-brand'}`}>{q.boss ? 'chefão' : rev ? `rev ${q.revIdx}/${q.revOf}` : 'nova'}</b>
                  {rev ? q.conceito : q.topico || sub?.name}
                </span>
              </div>
            )
          })}
          {S.queue.length > 12 && <p className="text-xs text-muted">+ {S.queue.length - 12} depois dessas</p>}
          {!S.queue.length && !R.tasks.length && <p className="text-xs text-muted">Fila vazia. As questões vêm de 5 em 5: quando você chega na 4ª, a próxima leva já começa a ser gerada.</p>}
        </div>
      </Panel>
      <Panel icon={<BarChart3 size={16} />} title="Por matéria">
        <div className="grid gap-2.5">
          {subs.map((id) => {
            const s = subjects.get(id)!
            const b = S.bySubj[id] ?? { done: 0, correct: 0 }
            const pct = b.done ? Math.round((100 * b.correct) / b.done) : 0
            return (
              <div key={id}>
                <div className="mb-1 flex justify-between gap-2 text-[13px] font-bold">
                  <span className="truncate">{s.name}</span>
                  <span className="shrink-0 text-muted">{b.done ? `${pct}% · ${b.correct}/${b.done}` : 'ainda nada'}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full" style={{ background: tint(s.color, 0.12) }}>
                  <i className="block h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: s.color }} />
                </div>
              </div>
            )
          })}
        </div>
      </Panel>
      <Panel icon={<NotebookPen size={16} />} title="Erros do Rush" extra={fams.length ? `${recovered}/${fams.length} recuperados` : ''}>
        {!fams.length ? (
          <p className="text-xs text-muted">O que você errar ou marcar como dúvida aparece aqui até acertar as revisões. Também vai para o seu Caderno de erros.</p>
        ) : (
          <div className="thin-scroll grid max-h-80 gap-2.5 overflow-y-auto pr-1">
            {fams.slice(0, 40).map(([id, f]) => {
              const st = famStatus(S, id, f, generatingFor(id))
              return (
                <div key={id} className="grid grid-cols-[1fr_auto] gap-x-2 text-[13px]">
                  <span className="font-bold break-words">{f.conceito}</span>
                  <span className={`row-span-2 self-center rounded-full px-2 py-0.5 text-[11px] font-extrabold ${st.tone === 'bad' ? 'bg-rose-100 text-rose-700' : st.tone === 'rev' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{st.label}</span>
                  <span className="text-[11px] text-muted">
                    {f.erros} erro{f.erros === 1 ? '' : 's'}, {f.acertos} acerto{f.acertos === 1 ? '' : 's'} na revisão
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </aside>
  )
}

function Toasts() {
  const [list, setList] = useState<(Toast & { out?: boolean })[]>([])
  useEffect(
    () =>
      onToast((t) => {
        setList((l) => [...l.slice(-3), t])
        window.setTimeout(() => setList((l) => l.map((x) => (x.id === t.id ? { ...x, out: true } : x))), 3600)
        window.setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 4000)
      }),
    [],
  )
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[70] grid w-max max-w-[calc(100vw-32px)] -translate-x-1/2 justify-items-center gap-2" aria-live="polite">
      {list.map((t) => (
        <div
          key={t.id}
          className={`${t.out ? 'rush-toast-out' : 'rush-toast'} rounded-2xl px-5 py-2.5 text-center font-display text-[15px] font-bold text-white shadow-[0_6px_0_rgba(16,24,40,.2)] ${t.tone === 'gold' ? 'border-l-4 border-amber-400 bg-[#16181d]' : t.tone === 'item' ? 'border-l-4 border-sky-400 bg-[#16181d]' : 'bg-[#16181d]'}`}
        >
          <FxText text={t.text} />
        </div>
      ))}
    </div>
  )
}

function Mega() {
  const [m, setM] = useState<{ text: string; k: number } | null>(null)
  useEffect(
    () =>
      onMega((text) => {
        const k = Date.now()
        setM({ text, k })
        window.setTimeout(() => setM((x) => (x?.k === k ? null : x)), 1900)
      }),
    [],
  )
  if (!m) return null
  return <Banner text={m.text} k={m.k} />
}

function EndScreen({ S }: { S: RushState }) {
  const [closedAt, setClosedAt] = useState<number | null>(null)
  const show = S.goalHit && S.stats.done >= S.cfg.goal && closedAt !== S.cfg.goal && S.phase === 'feedback' && S.stats.done === S.cfg.goal
  useEffect(() => {
    if (show) {
      const t = window.setTimeout(() => confetti(innerWidth / 2, innerHeight / 3, 200), 2600)
      return () => window.clearTimeout(t)
    }
  }, [show])
  if (!show) return null
  const st = S.stats
  const acc = st.done ? Math.round((100 * st.correct) / st.done) : 0
  const close = () => setClosedAt(S.cfg.goal)
  return (
    <div className="rush-delay-in fixed inset-0 z-[72] grid place-items-center overflow-y-auto bg-[#16181d]/55 p-4 backdrop-blur-sm">
      <div className="capi-pop w-full max-w-xl rounded-[28px] border-4 border-amber-300 bg-white p-6 text-center shadow-[0_10px_0_#e8a800]">
        <div className="flex justify-center">
          <RushCapi mood="happy" size={120} talk={false} />
        </div>
        <h2 className="font-display text-4xl font-extrabold">RUSH COMPLETO! <Fx name="trophy" /></h2>
        <p className="mt-1 text-muted">
          {st.done} questões, {acc}% de acerto. A Mendi está orgulhosa.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {(
            [
              ['Pontos', S.score.toLocaleString('pt-BR')],
              ['Melhor combo', st.best],
              ['Chefões', S.bosses],
              ['Tempo', fmtLong(st.ms)],
              ['Missões', S.missionsDone],
              ['Dificuldade', S.level.toFixed(1)],
            ] as const
          ).map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-[#f6f7f9] px-2 py-2.5">
              <b className="block font-display text-xl">{v}</b>
              <span className="text-[10px] font-bold tracking-wider text-muted uppercase">{l}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button onClick={() => (close(), rush.update((d) => (d.view = 'report')))} className="flex items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 font-bold text-white">
            <TrendingUp size={16} /> Ver relatório
          </button>
          <button onClick={close} className="rounded-2xl bg-amber-300 px-5 py-2.5 font-bold text-amber-950 shadow-[0_4px_0_#e8a800]">
            Continuar jogando
          </button>
          <button
            onClick={() => {
              close()
              restartRush()
              toast('Rush novo! Ajuste as matérias e bora.')
            }}
            className="rounded-2xl border-2 border-line px-5 py-2.5 font-bold"
          >
            Novo Rush
          </button>
        </div>
      </div>
    </div>
  )
}

/** Placar de pontos que conta subindo (e recebe os "+pts" voando). */
function Score({ value }: { value: number }) {
  const shown = useCountUp(value)
  const [pulse, setPulse] = useState(0)
  useEffect(() => {
    if (value) setPulse((n) => n + 1)
  }, [value])
  return (
    <span id="rush-score" key={pulse} title="Pontos deste Rush" className={`flex items-center gap-1.5 rounded-full bg-[#f1f2f5] px-3 py-1 font-display text-sm font-extrabold tabular-nums ${pulse ? 'rush-bump' : ''}`}>
      <Star size={14} className="fill-amber-400 text-amber-500" />
      {shown.toLocaleString('pt-BR')}
    </span>
  )
}
