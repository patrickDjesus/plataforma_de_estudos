import { useState } from 'react'
import { Brain, Target, TrendingUp } from 'lucide-react'
import { useSubjectMap } from '../../db/hooks'
import { famStatus, fmtClock, fmtLong, type HistoryItem, type RushState } from '../../lib/rush'
import { MathText } from '../../components/MathText'
import { Spinner } from '../../components/Voice'
import { RushCapi } from './RushCapi'
import { diagnose, errCopy, subjectName } from './actions'
import { generatingFor, rush } from './store'

const accColor = (p: number) => (p < 50 ? '#ff5c7a' : p < 75 ? '#f5b400' : '#22b573')

function AccChart({ H }: { H: HistoryItem[] }) {
  const W = 600
  const Hh = 210
  const l = 40
  const r = 14
  const t = 14
  const b = 28
  const N = H.length
  const pts = H.map((_, i) => {
    const win = H.slice(Math.max(0, i - 9), i + 1)
    return win.filter((x) => x.correct).length / win.length
  })
  const step = Math.max(1, Math.ceil(N / 300))
  const xs = (i: number) => l + (N === 1 ? (W - l - r) / 2 : (i / (N - 1)) * (W - l - r))
  const ys = (v: number) => t + (1 - v) * (Hh - t - b)
  let line = ''
  for (let i = 0; i < N; i += step) line += (line ? ' L' : 'M') + xs(i).toFixed(1) + ' ' + ys(pts[i]).toFixed(1)
  if ((N - 1) % step) line += ' L' + xs(N - 1).toFixed(1) + ' ' + ys(pts[N - 1]).toFixed(1)
  const area = line + ` L${xs(N - 1).toFixed(1)} ${ys(0)} L${xs(0).toFixed(1)} ${ys(0)} Z`
  const last = pts[N - 1]
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} className="block h-auto w-full rounded-2xl bg-[#f6f7f9]" role="img" aria-label={`Acerto das últimas 10 questões: ${Math.round(last * 100)}%`}>
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line x1={l} x2={W - r} y1={ys(v)} y2={ys(v)} stroke="#dfe3ec" strokeDasharray={v === 0 ? undefined : '4 5'} />
          <text x={l - 8} y={ys(v) + 4} textAnchor="end" fontSize="12" fill="#7a8194" fontWeight="700">
            {v * 100}%
          </text>
        </g>
      ))}
      <text x={l} y={Hh - 8} fontSize="12" fill="#7a8194" fontWeight="700">
        questão 1
      </text>
      <text x={W - r} y={Hh - 8} textAnchor="end" fontSize="12" fill="#7a8194" fontWeight="700">
        questão {N}
      </text>
      <path d={area} fill="#3e63f2" opacity=".12" />
      <path d={line} fill="none" stroke="#3e63f2" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xs(N - 1)} cy={ys(last)} r="7" fill="#fff" stroke="#3e63f2" strokeWidth="3.5" />
      <text x={Math.min(xs(N - 1), W - r - 30)} y={Math.max(ys(last) - 14, 14)} textAnchor="middle" fontSize="14" fontWeight="800" fill="#2a47c4">
        {Math.round(last * 100)}%
      </text>
    </svg>
  )
}

function Bar({ label, right, pct, color }: { label: React.ReactNode; right: string; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-sm font-bold">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 text-muted">{right}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[#eef0f4]">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function Sec({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 grid gap-2.5">
      <h3 className="font-display text-xl font-bold">{title}</h3>
      {hint && <p className="-mt-1 text-sm text-muted">{hint}</p>}
      {children}
    </section>
  )
}

export function RushReport({ S }: { S: RushState }) {
  const subjects = useSubjectMap()
  const H = S.history
  const s0 = S.stats
  const [diag, setDiag] = useState('')
  const [busy, setBusy] = useState(false)

  if (!H.length)
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <RushCapi mood="idle" size={110} talk={false} />
        <p className="max-w-md text-muted">Resolva umas questões primeiro que aqui aparece tudo: acerto ao longo do tempo, matérias, pontos fracos e mais.</p>
        <button onClick={() => rush.update((d) => (d.view = 'rush'))} className="flex items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 font-bold text-white">
          Bora pro Rush <Target size={16} />
        </button>
      </div>
    )

  const acc = Math.round((100 * s0.correct) / Math.max(1, s0.done))
  const cnt = { pend: 0, trein: 0, rec: 0, dom: 0 }
  for (const [id, f] of Object.entries(S.families)) {
    const lb = famStatus(S, id, f, generatingFor(id)).label
    if (lb === 'pendente') cnt.pend++
    else if (lb === 'treinando' || lb === 'dúvida') cnt.trein++
    else if (lb === 'dominado') cnt.dom++
    else cnt.rec++
  }
  const tiles: [string, string | number][] = [
    ['Pontos', S.score.toLocaleString('pt-BR')],
    ['Feitas', s0.done],
    ['Acerto', acc + '%'],
    ['Dificuldade atual', S.level.toFixed(1) + '/10'],
    ['Maior dificuldade vencida', S.maxDif + '/10'],
    ['Chefões derrotados', S.bosses],
    ['Melhor combo', s0.best],
    ['Tempo total', fmtLong(s0.ms)],
    ['Erros recuperados', cnt.rec + cnt.dom],
  ]

  const tp: Record<string, { materia: string; topico: string; n: number; c: number }> = {}
  for (const x of H) {
    if (!x.topico) continue
    const k = x.materia + '|' + x.topico
    const o = (tp[k] ??= { materia: x.materia, topico: x.topico, n: 0, c: 0 })
    o.n++
    if (x.correct) o.c++
  }
  const weak = Object.values(tp)
    .filter((o) => o.n >= 2)
    .sort((a, b) => a.c / a.n - b.c / b.n || b.n - a.n)
    .slice(0, 6)

  const cf = { certeza: { n: 0, c: 0 }, acho: { n: 0, c: 0 }, chute: { n: 0, c: 0 } }
  for (const x of H)
    if (x.conf) {
      cf[x.conf].n++
      if (x.correct) cf[x.conf].c++
    }
  const cp = (k: keyof typeof cf) => (cf[k].n ? Math.round((100 * cf[k].c) / cf[k].n) : 0)
  let insight = 'Quanto mais perto de 100% a barra de "Certeza" ficar, melhor você conhece o que sabe.'
  if (cf.certeza.n >= 3 && cp('certeza') < 70) insight = 'Você está errando bastante quando tem certeza. Vale ler o enunciado com mais calma e desconfiar da primeira ideia.'
  else if (cf.chute.n >= 3 && cp('chute') >= 50) insight = 'Seus chutes acertam bastante: você sabe mais do que acha!'
  else if (cf.certeza.n >= 3 && cp('certeza') >= 85) insight = 'Quando você tem certeza, você acerta. Ótima noção do que sabe!'

  const tot = cnt.pend + cnt.trein + cnt.rec + cnt.dom
  const segs: [keyof typeof cnt, string, string][] = [
    ['pend', '#ff5c7a', 'pendentes'],
    ['trein', '#ffc93c', 'treinando'],
    ['rec', '#8ee0b6', 'recuperados'],
    ['dom', '#22b573', 'dominados'],
  ]
  const tail = H.slice(-240)

  const runDiag = async () => {
    setBusy(true)
    setDiag('')
    const errs =
      Object.entries(S.families)
        .slice(-30)
        .map(([id, f]) => `- ${subjectName(f.materia)} / ${f.topico}: ${f.conceito} (${f.erros} erro(s), ${famStatus(S, id, f).label})`)
        .join('\n') || 'nenhum'
    const subj = Object.entries(S.bySubj)
      .map(([id, b]) => `${subjectName(id)}: ${b.correct}/${b.done}`)
      .join('; ')
    const wk = weak.map((o) => `${subjectName(o.materia)} / ${o.topico}: ${o.c}/${o.n}`).join('; ') || 'nenhum ainda'
    try {
      const full = await diagnose(
        `Um aluno fez um rush de questões. Analise o desempenho e dê um diagnóstico curto e prático em português, informal e encorajador (no máximo uns 160 palavras), sem markdown (pode usar "•" pra listar). Diga: 1) o que ele já tá mandando bem, 2) os 3 pontos que mais precisa estudar e por quê, 3) uma sugestão concreta do que fazer agora.

Total: ${s0.done} questões, ${acc}% de acerto, média de ${fmtClock(s0.ms / Math.max(1, s0.done))} por questão.
Por matéria: ${subj}
Assuntos mais fracos: ${wk}
Confiança: com certeza acertou ${cp('certeza')}% (${cf.certeza.n}), achando ${cp('acho')}% (${cf.acho.n}), no chute ${cp('chute')}% (${cf.chute.n}).
Conceitos que errou:
${errs}`,
        setDiag,
      )
      setDiag(full)
    } catch (e) {
      setDiag(errCopy((e as { code?: string }).code))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2 className="flex items-center gap-2 font-display text-3xl font-extrabold">
        Seu relatório <TrendingUp className="text-brand" />
      </h2>
      <p className="text-sm text-muted">Como está indo o Rush até agora.</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {tiles.map(([lb, v], i) => (
          <div key={lb} className="rush-enter grid gap-0.5 rounded-2xl bg-[#f6f7f9] px-3.5 py-3" style={{ animationDelay: `${i * 60}ms` }}>
            <b className="font-display text-2xl leading-tight tabular-nums">{v}</b>
            <span className="text-[11px] font-bold tracking-wider text-muted uppercase">{lb}</span>
          </div>
        ))}
      </div>

      <Sec title="Acerto ao longo do Rush" hint="Média das últimas 10 questões em cada ponto. Linha subindo = você está aprendendo.">
        <AccChart H={H} />
      </Sec>

      <Sec title="Linha do tempo" hint={H.length > 240 ? 'Cada quadradinho é uma questão (as últimas 240).' : 'Cada quadradinho é uma questão, na ordem.'}>
        <div className="flex flex-wrap gap-[3px]">
          {tail.map((x, i) => (
            <i key={i} title={`${subjectName(x.materia)}: ${x.conceito}`} className={`block h-3.5 w-3.5 rounded ${x.correct ? 'bg-emerald-500' : 'bg-rose-400'} ${x.rev ? 'outline-2 outline-offset-1 outline-amber-400' : ''}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-bold text-muted">
          <span>🟩 acertou</span>
          <span>🟥 errou</span>
          <span>🟨 contorno = revisão</span>
        </div>
      </Sec>

      <Sec title="Por matéria">
        <div className="grid gap-2.5">
          {Object.entries(S.bySubj)
            .filter(([, b]) => b.done)
            .map(([id, b]) => {
              const p = Math.round((100 * b.correct) / b.done)
              return <Bar key={id} label={subjectName(id)} right={`${p}% · ${b.correct}/${b.done}`} pct={p} color={subjects.get(id)?.color ?? '#3e63f2'} />
            })}
        </div>
      </Sec>

      <Sec title="Pontos fracos" hint="Assuntos com pior acerto (com pelo menos 2 questões).">
        {weak.length ? (
          <div className="grid gap-2.5">
            {weak.map((o) => {
              const p = Math.round((100 * o.c) / o.n)
              return <Bar key={o.materia + o.topico} label={`${o.topico} · ${subjectName(o.materia)}`} right={`${p}% · ${o.c}/${o.n}`} pct={p} color={accColor(p)} />
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">Ainda não tem assunto com 2 questões ou mais.</p>
        )}
      </Sec>

      <Sec title="Confiança x acerto" hint={insight}>
        <div className="grid gap-2.5">
          {(
            [
              ['certeza', '✅ Com certeza', '#3e63f2'],
              ['acho', '🤔 Achando', '#3d8bff'],
              ['chute', '🎲 No chute', '#ff8a3d'],
            ] as const
          ).map(([k, lb, c]) => (
            <Bar key={k} label={lb} right={cf[k].n ? `${cp(k)}% · ${cf[k].c}/${cf[k].n}` : 'nenhuma'} pct={cp(k)} color={c} />
          ))}
        </div>
      </Sec>

      {tot > 0 && (
        <Sec title="Dos erros ao domínio" hint={`${tot} conceito${tot > 1 ? 's' : ''} errados ou com dúvida neste Rush. Eles também estão no seu Caderno de erros.`}>
          <div className="flex h-6 overflow-hidden rounded-full bg-[#eef0f4]">
            {segs.map(([k, c]) => (
              <i key={k} className="block h-full transition-all" style={{ width: `${(100 * cnt[k]) / tot}%`, background: c }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-bold text-muted">
            {segs.map(([k, c, lb]) => (
              <span key={k} className="flex items-center gap-1.5">
                <i className="block h-3 w-3 rounded" style={{ background: c }} /> {cnt[k]} {lb}
              </span>
            ))}
          </div>
        </Sec>
      )}

      <Sec title="Diagnóstico" hint="A IA olha seus números e erros e diz o que estudar primeiro. Só usa a IA se você clicar.">
        <div>
          <button disabled={busy} onClick={runDiag} className="flex items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 font-bold text-white shadow-[0_5px_0_#2a47c4] disabled:opacity-50">
            <Brain size={17} /> Pedir diagnóstico da IA
          </button>
        </div>
        {(busy || diag) && <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm leading-relaxed">{busy && !diag ? <Spinner size={18} /> : <MathText text={diag} className="whitespace-pre-wrap" />}</div>}
      </Sec>
    </div>
  )
}
