import { useState, type ReactNode } from 'react'
import { useSyncStatus } from '../lib/cloud'
import { supabaseConfigured } from '../lib/supabase'
import { Capybara } from './Capybara'
import { LogoMark } from './Logo'
import { LoginForm } from './SyncBadge'

const SKIP = 'mendonca-sem-conta'
const skipped = () => {
  try {
    return localStorage.getItem(SKIP) === '1'
  } catch {
    return false
  }
}

/**
 * No site próprio, pede o login antes de tudo: assim um aparelho novo já começa com os dados
 * da nuvem em vez de planejar uma semana do zero. Dá para seguir sem conta (só neste navegador).
 */
export function LoginGate({ children }: { children: ReactNode }) {
  const status = useSyncStatus()
  const [skip, setSkip] = useState(skipped)
  if (!supabaseConfigured || skip) return <>{children}</>
  if (status === 'carregando' && !skip)
    return (
      <div className="grid min-h-full place-items-center">
        <Capybara pose="estudando" size={120} />
      </div>
    )
  if (status !== 'entrar') return <>{children}</>
  return (
    <div className="grid min-h-full place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm rounded-[24px] bg-white p-7 shadow-[0_24px_60px_-30px_rgba(16,24,40,0.35)]">
        <div className="mb-4 flex items-center gap-3">
          <LogoMark size={44} />
          <div>
            <div className="font-display text-xl font-bold">Mendonça</div>
            <div className="text-xs text-muted">Seu plano de estudos</div>
          </div>
        </div>
        <LoginForm />
        <button
          onClick={() => {
            try {
              localStorage.setItem(SKIP, '1')
            } catch {
              /* sem armazenamento: vale só nesta visita */
            }
            setSkip(true)
          }}
          className="mt-5 w-full text-center text-xs font-semibold text-muted hover:text-ink"
        >
          Usar sem conta (só neste navegador)
        </button>
      </div>
    </div>
  )
}
