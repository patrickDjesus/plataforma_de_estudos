import { useEffect, useState } from 'react'

const QUERY = '(max-width: 640px)'
const mq = () => (typeof window !== 'undefined' ? window.matchMedia?.(QUERY) : undefined)

/** Celular = modo consulta: só Início (estatísticas) e Semana (calendário). */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => !!mq()?.matches)
  useEffect(() => {
    const m = mq()
    if (!m) return
    const on = () => setPhone(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return phone
}

/** Rotas que o celular mostra; o resto volta para o Início. */
export const PHONE_ROUTES = ['/', '/calendario', '/checkin']
export const isPhoneRoute = (path: string) => PHONE_ROUTES.some((r) => (r === '/' ? path === '/' : path.startsWith(r)))
