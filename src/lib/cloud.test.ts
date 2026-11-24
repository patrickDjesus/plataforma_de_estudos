import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'

// Banco local apagado pelo navegador, mas os carimbos de sincronização (localStorage) sobraram:
// a nuvem tem que repor o que falta em vez de achar que "já tem".
describe('sincronização com a nuvem do claude.ai', () => {
  it('repõe registros que sumiram do banco local mesmo com carimbo antigo', async () => {
    const store = new Map<string, string>([['mendonca-sync-stamps', JSON.stringify({ 'notes~n1': 500 })]])
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) })
    const docs = [{ id: 'notes~n1', data: () => ({ t: 'notes', id: 'n1', u: 500, v: { id: 'n1', subjectId: 's', title: 'SGBD', content: '<p>oi</p>', updatedAt: 1 } }) }]
    const col = {
      onSnapshot: (ok: (s: unknown) => void) => setTimeout(() => ok({ metadata: { fromCache: false }, docs, docChanges: () => [] }), 0),
      doc: () => ({ set: async () => {}, delete: async () => {} }),
    }
    vi.stubGlobal('window', Object.assign(globalThis, { claude: { use: async (c: string) => (c === 'db' ? { collection: () => col } : { id: async () => 'u1' }) } }))
    const { startCloudSync } = await import('./cloud')
    const { db } = await import('../db/db')
    await startCloudSync()
    await vi.waitFor(async () => expect((await db.notes.get('n1'))?.title).toBe('SGBD'))
  })
})
