import { useRef, useState } from 'react'
import { Download, Settings2, Upload } from 'lucide-react'
import { useSettings } from '../db/hooks'
import { exportBackup, importBackup, updateSettings } from '../db/repo'
import type { Settings } from '../db/types'
import { toISODate } from '../lib/dates'
import { Btn, Card, Field, PageHeader, inputCls } from '../components/ui'

const NUMBER_FIELDS: { key: keyof Settings; label: string; min: number; max: number }[] = [
  { key: 'blockMinutes', label: 'Duração padrão do bloco (min)', min: 15, max: 180 },
  { key: 'minBlockMinutes', label: 'Bloco mínimo (min)', min: 10, max: 120 },
  { key: 'breakMinutes', label: 'Pausa entre blocos (min)', min: 0, max: 60 },
  { key: 'maxSameSubjectInRow', label: 'Máx. blocos seguidos da mesma matéria', min: 1, max: 6 },
]

export function SettingsPage() {
  const settings = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  const doExport = async () => {
    const blob = new Blob([await exportBackup()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mendonca-backup-${toISODate(new Date())}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('Backup baixado ✔')
  }

  const doImport = async (file?: File) => {
    if (!file) return
    if (!confirm('Importar substitui TODOS os dados atuais pelos do arquivo. Continuar?')) return
    try {
      await importBackup(await file.text())
      setMsg('Backup importado ✔')
    } catch (e) {
      setMsg(`Erro: ${(e as Error).message}`)
    }
  }

  return (
    <>
      <PageHeader icon={<Settings2 size={22} />} title="Ajustes" subtitle="Regras do planejador e backup dos seus dados." />
      <div className="grid gap-6 lg:grid-cols-2">
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
                  value={settings[f.key] as number}
                  onChange={(e) => {
                    const v = Math.max(f.min, Math.min(f.max, Number(e.target.value) || f.min))
                    updateSettings({ [f.key]: v })
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
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => doImport(e.target.files?.[0])} />
          </div>
          {msg && <p className="mt-3 text-sm font-semibold">{msg}</p>}
        </Card>
      </div>
    </>
  )
}
