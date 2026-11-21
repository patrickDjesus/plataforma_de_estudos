import { useRef, useState, type ReactNode } from 'react'
import { ClipboardPaste, Cloud, Copy, Download, Focus, Minus, Plus, Repeat, RotateCcw, Smile, Target, Timer, Trash2, Upload, UserRound, Wrench } from 'lucide-react'
import { useSettings } from '../db/hooks'
import { CLOUD_DOC_LIMIT, useCloudDocCount } from '../lib/cloud'
import { applySeed, ensureSeed, exportBackup, importBackup, resetAllData, updateSettings } from '../db/repo'
import { useNavigate } from 'react-router-dom'
import type { Settings } from '../db/types'
import { toISODate } from '../lib/dates'
import { Btn, Card, Field, inputCls } from '../components/ui'
import { SceneBanner, settingsFront, settingsScene } from '../components/Scenes'
import { askConfirm } from '../components/confirm'
import { CAPI_POSES, Capybara, type CapiPose } from '../components/Capybara'
import { showMascot } from '../lib/mascotBus'
import { FxText } from '../components/Fx'

const IS_ARTIFACT = !!import.meta.env.VITE_ARTIFACT

const POSE_TITLE: Record<CapiPose, string> = {
  acenando: 'Oi, oi!',
  estudando: 'Modo estudo',
  comemorando: 'Uhuul!',
  pensando: 'Hmm…',
  dormindo: 'Zzz…',
  relaxando: 'De boa',
  focado: 'Foco total',
  formado: 'Subiu de nível!',
  chorando: 'Buáá…',
}
const POSE_TEXT: Record<CapiPose, string> = {
  acenando: 'É assim que eu te recebo quando você abre o site.',
  estudando: 'Apareço assim quando é hora de estudar ou anotar.',
  comemorando: 'Essa é pra quando você conclui um bloco!',
  pensando: 'Quando tenho uma pergunta pra te fazer.',
  dormindo: 'Se você abrir o site muito tarde, eu te lembro de dormir.',
  relaxando: 'Dia livre? Laranja na cabeça e tranquilidade.',
  focado: 'Durante as sessões de foco.',
  formado: 'Quando você sobe de nível.',
  chorando: 'Quando o desafio dá ruim. Mas a gente revisa e volta mais forte!',
}

type NumField = { key: keyof Settings; label: string; min: number; max: number; step: number; unit: string; def?: number; scale?: number }
const GROUPS: { title: string; icon: ReactNode; from: string; to: string; fields: NumField[] }[] = [
  {
    title: 'Blocos de estudo',
    icon: <Timer size={18} />,
    from: '#5b7cff',
    to: '#3e63f2',
    fields: [
      { key: 'blockMinutes', label: 'Duração', min: 15, max: 180, step: 5, unit: 'min' },
      { key: 'minBlockMinutes', label: 'Mínimo', min: 10, max: 120, step: 5, unit: 'min' },
      { key: 'breakMinutes', label: 'Pausa entre blocos', min: 0, max: 60, step: 5, unit: 'min' },
      { key: 'maxSameSubjectInRow', label: 'Mesma matéria seguida', min: 1, max: 6, step: 1, unit: 'no máx.' },
    ],
  },
  {
    title: 'Revisões',
    icon: <Repeat size={18} />,
    from: '#a77bff',
    to: '#6233d6',
    fields: [
      { key: 'reviewMinutes', label: 'Duração', min: 10, max: 60, step: 5, unit: 'min', def: 20 },
      { key: 'maxReviewShare', label: 'Da semana, no máximo', min: 5, max: 50, step: 5, unit: '%', def: 20, scale: 100 },
    ],
  },
  {
    title: 'Modo foco',
    icon: <Focus size={18} />,
    from: '#ff9a3d',
    to: '#e2551b',
    fields: [
      { key: 'focusMinutes', label: 'Foco', min: 10, max: 90, step: 5, unit: 'min', def: 25 },
      { key: 'focusPauseMinutes', label: 'Pausa', min: 1, max: 30, step: 1, unit: 'min', def: 5 },
    ],
  },
  {
    title: 'Meta diária',
    icon: <Target size={18} />,
    from: '#2fcf9b',
    to: '#0f8a63',
    fields: [{ key: 'dailyGoal', label: 'Questões por dia', min: 1, max: 300, step: 5, unit: '' , def: 20 }],
  },
]

/** Quadradinho de ícone com degradê (mesmo estilo dos ícones de matéria). */
function Tile({ from, to, children }: { from: string; to: string; children: ReactNode }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-[0_6px_12px_-6px_rgba(16,24,40,.5)]" style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}>
      {children}
    </span>
  )
}
function Section({ title, icon, from, to, children, className = '' }: { title: string; icon: ReactNode; from: string; to: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <div className="mb-4 flex items-center gap-3">
        <Tile from={from} to={to}>
          {icon}
        </Tile>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {children}
    </Card>
  )
}

/** Linha "rótulo ............ [−] 50 min [+]". */
function Stepper({ f, settings }: { f: NumField; settings: Settings }) {
  const scale = f.scale ?? 1
  const value = Math.round(((settings[f.key] as number | undefined) ?? (f.def ?? 0) / scale) * scale)
  const set = (v: number) => updateSettings({ [f.key]: Math.max(f.min, Math.min(f.max, v)) / scale })
  const btn = 'grid h-8 w-8 place-items-center rounded-lg bg-white text-slate-600 shadow-sm transition hover:text-brand disabled:opacity-40'
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm font-semibold text-slate-700">{f.label}</span>
      <div className="flex items-center gap-1 rounded-xl bg-[#f1f2f5] p-1">
        <button className={btn} onClick={() => set(value - f.step)} disabled={value <= f.min} aria-label={`Diminuir ${f.label}`}>
          <Minus size={15} />
        </button>
        <span className="min-w-[64px] text-center text-sm font-bold tabular-nums">
          {value}
          {f.unit && <span className="ml-1 text-xs font-semibold text-muted">{f.unit}</span>}
        </span>
        <button className={btn} onClick={() => set(value + f.step)} disabled={value >= f.max} aria-label={`Aumentar ${f.label}`}>
          <Plus size={15} />
        </button>
      </div>
    </div>
  )
}

/** Interruptor liga/desliga. */
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-brand' : 'bg-[#d6d9e2]'}`}>
      <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition ${on ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export function SettingsPage() {
  const settings = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [resetting, setResetting] = useState(false)
  const navigate = useNavigate()
  const [backupText, setBackupText] = useState('')
  const [pasted, setPasted] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)

  const doExport = async () => {
    if (IS_ARTIFACT) {
      // Downloads são bloqueados na página publicada: mostra o texto para copiar
      setBackupText(await exportBackup())
      return
    }
    const blob = new Blob([await exportBackup()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mendonca-backup-${toISODate(new Date())}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('Backup baixado ✔')
  }

  const doImport = async (text?: string) => {
    if (!text) return
    if (!(await askConfirm('Importar substitui TODOS os dados atuais pelos do backup. Continuar?'))) return
    try {
      await importBackup(text)
      setPasted('')
      setPasteOpen(false)
      setMsg('Backup importado ✔')
    } catch (e) {
      setMsg(`Erro: ${(e as Error).message}`)
    }
  }

  return (
    <>
      <SceneBanner title="Ajustes" subtitle="Do seu jeito." from="#5468c9" to="#8fa0f5" pose="focado" scene={settingsScene} front={settingsFront} />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {/* Você */}
        <Section title="Você" icon={<UserRound size={18} />} from="#ff6b7a" to="#c9273b">
          <div className="space-y-4">
            <Field label="Nome">
              <input
                id="user-name"
                className={inputCls}
                placeholder="Como quer ser chamado?"
                defaultValue={settings.userName ?? ''}
                key={settings.userName ?? ''}
                onBlur={(e) => updateSettings({ userName: e.target.value.trim() || undefined })}
              />
            </Field>
            <Field label="Prova alvo">
              <input
                defaultValue={settings.targetExam ?? ''}
                key={`exam-${settings.targetExam ?? ''}`}
                onBlur={(e) => updateSettings({ targetExam: e.target.value.trim() || undefined })}
                placeholder="ENEM, Fuvest, Unicamp…"
                title="As questões imitam o estilo dessa prova"
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        {/* Mendi */}
        <Section title="Mendi" icon={<Smile size={18} />} from="#ffc24d" to="#e08a00">
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-[#f6f7f9] px-4 py-3">
            <span className="text-sm font-semibold">Boas-vindas ao abrir</span>
            <Switch on={settings.mascotWelcome !== false} onChange={(v) => updateSettings({ mascotWelcome: v })} label="Boas-vindas ao abrir o site" />
          </div>
          <div className="thin-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {CAPI_POSES.map((p) => (
              <button
                key={p}
                onClick={() => showMascot({ pose: p, title: POSE_TITLE[p], text: POSE_TEXT[p], autoHideMs: 5000 })}
                title={POSE_TITLE[p]}
                className="flex shrink-0 flex-col items-center rounded-2xl bg-[#f6f7f9] px-1.5 pt-2 pb-1.5 transition hover:-translate-y-0.5 hover:bg-brand-soft"
              >
                <Capybara pose={p} size={60} />
                <span className="mt-0.5 text-[11px] font-semibold capitalize text-slate-600">{p}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Planejador */}
        {GROUPS.map((g) => (
          <Section key={g.title} title={g.title} icon={g.icon} from={g.from} to={g.to}>
            <div className="divide-y divide-line">
              {g.fields.map((f) => (
                <Stepper key={f.key} f={f} settings={settings} />
              ))}
            </div>
          </Section>
        ))}
        <p className="-mt-2 text-xs text-muted lg:col-span-2">Blocos e revisões valem a partir do próximo plano.</p>

        {/* Backup */}
        <Section title="Backup" icon={<Cloud size={18} />} from="#2fb5d6" to="#1479a8">
          <CloudUsage />
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" onClick={doExport}>
              <Download size={16} /> Exportar
            </Btn>
            <Btn onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Importar arquivo
            </Btn>
            <Btn variant="soft" onClick={() => setPasteOpen((v) => !v)}>
              <ClipboardPaste size={16} /> Colar texto
            </Btn>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={async (e) => doImport(await e.target.files?.[0]?.text())} />
          </div>
          {backupText && (
            <div className="mt-4 space-y-2">
              <textarea id="backup-out" readOnly value={backupText} className={`${inputCls} h-28 font-mono text-xs`} onFocus={(e) => e.target.select()} />
              <Btn
                variant="soft"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(backupText)
                    setMsg('Backup copiado ✔ Guarde num arquivo .json.')
                  } catch {
                    ;(document.getElementById('backup-out') as HTMLTextAreaElement | null)?.select()
                    setMsg('Texto selecionado. Use Ctrl+C.')
                  }
                }}
              >
                <Copy size={16} /> Copiar
              </Btn>
            </div>
          )}
          {pasteOpen && (
            <div className="mt-4 space-y-2">
              <textarea id="backup-in" value={pasted} onChange={(e) => setPasted(e.target.value)} className={`${inputCls} h-20 font-mono text-xs`} placeholder='{"app": "mendonca", ...}' autoFocus />
              <Btn onClick={() => doImport(pasted)} disabled={!pasted.trim()}>
                Restaurar
              </Btn>
            </div>
          )}
          {msg && <p className="mt-3 text-sm font-semibold"><FxText text={msg} /></p>}
        </Section>

        {/* Manutenção */}
        <Section title="Manutenção" icon={<Wrench size={18} />} from="#8a93a8" to="#5b6478">
          <div className="divide-y divide-line">
            <div className="flex items-center justify-between gap-3 pb-3">
              <div>
                <div className="text-sm font-semibold">Conteúdos padrão</div>
                <div className="text-xs text-muted">Recria só o que estiver faltando.</div>
              </div>
              <Btn
                variant="soft"
                onClick={async () => {
                  const n = await applySeed()
                  showMascot({ pose: 'estudando', title: n ? 'Conteúdos restaurados' : 'Tudo no lugar', text: n ? `Recriei ${n} itens que estavam faltando.` : 'Todos os conteúdos padrão já estavam aqui.', autoHideMs: 6000 })
                }}
              >
                <RotateCcw size={16} /> Restaurar
              </Btn>
            </div>
            <div className="flex items-center justify-between gap-3 pt-3">
              <div>
                <div className="text-sm font-semibold text-rose-700">Reiniciar tudo</div>
                <div className="text-xs text-muted">Apaga tudo, aqui e na nuvem.</div>
              </div>
              <Btn
                variant="danger"
                disabled={resetting}
                onClick={async () => {
                  if (!(await askConfirm('Apagar TODOS os dados do Mendonça, aqui e na nuvem? Isso não pode ser desfeito. Se quiser guardar algo, exporte um backup antes.'))) return
                  setResetting(true)
                  await resetAllData()
                  await ensureSeed()
                  setResetting(false)
                  navigate('/materias')
                  showMascot({ pose: 'acenando', title: 'Tudo novo!', text: 'Os dados foram apagados e os conteúdos padrão de Ensino Médio e Inglês voltaram. Cadastre as matérias da Faculdade e eu monto a próxima semana.', autoHideMs: 9000 })
                }}
              >
                <Trash2 size={16} /> {resetting ? 'Apagando…' : 'Reiniciar'}
              </Btn>
            </div>
          </div>
        </Section>
      </div>
    </>
  )
}

/** Quanto do limite da nuvem do claude.ai o site já usa. */
function CloudUsage() {
  const n = useCloudDocCount()
  if (n === null) return null
  const pct = n / CLOUD_DOC_LIMIT
  const color = pct >= 0.8 ? '#ef4444' : pct >= 0.6 ? '#f59e0b' : '#10b981'
  return (
    <div className="mb-4 rounded-2xl bg-[#f6f7f9] px-4 py-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">Nuvem</span>
        <span className="tabular-nums text-muted">
          {Math.round(pct * 100)}% usado
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e6e8ee]">
        <div className="h-full rounded-full" style={{ width: `${Math.max(1, pct * 100)}%`, background: color }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {pct >= 0.8
          ? 'Quase cheia. Exporte um backup.'
          : 'Tudo salvo e sincronizado.'}
      </p>
    </div>
  )
}
