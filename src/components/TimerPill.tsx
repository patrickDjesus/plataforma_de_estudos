import { useEffect, useState } from 'react'
import { Check, Pause, Play, Square, Timer } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useTimer } from '../db/hooks'
import { elapsedOf, pauseTimer, resumeTimer, stopTimer } from '../db/repo'
import { fmtClock } from '../lib/dates'

/** Pílula escura do cronômetro, com anel mostrando o progresso do bloco. */
export function TimerPill() {
  const timer = useTimer()
  const block = useLiveQuery(() => (timer?.blockId ? db.blocks.get(timer.blockId) : undefined), [timer?.blockId])
  const [, tick] = useState(0)
  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(i)
  }, [])

  const elapsed = timer ? elapsedOf(timer) : 0
  const goal = block ? (block.end - block.start) * 60 : 0
  const progress = goal ? Math.min(1, (elapsed + (block?.studiedSeconds ?? 0)) / goal) : timer ? 1 : 0
  const running = !!timer?.startedAt

  return (
    <div className="flex items-center gap-1 rounded-full bg-[#16181d] py-1 pr-1 pl-1 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)]">
      <span
        className="grid h-8 w-8 place-items-center rounded-full"
        style={{ background: `conic-gradient(#7c8cff ${progress * 360}deg, #3a3d46 0deg)` }}
        title={goal ? `${Math.round(progress * 100)}% do bloco` : undefined}
      >
        <span className={`h-5 w-5 rounded-full bg-[#16181d] ${running ? 'animate-pulse' : ''}`} />
      </span>
      {timer && (
        <span className="hidden max-w-36 truncate pl-1.5 text-xs font-medium text-slate-400 md:inline" title={timer.label}>
          {timer.label}
        </span>
      )}
      <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 tabular-nums">
        <Timer size={15} className="text-slate-400" />
        {fmtClock(elapsed)}
      </span>
      {timer && (
        <>
          <button onClick={() => (running ? pauseTimer() : resumeTimer())} className="rounded-full p-1.5 hover:bg-white/10" title={running ? 'Pausar' : 'Continuar'}>
            {running ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button onClick={() => stopTimer(false)} className="rounded-full p-1.5 hover:bg-white/10" title="Parar e salvar">
            <Square size={14} />
          </button>
          {timer.blockId && (
            <button onClick={() => stopTimer(true)} className="rounded-full bg-emerald-500 p-1.5 hover:bg-emerald-400" title="Concluir bloco">
              <Check size={15} />
            </button>
          )}
        </>
      )}
    </div>
  )
}
