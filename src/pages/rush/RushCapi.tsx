import { useEffect, useRef, useState } from 'react'
import { Capybara, type CapiPose } from '../../components/Capybara'
import { onTalk, say, sfx } from './actions'

export type CapiMood = 'idle' | 'think' | 'happy' | 'sad' | 'sleepy' | 'cool' | 'boss'
const POSE: Record<CapiMood, CapiPose> = {
  idle: 'focado',
  think: 'pensando',
  happy: 'comemorando',
  sad: 'chorando',
  sleepy: 'dormindo',
  cool: 'formado',
  boss: 'focado',
}

/** A Capi do Rush: muda de pose com o momento e fala num balão (digitando). */
export function RushCapi({ mood, size = 86, talk = true, side = 'left', heat = 0 }: { mood: CapiMood; size?: number; talk?: boolean; side?: 'left' | 'right'; heat?: number }) {
  const [line, setLine] = useState('')
  const [shown, setShown] = useState('')
  const [squish, setSquish] = useState(0)
  const hide = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!talk) return
    return onTalk((l) => {
      setLine(l)
      setShown('')
      sfx('blip')
      window.clearTimeout(hide.current)
      hide.current = window.setTimeout(() => setLine(''), 7000)
    })
  }, [talk])

  // efeito de digitação
  useEffect(() => {
    if (!line || shown.length >= line.length) return
    const t = window.setTimeout(() => setShown(line.slice(0, shown.length + 1)), 16)
    return () => window.clearTimeout(t)
  }, [line, shown])

  const hot = heat >= 0.7 || mood === 'boss'
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="Cutucar a Capi"
        onClick={() => {
          setSquish((n) => n + 1)
          sfx('pop')
          say('click')
        }}
        className="essential-motion relative block transition hover:-translate-y-0.5"
      >
        {hot && <span className="rk-pulse absolute inset-2 rounded-full bg-[radial-gradient(circle,rgba(255,80,40,.45),transparent_70%)]" />}
        <span key={squish} className={squish ? 'rush-squish inline-block' : 'inline-block'}>
          <Capybara pose={POSE[mood]} size={size} className={mood === 'idle' || mood === 'cool' ? 'capi-bob' : ''} />
        </span>
      </button>
      {talk && line && (
        <div
          role="status"
          className={`capi-pop absolute top-1 z-10 w-max max-w-[min(260px,55vw)] rounded-2xl border px-3 py-2 text-[13px] leading-snug font-bold shadow-[0_8px_20px_-10px_rgba(16,24,40,.35)] ${side === 'left' ? 'right-full mr-2 rounded-br-md' : 'left-full ml-2 rounded-bl-md'} ${hot ? 'border-rose-400 bg-[#2a0409] text-rose-100' : 'border-line bg-white text-ink'}`}
        >
          {shown}
        </div>
      )}
    </div>
  )
}
