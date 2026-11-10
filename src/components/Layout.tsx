import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, CalendarRange, House, Layers, Settings, Waypoints } from 'lucide-react'
import { db } from '../db/db'
import { currentWeekId } from '../db/repo'
import { TimerPill } from './TimerPill'
import { Logo } from './Logo'
import { SyncBadge } from './SyncBadge'
import { useSyncStatus } from '../lib/cloud'
import { MascotHost } from './MascotHost'

const NAV = [
  { to: '/', label: 'Início', icon: House },
  { to: '/calendario', label: 'Semana', icon: CalendarRange },
  { to: '/caderno', label: 'Caderno', icon: BookOpen },
  { to: '/mapa', label: 'Mapa', icon: Waypoints },
  { to: '/materias', label: 'Matérias', icon: Layers },
  { to: '/config', label: 'Ajustes', icon: Settings },
]

/** Rotas que não exigem o check-in feito (para poder cadastrar antes). */
const FREE_ROUTES = ['/checkin', '/materias', '/config']

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const weekId = currentWeekId()
  const status = useLiveQuery(async () => ({ week: await db.weeks.get(weekId) }), [weekId])
  const sync = useSyncStatus()

  useEffect(() => {
    // Espera a nuvem responder: em outro dispositivo a semana pode já existir lá
    if (sync === 'carregando') return
    if (status && !status.week && !FREE_ROUTES.includes(location.pathname)) navigate('/checkin', { replace: true })
  }, [status, sync, location.pathname, navigate])

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex h-[68px] max-w-[1240px] items-stretch gap-4 px-4">
          <NavLink to="/" className="flex shrink-0 items-center" aria-label="Mendonça, início">
            <Logo />
          </NavLink>
          <nav className="thin-scroll flex flex-1 items-stretch justify-center gap-1 overflow-x-auto">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 px-3 text-sm font-semibold whitespace-nowrap transition after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full ${
                    isActive ? 'text-brand after:bg-brand' : 'text-slate-700 after:bg-transparent hover:text-ink'
                  }`
                }
              >
                <Icon size={19} strokeWidth={2} />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <SyncBadge />
            <TimerPill />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1240px] px-4 py-6">
        <Outlet />
      </main>
      <MascotHost />
    </div>
  )
}
