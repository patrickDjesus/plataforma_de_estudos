import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Check, PenLine, RefreshCw, Sparkles } from 'lucide-react'
import { db, uid } from '../db/db'
import { saveWriting } from '../db/repo'
import type { Writing, WritingCategory, WritingDeviation } from '../db/types'
import { AIError, getAI } from '../lib/ai'
import { CATEGORY_LABEL } from '../lib/errors'
import { writingCorrectionPrompt, writingThemePrompt } from '../lib/prompts'
import { Capybara, type CapiPose } from './Capybara'
import { Spinner, VoiceTextarea } from './Voice'
import { Card } from './ui'

type Theme = { tema: string; contexto: string; dicas: string[] }
const COLOR = '#2f5f7e'
const CAT_COLOR: Record<WritingCategory, string> = {
  crase: '#e11d48',
  virgula: '#a8742a',
  concordancia: '#6b5a8a',
  regencia: '#0d9488',
  acentuacao: '#2563eb',
  ortografia: '#9a4a6a',
  pontuacao: '#ea580c',
  colocacao: '#65a30d',
  outro: '#6b6b66',
}
const CATS = Object.keys(CATEGORY_LABEL) as WritingCategory[]

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0)

/** Destaca no texto cada trecho com desvio (numerado). */
function highlight(text: string, devs: WritingDeviation[]) {
  type Mark = { start: number; end: number; n: number; cat: WritingCategory }
  const marks: Mark[] = []
  devs.forEach((d, n) => {
    const i = text.indexOf(d.excerpt)
    if (i >= 0 && !marks.some((m) => i < m.end && i + d.excerpt.length > m.start)) marks.push({ start: i, end: i + d.excerpt.length, n, cat: d.category })
  })
  marks.sort((a, b) => a.start - b.start)
  const out: React.ReactNode[] = []
  let pos = 0
  for (const m of marks) {
    out.push(text.slice(pos, m.start))
    out.push(
      <mark key={m.n} className="rounded px-0.5" style={{ background: `${CAT_COLOR[m.cat]}22`, borderBottom: `2px solid ${CAT_COLOR[m.cat]}`, color: 'inherit' }}>
        {text.slice(m.start, m.end)}
        <sup className="ml-0.5 font-bold" style={{ color: CAT_COLOR[m.cat] }}>
          {m.n + 1}
        </sup>
      </mark>,
    )
    pos = m.end
  }
  out.push(text.slice(pos))
  return out
}

function reaction(devs: number, w: number): { pose: CapiPose; title: string } {
  const rate = w ? (devs / w) * 100 : 0
  if (devs === 0) return { pose: 'comemorando', title: 'Texto impecável! Nenhum desvio da norma-padrão.' }
  if (devs <= 2 || rate <= 3) return { pose: 'formado', title: 'Muito bom! Só uns detalhes para ajustar.' }
  if (rate <= 8) return { pose: 'pensando', title: 'Bom texto, mas alguns desvios merecem atenção.' }
  return { pose: 'chorando', title: 'Vários desvios… mas é treinando que melhora!' }
}

export function WritingTraining() {
  const past = useLiveQuery(() => db.writings.orderBy('createdAt').reverse().toArray(), [], [])
  const errors = useLiveQuery(() => db.errors.where('source').equals('escrita').toArray(), [], [])
  const [theme, setTheme] = useState<Theme | null>(null)
  const [custom, setCustom] = useState('')
  const [text, setText] = useState('')
  const [stage, setStage] = useState<'tema' | 'escrevendo' | 'corrigindo' | 'resultado'>('tema')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Writing | null>(null)
  const [viewing, setViewing] = useState<Writing | null>(null)

  const counts = useMemo(() => {
    const m = new Map<WritingCategory, number>()
    for (const e of errors) if (e.category) m.set(e.category, (m.get(e.category) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [errors])

  const newTheme = async () => {
    setLoading(true)
    setError('')
    try {
      const ai = await getAI()
      if (!ai) throw new AIError('unavailable', 'O Claude não está disponível aqui. Abra o Mendonça pelo claude.ai.')
      const t = await ai.json<Theme>(writingThemePrompt(past.map((p) => p.theme)), { tier: 'quick', fresh: true })
      if (!t?.tema) throw new Error()
      setTheme({ tema: String(t.tema), contexto: String(t.contexto ?? ''), dicas: Array.isArray(t.dicas) ? t.dicas.map(String).slice(0, 3) : [] })
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Não consegui sugerir um tema agora.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!theme && stage === 'tema' && !loading) newTheme()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const correct = async () => {
    if (!theme) return
    setStage('corrigindo')
    setError('')
    try {
      const ai = await getAI()
      const out = await ai!.json<{ resumo?: string; pontosFortes?: string[]; desvios?: { trecho?: string; correcao?: string; categoria?: string; explicacao?: string }[] }>(writingCorrectionPrompt(theme.tema, text), { fresh: true })
      const deviations: WritingDeviation[] = (out?.desvios ?? [])
        .filter((d) => d?.trecho && d?.correcao && d.trecho.trim() !== d.correcao.trim())
        .map((d) => ({
          excerpt: d.trecho!.trim(),
          correction: d.correcao!.trim(),
          category: (CATS.includes(d.categoria as WritingCategory) ? d.categoria : 'outro') as WritingCategory,
          explanation: String(d.explicacao ?? ''),
        }))
      const w: Writing = { id: uid(), theme: theme.tema, text, createdAt: Date.now(), summary: out?.resumo, strengths: Array.isArray(out?.pontosFortes) ? out!.pontosFortes!.map(String).slice(0, 3) : [], deviations }
      await saveWriting(w)
      setResult(w)
      setStage('resultado')
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Não consegui corrigir agora. Seu texto continua aqui; tente de novo.')
      setStage('escrevendo')
    }
  }

  const restart = () => {
    setText('')
    setResult(null)
    setTheme(null)
    setStage('tema')
    newTheme()
  }

  const shown = viewing ?? result

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
      <div>
        {shown ? (
          <WritingResult w={shown} onBack={viewing ? () => setViewing(null) : restart} backLabel={viewing ? 'Voltar' : 'Novo treino'} />
        ) : stage === 'tema' ? (
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <Capybara pose="estudando" size={110} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold tracking-wider uppercase" style={{ color: COLOR }}>
                  Tema do treino
                </div>
                {loading ? (
                  <p className="mt-3 flex items-center gap-2 font-semibold text-muted">
                    <Spinner color={COLOR} /> Pensando num tema…
                  </p>
                ) : theme ? (
                  <>
                    <h2 className="mt-1 text-2xl font-bold">{theme.tema}</h2>
                    <p className="mt-2 text-sm text-slate-600">{theme.contexto}</p>
                    {theme.dicas.length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm text-slate-600">
                        {theme.dicas.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-rose-700">{error || 'Sem tema ainda.'}</p>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  <button onClick={() => setStage('escrevendo')} disabled={!theme} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40" style={{ background: COLOR }}>
                    <PenLine size={16} /> Escrever sobre isso
                  </button>
                  <button onClick={newTheme} disabled={loading} className="flex items-center gap-1.5 rounded-xl bg-[#efefed] px-4 py-2.5 text-sm font-semibold hover:bg-[#e7e7e4]">
                    <RefreshCw size={15} /> Outro tema
                  </button>
                </div>
                <div className="mt-4 flex gap-2 border-t border-line pt-4">
                  <input id="writing-custom" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Ou digite seu próprio tema…" className="flex-1 rounded-xl border border-line bg-[#f7f7f5] px-3 py-2 text-sm outline-none focus:border-brand/50" />
                  <button
                    disabled={!custom.trim()}
                    onClick={() => {
                      setTheme({ tema: custom.trim(), contexto: '', dicas: [] })
                      setStage('escrevendo')
                    }}
                    className="rounded-xl bg-ink px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
                  >
                    Usar
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <button onClick={() => setStage('tema')} className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
              <ArrowLeft size={14} /> Trocar tema
            </button>
            <h2 className="text-xl font-bold">{theme?.tema}</h2>
            {theme?.contexto && <p className="mt-1 text-sm text-muted">{theme.contexto}</p>}
            <div className="mt-4">
              <VoiceTextarea
                id="writing-text"
                color={COLOR}
                value={text}
                onValue={setText}
                rows={12}
                disabled={stage === 'corrigindo'}
                placeholder="Escreva (ou fale) seu texto aqui. 1 a 3 parágrafos já bastam."
                className="w-full rounded-2xl border border-line bg-[#f8f8f6] px-5 py-4 text-[15px] leading-relaxed outline-none focus:border-brand/50 focus:bg-white focus:ring-4 focus:ring-brand/10"
              />
            </div>
            {error && <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className={`text-xs font-semibold ${words(text) >= 60 ? 'text-emerald-600' : 'text-muted'}`}>
                {words(text)} palavras {words(text) < 60 ? '· recomendado 60 ou mais' : '✓'}
              </span>
              <button onClick={correct} disabled={words(text) < 15 || stage === 'corrigindo'} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40" style={{ background: COLOR }}>
                {stage === 'corrigindo' ? <Spinner size={16} color="#fff" /> : <Sparkles size={16} />} {stage === 'corrigindo' ? 'Corrigindo…' : 'Corrigir meu texto'}
              </button>
            </div>
          </Card>
        )}
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <h3 className="mb-3 font-sans text-sm font-bold">Seus desvios mais comuns</h3>
          {counts.length === 0 ? (
            <p className="text-sm text-muted">Faça um treino e eu começo a contar os tipos de desvio que mais aparecem.</p>
          ) : (
            <div className="space-y-2">
              {counts.slice(0, 6).map(([cat, n]) => (
                <div key={cat}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-semibold">{CATEGORY_LABEL[cat]}</span>
                    <span className="text-muted tabular-nums">{n}×</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#ececea]">
                    <div className="h-full rounded-md" style={{ width: `${(n / counts[0][1]) * 100}%`, background: CAT_COLOR[cat] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-sans text-sm font-bold">Treinos anteriores</h3>
          {past.length === 0 && <p className="text-sm text-muted">Nenhum ainda.</p>}
          <div className="space-y-1">
            {past.slice(0, 8).map((w) => (
              <button key={w.id} onClick={() => setViewing(w)} className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{w.theme}</span>
                  <span className="text-[11px] text-muted">{new Date(w.createdAt).toLocaleDateString('pt-BR')}</span>
                </span>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${w.deviations.length === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{w.deviations.length} desvios</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function WritingResult({ w, onBack, backLabel }: { w: Writing; onBack: () => void; backLabel: string }) {
  const re = reaction(w.deviations.length, words(w.text))
  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-5 p-6">
        <Capybara pose={re.pose} size={130} />
        <div className="min-w-0 flex-1">
          <div className="pop-score font-display text-5xl font-extrabold" style={{ color: w.deviations.length ? '#a8742a' : '#4d7a57' }}>
            {w.deviations.length} {w.deviations.length === 1 ? 'desvio' : 'desvios'}
          </div>
          <h3 className="mt-1 text-lg font-bold">{re.title}</h3>
          {w.summary && <p className="mt-1 text-sm text-slate-600">{w.summary}</p>}
          {w.strengths && w.strengths.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {w.strengths.map((s) => (
                <span key={s} className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  ✓ {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
      <Card className="p-6">
        <div className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Seu texto · {w.theme}</div>
        <p className="text-[15px] leading-loose whitespace-pre-wrap">{highlight(w.text, w.deviations)}</p>
      </Card>
      {w.deviations.length > 0 && (
        <div className="space-y-3">
          {w.deviations.map((d, i) => (
            <Card key={i} className="p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md text-xs font-bold text-white" style={{ background: CAT_COLOR[d.category] }}>
                  {i + 1}
                </span>
                <span className="rounded-md px-2.5 py-0.5 text-xs font-bold" style={{ background: `${CAT_COLOR[d.category]}1a`, color: CAT_COLOR[d.category] }}>
                  {CATEGORY_LABEL[d.category]}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm">
                  <span className="text-[11px] font-bold text-rose-600 uppercase">Você escreveu</span>
                  <div className="font-semibold line-through decoration-rose-400">{d.excerpt}</div>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase">Na norma-padrão</span>
                  <div className="font-semibold">{d.correction}</div>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600">{d.explanation}</p>
            </Card>
          ))}
          <p className="text-center text-xs text-muted">Os desvios foram para o seu caderno de erros. A correção é uma sugestão do Claude e pode errar.</p>
        </div>
      )}
      <button onClick={onBack} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-bold text-white" style={{ background: COLOR }}>
        {backLabel === 'Voltar' ? <ArrowLeft size={18} /> : <Check size={18} />} {backLabel}
      </button>
    </div>
  )
}
