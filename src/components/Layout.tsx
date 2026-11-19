import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, Brain, ChevronDown, FileQuestion, CalendarRange, House, Layers, Settings, Waypoints } from 'lucide-react'
import { db } from '../db/db'
import { currentWeekId } from '../db/repo'
import { addDays } from '../lib/dates'
import { isPhoneRoute, useIsPhone } from '../lib/phone'
import { TimerPill } from './TimerPill'
import { Logo } from './Logo'
import { SyncBadge } from './SyncBadge'
import { useSyncStatus } from '../lib/cloud'
import { MascotHost } from './MascotHost'

const NAV = [
  { to: '/', label: 'Início', icon: House },
  { to: '/calendario', label: 'Semana', icon: CalendarRange },
  { to: '/recuperacao', label: 'Recuperação', icon: Brain },
  { to: '/questoes', label: 'Questões', icon: FileQuestion },
  { to: '/caderno', label: 'Caderno', icon: BookOpen },
]
/** Itens secundários: ficam no menu "Mais" para o topo nunca precisar de rolagem. */
const MORE = [
  { to: '/mapa', label: 'Mapa mental', hint: 'Suas notas conectadas', icon: Waypoints },
  { to: '/materias', label: 'Matérias', hint: 'Áreas, matérias e tópicos', icon: Layers },
  { to: '/config', label: 'Ajustes', hint: 'Perfil, planejador e backup', icon: Settings },
]

/** Rotas que não exigem o check-in feito (para poder cadastrar antes). */
const FREE_ROUTES = ['/checkin', '/materias', '/config']

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const weekId = currentWeekId()
  // No fim de semana, a próxima semana já planejada também libera o site
  const status = useLiveQuery(async () => ({ week: (await db.weeks.get(weekId)) ?? (await db.weeks.get(addDays(weekId, 7))) }), [weekId])
  const sync = useSyncStatus()
  const phone = useIsPhone()

  // Celular: só Início e Semana; qualquer outra tela volta para o Início
  useEffect(() => {
    if (phone && !isPhoneRoute(location.pathname)) navigate('/', { replace: true })
  }, [phone, location.pathname, navigate])

  useEffect(() => {
    // Espera a nuvem responder: em outro dispositivo a semana pode já existir lá
    if (sync === 'carregando') return
    if (status && !status.week && !FREE_ROUTES.includes(location.pathname)) navigate('/checkin', { replace: true })
  }, [status, sync, location.pathname, navigate])

  if (phone)
    return (
      <div className="min-h-full pb-20">
        <header className="sticky top-0 z-40 border-b border-line bg-canvas">
          <div className="flex h-14 items-center justify-between gap-2 px-3">
            <NavLink to="/" className="flex shrink-0 items-center" aria-label="Mendonça, início">
              <Logo />
            </NavLink>
            <span className="font-mono text-[11px] tracking-wider text-muted uppercase">consulta</span>
            <div className="flex items-center gap-2">
              <SyncBadge />
            </div>
          </div>
        </header>
        <main key={`/${location.pathname.split('/')[1]}`} className="page-in px-3 py-4">
          <Outlet />
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t border-ink bg-canvas" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} aria-label="Navegação">
          {NAV.slice(0, 2).map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `py-3.5 text-center text-sm font-semibold ${isActive ? 'text-ink underline decoration-brand decoration-2 underline-offset-[6px]' : 'text-muted'}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        <MascotHost />
      </div>
    )

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex h-[60px] max-w-[1240px] items-stretch gap-2 px-3 sm:gap-4 sm:px-4">
          <NavLink to="/" className="flex shrink-0 items-center" aria-label="Mendonça, início">
            <Logo />
          </NavLink>
          <nav className="flex min-w-0 flex-1 items-stretch justify-center gap-1 lg:gap-3">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                title={label}
                aria-label={label}
                className={({ isActive }) =>
                  `relative flex items-center px-2 text-[14px] font-semibold whitespace-nowrap transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] ${
                    isActive ? 'text-ink after:bg-brand' : 'text-muted after:bg-transparent hover:text-ink'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <MoreMenu />
          </nav>
          <div className="flex items-center gap-2">
            <SyncBadge />
            <TimerPill />
          </div>
        </div>
      </header>
      {/* A chave muda a cada página: o conteúdo entra com um deslizar suave */}
      <main key={`/${location.pathname.split('/')[1]}`} className="page-in mx-auto max-w-[1240px] px-4 py-6">
        <Outlet />
      </main>
      <MascotHost />
    </div>
  )
}

function MoreMenu() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = MORE.some((m) => location.pathname.startsWith(m.to))
  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <div ref={ref} className="relative flex items-stretch">
      <button
        onClick={() => setOpen(!open)}
        title="Mais páginas"
        aria-expanded={open}
        aria-haspopup="menu"
        className={`relative flex items-center gap-1 px-2 text-[14px] font-semibold whitespace-nowrap transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] ${
          active ? 'text-ink after:bg-brand' : 'text-muted after:bg-transparent hover:text-ink'
        }`}
      >
        Mais
        <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-50 w-56 border border-ink bg-paper py-1 shadow-xl">
          {MORE.map(({ to, label, hint }) => {
            const on = location.pathname.startsWith(to)
            return (
              <button key={to} role="menuitem" onClick={() => navigate(to)} className={`block w-full border-l-2 px-4 py-2.5 text-left transition-colors ${on ? 'border-brand bg-brand-soft/50' : 'border-transparent hover:bg-[#f4f4f2]'}`}>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
