import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, Brain, ChevronDown, FileQuestion, CalendarRange, House, Layers, LayoutGrid, Settings, Waypoints } from 'lucide-react'
import { db } from '../db/db'
import { currentWeekId } from '../db/repo'
import { addDays } from '../lib/dates'
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

  useEffect(() => {
    // Espera a nuvem responder: em outro dispositivo a semana pode já existir lá
    if (sync === 'carregando') return
    if (status && !status.week && !FREE_ROUTES.includes(location.pathname)) navigate('/checkin', { replace: true })
  }, [status, sync, location.pathname, navigate])

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex h-[68px] max-w-[1240px] items-stretch gap-2 px-3 sm:gap-4 sm:px-4">
          <NavLink to="/" className="flex shrink-0 items-center" aria-label="Mendonça, início">
            <Logo />
          </NavLink>
          <nav className="flex min-w-0 flex-1 items-stretch justify-center gap-0.5 lg:gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                title={label}
                aria-label={label}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 px-2 text-[13.5px] font-semibold lg:px-2.5 whitespace-nowrap transition after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full ${
                    isActive ? 'text-brand after:bg-brand' : 'text-slate-700 after:bg-transparent hover:text-ink'
                  }`
                }
              >
                <Icon size={18} strokeWidth={2} />
                <span className="hidden lg:inline">{label}</span>
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
        className={`relative flex items-center gap-1.5 px-2 text-[13.5px] font-semibold whitespace-nowrap transition after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full lg:px-2.5 ${
          active ? 'text-brand after:bg-brand' : 'text-slate-700 after:bg-transparent hover:text-ink'
        }`}
      >
        <LayoutGrid size={18} />
        <span className="hidden lg:inline">Mais</span>
        <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="capi-pop absolute top-[calc(100%+6px)] right-0 z-50 w-64 rounded-2xl border border-line bg-white p-1.5 shadow-[0_20px_40px_-16px_rgba(16,24,40,0.35)]">
          {MORE.map(({ to, label, hint, icon: Icon }) => {
            const on = location.pathname.startsWith(to)
            return (
              <button key={to} role="menuitem" onClick={() => navigate(to)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${on ? 'bg-brand-soft' : 'hover:bg-slate-50'}`}>
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${on ? 'bg-brand text-white' : 'bg-[#f1f2f5] text-slate-600'}`}>
                  <Icon size={18} />
                </span>
                <span>
                  <span className={`block text-sm font-bold ${on ? 'text-brand' : ''}`}>{label}</span>
                  <span className="block text-[11px] text-muted">{hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
