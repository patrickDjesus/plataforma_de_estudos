/**
 * Sincronização com a nuvem do claude.ai (capacidade `db` do Artifact).
 *
 * O IndexedDB continua sendo a fonte local (rápido e funciona offline).
 * Cada registro alterado é espelhado como um documento na área PRIVADA do
 * usuário (`data/users/<id>/`), e mudanças de outros dispositivos chegam ao vivo.
 * Conflitos: vence a alteração mais recente (carimbo de tempo por registro).
 */
import { useSyncExternalStore } from 'react'
import { db } from '../db/db'

// ---- Tipos mínimos da API do claude.ai (contrato 0.2.x) ----
type DocSnap = { id: string; exists: boolean; data(): Record<string, unknown> | undefined }
type QuerySnap = { docs: DocSnap[]; docChanges(): { type: 'added' | 'modified' | 'removed'; doc: DocSnap }[]; metadata: { fromCache: boolean } }
type DocRef = { set(d: Record<string, unknown>): Promise<void> }
type ColRef = { doc(id: string): DocRef; onSnapshot(next: (s: QuerySnap) => void, err?: (e: { code: string }) => void): () => void }
type CloudDB = { collection(path: string): ColRef }
type CloudUser = { id(): Promise<string | null> }
/** Capacidade `sample`: pedir ao Claude pela conta de quem está vendo a página. */
export type SampleOpts = { modelTier?: 'quick' | 'default' | 'complex'; signal?: AbortSignal; onText?: (u: { text: string; delta: string }) => void; cache?: boolean }
export type ClaudeSample = ((input: string, opts?: SampleOpts) => Promise<{ text: string; truncated?: boolean }>) & { json<T>(input: string, opts?: SampleOpts): Promise<T> }
declare global {
  interface Window {
    claude?: { use(name: 'db'): Promise<CloudDB | null>; use(name: 'user'): Promise<CloudUser | null>; use(name: 'sample'): Promise<ClaudeSample | null> }
  }
}

export const SYNCED_TABLES = ['subjects', 'topics', 'notes', 'weeks', 'blocks', 'sessions', 'settings', 'reviews', 'mapPositions', 'mapLinks', 'achievements', 'cards'] as const
type TableName = (typeof SYNCED_TABLES)[number]

// ---- Estado observável ----
export type SyncStatus = 'carregando' | 'sincronizado' | 'enviando' | 'local' | 'erro'
let status: SyncStatus = 'carregando'
let lastError = ''
const listeners = new Set<() => void>()
function setStatus(s: SyncStatus, err = '') {
  status = s
  lastError = err
  listeners.forEach((l) => l())
}
export function useSyncStatus() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
  )
}
export const syncError = () => lastError

// ---- Carimbos locais e fila de envio (localStorage) ----
const STAMPS = 'mendonca-sync-stamps'
const OUTBOX = 'mendonca-sync-outbox'
const readJSON = <T,>(k: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? '') as T
  } catch {
    return fallback
  }
}
const writeJSON = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* armazenamento indisponível: segue só em memória */
  }
}
const stamps: Record<string, number> = readJSON(STAMPS, {})
const outbox = new Set<string>(readJSON<string[]>(OUTBOX, []))
const saveMeta = () => {
  writeJSON(STAMPS, stamps)
  writeJSON(OUTBOX, [...outbox])
}

const keyOf = (table: string, id: string) => `${table}~${id}`
const parseKey = (key: string) => {
  const i = key.indexOf('~')
  return { table: key.slice(0, i) as TableName, id: key.slice(i + 1) }
}

// ---- Captura de mudanças locais (ganchos do Dexie) ----
let applyingRemote = 0
let flushTimer: number | undefined
let cloudCol: ColRef | null = null

function markDirty(table: string, id: unknown) {
  if (applyingRemote || id === undefined || id === null) return
  const key = keyOf(table, String(id))
  stamps[key] = Date.now()
  outbox.add(key)
  saveMeta()
  scheduleFlush()
}

let hooksInstalled = false
function installHooks() {
  if (hooksInstalled) return
  hooksInstalled = true
  for (const t of SYNCED_TABLES) {
    const table = db.table(t)
    table.hook('creating', function (primKey, obj) {
      const pk = primKey ?? (obj as Record<string, unknown>)[table.schema.primKey.keyPath as string]
      this.onsuccess = () => markDirty(t, pk)
    })
    table.hook('updating', function (_mods, primKey) {
      this.onsuccess = () => markDirty(t, primKey)
    })
    table.hook('deleting', function (primKey) {
      this.onsuccess = () => markDirty(t, primKey)
    })
  }
}

// ---- Envio ----
function scheduleFlush(delay = 1200) {
  if (!cloudCol) return
  window.clearTimeout(flushTimer)
  flushTimer = window.setTimeout(flush, delay)
}

let flushing = false
let backoff = 2000
async function flush() {
  if (!cloudCol || flushing || outbox.size === 0) return
  flushing = true
  setStatus('enviando')
  try {
    for (const key of [...outbox]) {
      const { table, id } = parseKey(key)
      const rec = await db.table(table).get(id)
      const u = stamps[key] ?? Date.now()
      const body = rec ? { t: table, id, u, v: JSON.parse(JSON.stringify(rec)) } : { t: table, id, u, del: true }
      await cloudCol.doc(key).set(body)
      if ((stamps[key] ?? u) === u) outbox.delete(key)
      saveMeta()
    }
    backoff = 2000
    setStatus('sincronizado')
  } catch (e) {
    const code = (e as { code?: string })?.code ?? 'unavailable'
    setStatus('erro', code === 'quota_exceeded' ? 'A nuvem está cheia. Exporte um backup e apague dados antigos.' : 'Não consegui enviar agora. Vou tentar de novo.')
    if (code !== 'invalid_argument' && code !== 'quota_exceeded') {
      backoff = Math.min(backoff * 2, 60000)
      scheduleFlush(backoff)
    }
  } finally {
    flushing = false
    if (outbox.size && status !== 'erro') scheduleFlush(300)
  }
}

// ---- Recebimento ----
async function applyRemote(docs: DocSnap[]) {
  const puts = new Map<TableName, unknown[]>()
  const dels = new Map<TableName, string[]>()
  for (const d of docs) {
    const body = d.data() as { t?: TableName; id?: string; u?: number; v?: unknown; del?: boolean } | undefined
    if (!body?.t || !body.id || !SYNCED_TABLES.includes(body.t)) continue
    const key = keyOf(body.t, body.id)
    const u = Number(body.u ?? 0)
    if ((stamps[key] ?? 0) >= u) continue // a versão local é igual ou mais nova
    stamps[key] = u
    outbox.delete(key)
    if (body.del) dels.set(body.t, [...(dels.get(body.t) ?? []), body.id])
    else puts.set(body.t, [...(puts.get(body.t) ?? []), body.v])
  }
  if (!puts.size && !dels.size) return
  applyingRemote++
  try {
    await db.transaction('rw', SYNCED_TABLES.map((t) => db.table(t)), async () => {
      for (const [t, list] of puts) await db.table(t).bulkPut(list)
      for (const [t, ids] of dels) await db.table(t).bulkDelete(ids)
    })
  } finally {
    applyingRemote--
    saveMeta()
  }
}

/** Primeira sincronização deste navegador: tudo que só existe aqui sobe. */
async function seedOutbox() {
  for (const t of SYNCED_TABLES) {
    const table = db.table(t)
    const keys = await table.toCollection().primaryKeys()
    for (const k of keys) {
      const key = keyOf(t, String(k))
      if (stamps[key] === undefined) {
        stamps[key] = 1 // mais antigo que qualquer alteração remota
        outbox.add(key)
      }
    }
  }
  saveMeta()
}

let started = false
/** Liga a sincronização se a página estiver rodando no claude.ai. */
export async function startCloudSync() {
  if (started) return
  started = true
  installHooks()
  const claude = window.claude
  if (!claude?.use) return setStatus('local')
  const [cdb, user] = await Promise.all([claude.use('db').catch(() => null), claude.use('user').catch(() => null)])
  const uid = user ? await user.id().catch(() => null) : null
  if (!cdb || !uid) return setStatus('local')
  const col = cdb.collection(`data/users/${uid}`)

  let first = true
  const timeout = window.setTimeout(() => {
    if (first) setStatus('erro', 'A nuvem ainda não respondeu. Seus dados continuam salvos neste navegador.')
  }, 10000)
  col.onSnapshot(
    async (snap) => {
      if (first) {
        if (snap.metadata.fromCache) {
          await applyRemote(snap.docs)
          return
        }
        first = false
        window.clearTimeout(timeout)
        await applyRemote(snap.docs)
        await seedOutbox()
        cloudCol = col
        setStatus(outbox.size ? 'enviando' : 'sincronizado')
        scheduleFlush(200)
        return
      }
      await applyRemote(snap.docChanges().filter((c) => c.type !== 'removed').map((c) => c.doc))
    },
    (e) => {
      window.clearTimeout(timeout)
      setStatus('erro', e.code === 'revoked' ? 'O acesso à nuvem foi encerrado nesta página.' : 'Perdi a conexão com a nuvem. Seus dados continuam salvos neste navegador.')
    },
  )
}
