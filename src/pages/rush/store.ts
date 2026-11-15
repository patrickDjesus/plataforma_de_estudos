import { useSyncExternalStore } from 'react'
import { defaultRushState, hydrateRush, type RushState } from '../../lib/rush'

/*
 * Estado do Rush: fica neste aparelho (localStorage), como um jogo em andamento.
 * O que importa para as estatísticas (questões feitas, acertos, erros) vai para o
 * banco do Mendonça e sincroniza normalmente.
 */
const KEY = 'mendonca-rush-v1'

function load(): RushState {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? hydrateRush(JSON.parse(raw)) : defaultRushState()
  } catch {
    return defaultRushState()
  }
}

let S: RushState = load()
const subs = new Set<() => void>()

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S))
  } catch {
    /* armazenamento cheio ou bloqueado: segue só na memória */
  }
}

export const rush = {
  get: () => S,
  set(next: RushState) {
    S = next
    save()
    subs.forEach((f) => f())
  },
  /** Muda uma cópia e publica (os componentes só veem estados completos). */
  update<T>(fn: (d: RushState) => T): T {
    const d = structuredClone(S)
    const out = fn(d)
    rush.set(d)
    return out
  },
  subscribe(f: () => void) {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  },
}

export function useRush(): RushState {
  return useSyncExternalStore(rush.subscribe, rush.get)
}

// ---------- Estado de execução (não salvo): tarefas de IA em andamento ----------
export interface Task {
  id: string
  label: string
  family?: string
  n?: number
}
export interface Runtime {
  tasks: Task[]
  freshInFlight: number
  fillError: string | null
  aiFatal: string | null
  aiReady: 'carregando' | 'ok' | 'sem'
}
let R: Runtime = { tasks: [], freshInFlight: 0, fillError: null, aiFatal: null, aiReady: 'carregando' }
const rsubs = new Set<() => void>()
export const runtime = {
  get: () => R,
  update(patch: Partial<Runtime> | ((r: Runtime) => Partial<Runtime>)) {
    R = { ...R, ...(typeof patch === 'function' ? patch(R) : patch) }
    rsubs.forEach((f) => f())
  },
  subscribe(f: () => void) {
    rsubs.add(f)
    return () => {
      rsubs.delete(f)
    }
  },
}
export function useRuntime(): Runtime {
  return useSyncExternalStore(runtime.subscribe, runtime.get)
}
export const generatingFor = (fam: string) => R.tasks.filter((t) => t.family === fam).reduce((a, t) => a + (t.n ?? 0), 0)
