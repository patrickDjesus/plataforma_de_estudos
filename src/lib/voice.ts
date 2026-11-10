/**
 * "Tomada" de voz: transforma fala em texto.
 * - No claude.ai: capacidade `dictation` (pede permissão uma vez).
 * - Site próprio: reconhecimento de voz do navegador (Chrome/Edge), se existir.
 */
export interface VoiceHandlers {
  onPartial: (text: string) => void
  onFinal: (text: string) => void
  onEnd: (reason?: string) => void
}
export interface VoiceEngine {
  /** Chame direto do clique (sem nada aguardado antes). */
  start(h: VoiceHandlers): void
  stop(): void
}

type ClaudeDictation = {
  start(o?: { language?: string }): Promise<void>
  stop(): Promise<void>
  onPartial(h: (e: { text: string }) => void): () => void
  onFinal(h: (e: { text: string }) => void): () => void
  onState(h: (e: { state: string; reason?: string }) => void): () => void
}

function claudeEngine(d: ClaudeDictation): VoiceEngine {
  let offs: (() => void)[] = []
  const cleanup = () => {
    offs.forEach((o) => o())
    offs = []
  }
  return {
    start(h) {
      cleanup()
      let started = false
      offs.push(d.onPartial(({ text }) => h.onPartial(text)))
      offs.push(d.onFinal(({ text }) => h.onFinal(text)))
      offs.push(
        d.onState(({ state, reason }) => {
          if (state !== 'idle') started = true
          if (state === 'idle' && started) {
            cleanup()
            h.onEnd(reason)
          }
        }),
      )
      d.start({ language: 'pt-BR' }).catch((e: { code?: string }) => {
        cleanup()
        h.onEnd(e?.code)
      })
    },
    stop() {
      d.stop().catch(() => undefined)
    },
  }
}

type SR = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

function browserEngine(Ctor: new () => SR): VoiceEngine {
  let rec: SR | null = null
  return {
    start(h) {
      rec = new Ctor()
      rec.lang = 'pt-BR'
      rec.interimResults = true
      rec.continuous = true
      let err: string | undefined
      rec.onresult = (e) => {
        let partial = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) h.onFinal(r[0].transcript.trim())
          else partial += r[0].transcript
        }
        h.onPartial(partial)
      }
      rec.onerror = (e) => (err = e.error)
      rec.onend = () => h.onEnd(err)
      rec.start()
    },
    stop() {
      rec?.stop()
    },
  }
}

let cached: Promise<VoiceEngine | null> | null = null
export function getVoice(): Promise<VoiceEngine | null> {
  if (cached) return cached
  cached = (async () => {
    const claude = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude
    if (claude?.use) {
      const d = (await claude.use('dictation').catch(() => null)) as ClaudeDictation | null
      return d ? claudeEngine(d) : null
    }
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    return Ctor ? browserEngine(Ctor) : null
  })()
  return cached
}

export const VOICE_ERRORS: Record<string, string> = {
  not_granted: 'Você não permitiu o microfone. Dá para liberar nas permissões do artefato.',
  'not-allowed': 'O navegador bloqueou o microfone.',
  unavailable: 'Ditado indisponível neste navegador. Use o Chrome, o Edge ou o app do Claude no computador.',
  no_gesture: 'Clique no microfone para começar.',
}
