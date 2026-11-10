import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, CalendarDays, Home, Layers, Settings } from 'lucide-react'
import { db } from '../db/db'
import { currentWeekId } from '../db/repo'
import { TimerPill } from './TimerPill'

const NAV = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/calendario', label: 'Semana', icon: CalendarDays },
  { to: '/caderno', label: 'Caderno', icon: BookOpen },
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

  useEffect(() => {
    if (status && !status.week && !FREE_ROUTES.includes(location.pathname)) navigate('/checkin', { replace: true })
  }, [status, location.pathname, navigate])

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-line bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <NavLink to="/" className="flex shrink-0 items-center gap-2">
            <img src="/icon.svg" alt="" className="h-9 w-9" />
            <span className="hidden text-lg font-extrabold tracking-tight lg:inline">Mendonça</span>
          </NavLink>
          <nav className="flex flex-1 items-center justify-center gap-1 overflow-x-auto">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <Icon size={18} />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
          <TimerPill />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
