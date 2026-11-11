import type { CapiPose } from '../components/Capybara'

export interface MascotAction {
  label: string
  primary?: boolean
  /** Rota para abrir, ou função a executar. */
  to?: string
  run?: () => void | Promise<void>
}

export interface MascotMessage {
  pose: CapiPose
  title?: string
  text: string
  actions?: MascotAction[]
  /** Fecha sozinho depois de N ms. */
  autoHideMs?: number
}

type Listener = (m: MascotMessage) => void
const listeners = new Set<Listener>()

/** Faz o Capi aparecer com uma mensagem, de qualquer lugar do app. */
// Pergunta "fez questões?" ao concluir um bloco
type QListener = (blockId: string) => void
const qListeners = new Set<QListener>()
export function askBlockQuestions(blockId: string) {
  qListeners.forEach((l) => l(blockId))
}
export function onAskBlockQuestions(l: QListener) {
  qListeners.add(l)
  return () => {
    qListeners.delete(l)
  }
}

export function showMascot(m: MascotMessage) {
  listeners.forEach((l) => l(m))
}

export function onMascot(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
