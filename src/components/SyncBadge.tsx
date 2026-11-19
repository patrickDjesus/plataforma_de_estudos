import { syncError, useSyncStatus } from '../lib/cloud'

const LABEL = {
  carregando: 'conectando',
  sincronizado: 'nuvem',
  enviando: 'salvando',
  local: 'local',
  erro: 'sem nuvem',
}

/** Indicador discreto de sincronização ao lado do cronômetro. */
export function SyncBadge() {
  const s = useSyncStatus()
  const dot = s === 'sincronizado' ? '#4d7a57' : s === 'erro' ? '#b42318' : s === 'local' ? '#a1a19b' : '#c4471d'
  const title =
    s === 'local'
      ? 'Os dados ficam salvos só neste navegador. Abra pelo claude.ai, logado, para sincronizar entre dispositivos.'
      : s === 'erro'
        ? syncError()
        : LABEL[s]
  return (
    <span className="hidden items-center gap-1.5 font-mono text-[11px] tracking-wider text-muted uppercase md:flex" title={title}>
      <span className={`h-1.5 w-1.5 rounded-full ${s === 'enviando' || s === 'carregando' ? 'animate-pulse' : ''}`} style={{ background: dot }} />
      {LABEL[s]}
    </span>
  )
}
