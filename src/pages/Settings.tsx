import { useRef, useState } from 'react'
import { Download, Settings2, Upload } from 'lucide-react'
import { useSettings } from '../db/hooks'
import { exportBackup, importBackup, updateSettings } from '../db/repo'
import type { Settings } from '../db/types'
import { toISODate } from '../lib/dates'
import { Btn, Card, Field, PageHeader, inputCls } from '../components/ui'
import { askConfirm } from '../components/confirm'
import { CAPI_POSES, Capybara, type CapiPose } from '../components/Capybara'
import { showMascot } from '../lib/mascotBus'

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
}

const NUMBER_FIELDS: { key: keyof Settings; label: string; min: number; max: number; def?: number; scale?: number }[] = [
  { key: 'blockMinutes', label: 'Duração padrão do bloco (min)', min: 15, max: 180 },
  { key: 'minBlockMinutes', label: 'Bloco mínimo (min)', min: 10, max: 120 },
  { key: 'breakMinutes', label: 'Pausa entre blocos (min)', min: 0, max: 60 },
  { key: 'maxSameSubjectInRow', label: 'Máx. blocos seguidos da mesma matéria', min: 1, max: 6 },
  { key: 'reviewMinutes', label: 'Duração da revisão (min)', min: 10, max: 60, def: 20 },
  { key: 'maxReviewShare', label: 'Máx. da semana para revisões (%)', min: 5, max: 50, def: 20, scale: 100 },
]

export function SettingsPage() {
  const settings = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [backupText, setBackupText] = useState('')
  const [pasted, setPasted] = useState('')

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
      setMsg('Backup importado ✔')
    } catch (e) {
      setMsg(`Erro: ${(e as Error).message}`)
    }
  }

  return (
    <>
      <PageHeader icon={<Settings2 size={22} />} title="Ajustes" subtitle="Regras do planejador e backup dos seus dados." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold">Perfil</h2>
          <div className="max-w-sm">
            <Field label="Como quer ser chamado?">
              <input
                id="user-name"
                className={inputCls}
                placeholder="Seu nome"
                defaultValue={settings.userName ?? ''}
                key={settings.userName ?? ''}
                onBlur={(e) => updateSettings({ userName: e.target.value.trim() || undefined })}
              />
            </Field>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Conheça o Capi</h2>
              <p className="text-sm text-muted">A capivara que te dá boas-vindas, faz perguntas e comemora com você. Clique nele no canto da tela para conversar.</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                id="mascot-welcome"
                type="checkbox"
                className="h-4 w-4 accent-[#3e63f2]"
                checked={settings.mascotWelcome !== false}
                onChange={(e) => updateSettings({ mascotWelcome: e.target.checked })}
              />
              Boas-vindas ao abrir o site
            </label>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {CAPI_POSES.map((p) => (
              <button
                key={p}
                onClick={() => showMascot({ pose: p, title: POSE_TITLE[p], text: POSE_TEXT[p], autoHideMs: 5000 })}
                className="flex flex-col items-center rounded-2xl bg-[#f6f7f9] px-2 pt-3 pb-2 transition hover:bg-brand-soft"
              >
                <Capybara pose={p} size={86} />
                <span className="mt-1 text-xs font-semibold capitalize">{p}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-bold">Planejador</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {NUMBER_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  className={inputCls}
                  value={Math.round(((settings[f.key] as number | undefined) ?? (f.def ?? 0) / (f.scale ?? 1)) * (f.scale ?? 1))}
                  onChange={(e) => {
                    const v = Math.max(f.min, Math.min(f.max, Number(e.target.value) || f.min))
                    updateSettings({ [f.key]: v / (f.scale ?? 1) })
                  }}
                />
              </Field>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">As mudanças valem na próxima vez que o plano for gerado (check-in ou “Regerar plano”).</p>
        </Card>

        <Card>
          <h2 className="mb-1 text-lg font-bold">Backup</h2>
          <p className="mb-4 text-sm text-muted">
            Seus dados ficam só neste navegador. Baixe um backup de vez em quando — se limpar os dados do site, ele é a única cópia.
          </p>
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" onClick={doExport}>
              <Download size={16} /> Exportar backup
            </Btn>
            <Btn onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Importar backup
            </Btn>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={async (e) => doImport(await e.target.files?.[0]?.text())} />
          </div>
          {backupText && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted">Copie este texto e guarde num arquivo .json (por exemplo, no Bloco de Notas).</p>
              <textarea id="backup-out" readOnly value={backupText} className={`${inputCls} h-32 font-mono text-xs`} onFocus={(e) => e.target.select()} />
              <Btn
                variant="soft"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(backupText)
                    setMsg('Backup copiado ✔')
                  } catch {
                    ;(document.getElementById('backup-out') as HTMLTextAreaElement | null)?.select()
                    setMsg('Texto selecionado. Use Ctrl+C para copiar.')
                  }
                }}
              >
                Copiar backup
              </Btn>
            </div>
          )}
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted">Ou cole aqui o texto de um backup para restaurar:</p>
            <textarea id="backup-in" value={pasted} onChange={(e) => setPasted(e.target.value)} className={`${inputCls} h-20 font-mono text-xs`} placeholder='{"app": "mendonca", ...}' />
            <Btn onClick={() => doImport(pasted)} disabled={!pasted.trim()}>
              Restaurar do texto colado
            </Btn>
          </div>
          {msg && <p className="mt-3 text-sm font-semibold">{msg}</p>}
        </Card>
      </div>
    </>
  )
}
