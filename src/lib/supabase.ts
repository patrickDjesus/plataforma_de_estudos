/**
 * Supabase do site próprio (Vercel): login por link no e-mail e o cliente usado na sincronização.
 * Só liga quando a URL e a chave pública do projeto estão nas variáveis de ambiente do build;
 * no claude.ai (build do Artifact) nada disso carrega.
 */
import { useSyncExternalStore } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

const env = import.meta.env as Record<string, string | undefined>
const URL = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

/** Tabela onde cada registro do app vira uma linha (ver docs-supabase.md). */
export const SUPABASE_TABLE = 'mendonca_docs'

export const supabaseConfigured = Boolean(URL && KEY) && !env.VITE_ARTIFACT

let client: Promise<SupabaseClient> | null = null
export function getSupabase(): Promise<SupabaseClient> {
  if (!supabaseConfigured) return Promise.reject(new Error('Supabase não configurado'))
  client ??= import('@supabase/supabase-js').then(({ createClient }) => {
    const sb = createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    sb.auth.onAuthStateChange((_event, session) => setEmail(session?.user.email ?? null))
    void sb.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null))
    return sb
  })
  return client
}

// ---- E-mail de quem está logado (observável) ----
let email: string | null = null
const listeners = new Set<() => void>()
function setEmail(e: string | null) {
  if (e === email) return
  email = e
  listeners.forEach((l) => l())
}
export function useAuthEmail() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => email,
  )
}

/** Token de login atual, para chamar a função de IA. */
export async function getAccessToken(): Promise<string | null> {
  if (!supabaseConfigured) return null
  const sb = await getSupabase()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

/** Manda o link de entrada para o e-mail. */
export async function sendLoginLink(address: string): Promise<string | null> {
  const sb = await getSupabase()
  const { error } = await sb.auth.signInWithOtp({ email: address.trim(), options: { emailRedirectTo: window.location.origin } })
  return error ? error.message : null
}

export async function signOut() {
  const sb = await getSupabase()
  await sb.auth.signOut()
}
