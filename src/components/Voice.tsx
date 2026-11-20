import { useEffect, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { Mic, Square } from 'lucide-react'
import { getVoice, VOICE_ERRORS, type VoiceEngine } from '../lib/voice'
import { Fx } from './Fx'

/** Indicador de carregamento animado (continua girando mesmo com "reduzir movimento"). */
export function Spinner({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <span className="essential-motion inline-flex items-center gap-[3px]" style={{ height: size }} role="status" aria-label="Carregando">
      {[0, 1, 2].map((i) => (
        <span key={i} className="spinner-dot rounded-full" style={{ width: size / 3.2, height: size / 3.2, background: color, animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  )
}

/** Botão de microfone: o que você fala vira texto (anexado ao campo). */
export function MicButton({ onFinal, onPartial, color = '#3e63f2', className = '' }: { onFinal: (t: string) => void; onPartial?: (t: string) => void; color?: string; className?: string }) {
  const [engine, setEngine] = useState<VoiceEngine | null>(null)
  const [on, setOn] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    getVoice().then(setEngine)
  }, [])
  useEffect(() => () => engine?.stop(), [engine])
  if (!engine) return null

  const toggle = () => {
    if (on) {
      engine.stop()
      return
    }
    setMsg('')
    setOn(true)
    engine.start({
      onPartial: (t) => onPartial?.(t),
      onFinal: (t) => t && onFinal(t),
      onEnd: (reason) => {
        setOn(false)
        onPartial?.('')
        if (reason && VOICE_ERRORS[reason]) setMsg(VOICE_ERRORS[reason])
      },
    })
  }
  return (
    <span className={`inline-flex flex-col items-end ${className}`}>
      <button
        type="button"
        onClick={toggle}
        className={`essential-motion relative grid h-10 w-10 place-items-center rounded-full text-white shadow-md transition hover:scale-105 ${on ? 'mic-live' : ''}`}
        style={{ background: on ? '#ef4444' : color }}
        title={on ? 'Parar de ditar' : 'Falar em vez de digitar'}
        aria-label={on ? 'Parar de ditar' : 'Ditar por voz'}
      >
        {on ? <Square size={14} fill="currentColor" /> : <Mic size={18} />}
      </button>
      {msg && <span className="mt-1 max-w-56 text-right text-[11px] text-rose-600">{msg}</span>}
    </span>
  )
}

/** Campo de texto com microfone: digite ou fale. */
export function VoiceTextarea({ value, onValue, color, ...rest }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & { value: string; onValue: (v: string) => void; color?: string }) {
  const [partial, setPartial] = useState('')
  const ref = useRef(value)
  ref.current = value
  return (
    <div className="relative">
      <textarea {...rest} value={value} onChange={(e) => onValue(e.target.value)} className={`${rest.className ?? ''} pr-14`} />
      <MicButton
        color={color}
        className="absolute right-2.5 bottom-2.5"
        onPartial={setPartial}
        onFinal={(t) => {
          const cur = ref.current
          onValue(cur + (cur && !/\s$/.test(cur) ? ' ' : '') + t)
        }}
      />
      {partial && <p className="mt-1 text-xs text-muted italic"><Fx name="mic" /> {partial}…</p>}
    </div>
  )
}
