/**
 * "Tomada" de IA do Mendonça: o app inteiro conversa com o Claude só por aqui.
 *
 * - Hoje: capacidade `sample` do claude.ai (usa a conta de quem abre a página; sem chave de API).
 * - Site próprio: defina VITE_AI_ENDPOINT apontando para o seu servidor (ex.: /api/ia na Vercel).
 *   O servidor guarda a chave da Anthropic em segredo e repassa o pedido; o navegador nunca vê a chave.
 *   Contrato esperado do servidor: POST {prompt, tier, json} → {text}.
 */
import type { ClaudeSample } from './cloud'
import { getAccessToken } from './supabase'

export type AITier = 'quick' | 'default' | 'complex'

export interface AIOptions {
  tier?: AITier
  signal?: AbortSignal
  /** Recebe o texto inteiro até o momento, para mostrar a resposta enquanto é escrita. */
  onText?: (text: string) => void
  /** true = sempre pedir uma resposta nova (sem reaproveitar a anterior). */
  fresh?: boolean
}

export interface AIProvider {
  name: 'claude.ai' | 'servidor'
  text(prompt: string, opts?: AIOptions): Promise<string>
  json<T>(prompt: string, opts?: AIOptions): Promise<T>
}

/** Erro com mensagem pronta para mostrar (em português). */
export class AIError extends Error {
  constructor(
    public code: string,
    message: string,
    public partial?: string,
  ) {
    super(message)
  }
}

const MESSAGES: Record<string, string> = {
  not_granted: 'Você não permitiu o uso do Claude nesta página. Recarregue e permita para usar esta função.',
  rate_limited: 'Muitos pedidos ao Claude em pouco tempo (ou o limite da sua conta foi atingido). Espere um pouco e tente de novo.',
  sampling_disabled: 'O uso do Claude está desativado para a sua conta no momento.',
  cancelled: 'Pedido cancelado.',
  prompt_too_large: 'O texto enviado é grande demais. Tente com uma nota menor.',
  invalid_json: 'O Claude respondeu num formato inesperado. Tente de novo.',
  refused: 'O Claude não quis responder a esse pedido.',
  empty_completion: 'O Claude não devolveu resposta. Tente de novo.',
  session_expired: 'Sua sessão do claude.ai expirou. Recarregue a página.',
  unavailable: 'O Claude não está disponível aqui. Abra o Mendonça pelo claude.ai para usar as funções de IA.',
  login: 'Entre com seu e-mail (botão Entrar, no topo) para usar as funções de IA.',
  not_allowed: 'Este e-mail não tem permissão para usar a IA deste site.',
  bad_api_key: 'A chave da API do Claude configurada no servidor não funcionou.',
}

function toAIError(e: unknown): AIError {
  const err = e as { code?: string; message?: string; text?: string }
  const code = err?.code ?? 'upstream_error'
  return new AIError(code, MESSAGES[code] ?? 'Não consegui falar com o Claude agora. Tente de novo em instantes.', err?.text)
}

function claudeAiProvider(sample: ClaudeSample): AIProvider {
  const opts = (o?: AIOptions) => ({
    modelTier: o?.tier ?? 'default',
    signal: o?.signal,
    onText: o?.onText ? ({ text }: { text: string }) => o.onText!(text) : undefined,
    cache: o?.fresh ? false : undefined,
  })
  return {
    name: 'claude.ai',
    async text(prompt, o) {
      try {
        return (await sample(prompt, opts(o))).text
      } catch (e) {
        throw toAIError(e)
      }
    },
    async json<T>(prompt: string, o?: AIOptions) {
      try {
        return await sample.json<T>(prompt, opts(o))
      } catch (e) {
        throw toAIError(e)
      }
    },
  }
}

function serverProvider(endpoint: string): AIProvider {
  const call = async (prompt: string, json: boolean, o?: AIOptions) => {
    let res: Response
    try {
      const token = await getAccessToken().catch(() => null)
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompt, tier: o?.tier ?? 'default', json }),
        signal: o?.signal,
        credentials: 'include',
      })
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new AIError('cancelled', MESSAGES.cancelled)
      throw new AIError('upstream_error', 'Não consegui falar com o servidor de IA.')
    }
    if (!res.ok) {
      const code = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? (res.status === 429 ? 'rate_limited' : 'upstream_error')
      throw new AIError(code, MESSAGES[code] ?? 'O servidor de IA respondeu com erro. Tente de novo.')
    }
    const { text } = (await res.json()) as { text: string }
    o?.onText?.(text)
    return text
  }
  return {
    name: 'servidor',
    text: (p, o) => call(p, false, o),
    async json<T>(p: string, o?: AIOptions) {
      const text = await call(p, true, o)
      try {
        const m = text.match(/```(?:json)?\s*([\s\S]*?)```/)
        const body = m ? m[1] : text.slice(Math.min(...['{', '['].map((c) => (text.indexOf(c) + 1 || Infinity) - 1)))
        return JSON.parse(body) as T
      } catch {
        throw new AIError('invalid_json', MESSAGES.invalid_json, text)
      }
    },
  }
}

let cached: Promise<AIProvider | null> | null = null

/** A IA disponível neste ambiente, ou null (as funções de IA ficam escondidas). */
export function getAI(): Promise<AIProvider | null> {
  if (cached) return cached
  // No site próprio (build normal, fora do claude.ai), a IA passa pela função /api/ia da Vercel.
  const endpoint = (import.meta.env.VITE_AI_ENDPOINT as string | undefined) ?? (import.meta.env.PROD && !import.meta.env.VITE_ARTIFACT ? '/api/ia' : undefined)
  if (endpoint) return (cached = Promise.resolve(serverProvider(endpoint)))
  cached = (async () => {
    const sample = (await window.claude?.use('sample').catch(() => null)) ?? null
    return sample ? claudeAiProvider(sample) : null
  })()
  return cached
}

/** Texto puro de uma nota (HTML do editor), com limite de tamanho para o pedido. */
export function noteText(html: string, max = 8000): string {
  const text = html
    .replace(/<\/(p|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.length > max ? text.slice(0, max) + '\n[…]' : text
}
