import { useEffect, useState } from 'react'
import { Check, Pause, Play, Square, Timer } from 'lucide-react'
import { useTimer } from '../db/hooks'
import { elapsedOf, pauseTimer, resumeTimer, stopTimer } from '../db/repo'
import { fmtClock } from '../lib/dates'

export function TimerPill() {
  const timer = useTimer()
  const [, tick] = useState(0)
  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(i)
  }, [])

  if (!timer) {
    return (
      <div className="hidden items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-400 sm:flex">
        <Timer size={16} /> 00:00:00
      </div>
    )
  }
  const running = !!timer.startedAt
  return (
    <div className="flex items-center gap-1 rounded-full bg-slate-900 py-1 pl-4 pr-1 text-sm font-semibold text-white shadow-lg shadow-slate-900/20">
      <span className={`mr-1 h-2 w-2 rounded-full ${running ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'}`} />
      <span className="hidden max-w-40 truncate text-slate-300 md:inline" title={timer.label}>
        {timer.label}
      </span>
      <span className="mx-2 tabular-nums">{fmtClock(elapsedOf(timer))}</span>
      <button onClick={() => (running ? pauseTimer() : resumeTimer())} className="rounded-full p-1.5 hover:bg-white/10" title={running ? 'Pausar' : 'Continuar'}>
        {running ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <button onClick={() => stopTimer(false)} className="rounded-full p-1.5 hover:bg-white/10" title="Parar e salvar">
        <Square size={15} />
      </button>
      {timer.blockId && (
        <button onClick={() => stopTimer(true)} className="rounded-full bg-emerald-500 p-1.5 hover:bg-emerald-400" title="Concluir bloco">
          <Check size={15} />
        </button>
      )}
    </div>
  )
}
