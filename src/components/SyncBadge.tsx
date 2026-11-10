import { Cloud, CloudOff, HardDrive } from 'lucide-react'
import { Spinner } from './Voice'
import { syncError, useSyncStatus } from '../lib/cloud'

const LABEL = {
  carregando: 'Conectando…',
  sincronizado: 'Salvo na nuvem',
  enviando: 'Salvando…',
  local: 'Só neste navegador',
  erro: 'Nuvem com problema',
}

/** Indicador discreto de sincronização ao lado do cronômetro. */
export function SyncBadge() {
  const s = useSyncStatus()
  const icon =
    s === 'sincronizado' ? <Cloud size={16} /> : s === 'local' ? <HardDrive size={16} /> : s === 'erro' ? <CloudOff size={16} /> : <Spinner size={16} />
  const color = s === 'sincronizado' ? 'text-emerald-600 bg-emerald-50' : s === 'erro' ? 'text-rose-600 bg-rose-50' : s === 'local' ? 'text-slate-500 bg-[#f1f2f5]' : 'text-brand bg-brand-soft'
  const title =
    s === 'local'
      ? 'Os dados ficam salvos só neste navegador. Abra pelo claude.ai, logado, para sincronizar entre dispositivos.'
      : s === 'erro'
        ? syncError()
        : LABEL[s]
  return (
    <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold md:flex ${color}`} title={title}>
      {icon}
      <span className="hidden xl:inline">{LABEL[s]}</span>
    </span>
  )
}
