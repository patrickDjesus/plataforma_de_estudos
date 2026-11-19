/**
 * Função de IA do Mendonça na Vercel (POST /api/ia).
 *
 * O navegador manda {prompt, tier, json} com o token de login do Supabase.
 * Aqui conferimos o login, chamamos o Claude com a chave guardada na Vercel
 * (ANTHROPIC_API_KEY, nunca exposta ao site) e devolvemos {text}.
 *
 * Variáveis na Vercel:
 *   ANTHROPIC_API_KEY            chave da API do Claude (obrigatória)
 *   SUPABASE_URL / SUPABASE_ANON_KEY (ou as versões NEXT_PUBLIC_ / VITE_)  para conferir o login
 *   ALLOWED_EMAILS               opcional: e-mails que podem usar a IA, separados por vírgula
 */
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const env = (...names: string[]) => names.map((n) => process.env[n]).find(Boolean)
// Valores públicos do projeto (os mesmos do .env.production); variáveis da Vercel têm prioridade.
const DEFAULT_URL = 'https://vhvvemgtvbycnaixwffs.supabase.co'
const DEFAULT_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodnZlbWd0dmJ5Y25haXh3ZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxMDM2MzQsImV4cCI6MjExMDY3OTYzNH0.M4JE93dzynexygDltvpQmBL2gyDiDgeYGhw5Ws-k8O0'
const SUPABASE_URL = env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL') ?? DEFAULT_URL
const SUPABASE_KEY = env('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY') ?? DEFAULT_KEY
const ALLOWED = (process.env.ALLOWED_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

/** Profundidade de raciocínio por tipo de pedido do app. */
const EFFORT = { quick: 'low', default: 'medium', complex: 'high' } as const
type Tier = keyof typeof EFFORT

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Confere o token de login no Supabase e devolve o e-mail de quem pediu. */
async function whoIs(req: Request): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !SUPABASE_URL || !SUPABASE_KEY) return null
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const user = (await res.json()) as { email?: string }
  return user.email?.toLowerCase() ?? null
}

export async function POST(req: Request): Promise<Response> {
  const email = await whoIs(req)
  if (!email) return reply(401, { error: 'login' })
  if (ALLOWED.length && !ALLOWED.includes(email)) return reply(403, { error: 'not_allowed' })

  let body: { prompt?: unknown; tier?: unknown; json?: unknown }
  try {
    body = await req.json()
  } catch {
    return reply(400, { error: 'invalid_request' })
  }
  if (typeof body.prompt !== 'string' || !body.prompt.trim()) return reply(400, { error: 'invalid_request' })
  if (body.prompt.length > 200_000) return reply(413, { error: 'prompt_too_large' })
  const tier: Tier = body.tier === 'quick' || body.tier === 'complex' ? body.tier : 'default'
  const prompt = body.json ? `${body.prompt}\n\nResponda somente com o JSON pedido, sem texto antes ou depois.` : body.prompt

  try {
    // Streaming evita estourar o tempo do pedido em respostas longas (listas de questões, simulados).
    const stream = client.beta.messages.stream({
      model: 'claude-opus-5-5',
      max_tokens: 64000,
      output_config: { effort: EFFORT[tier] },
      // Se o pedido for recusado pelos filtros de segurança, a própria API tenta um modelo reserva.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: prompt }],
    })
    const message = await stream.finalMessage()
    if (message.stop_reason === 'refusal') return reply(422, { error: 'refused' })
    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    if (!text.trim()) return reply(502, { error: 'empty_completion' })
    return reply(200, { text })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return reply(429, { error: 'rate_limited' })
    if (error instanceof Anthropic.AuthenticationError) return reply(500, { error: 'bad_api_key' })
    if (error instanceof Anthropic.BadRequestError) return reply(400, { error: 'invalid_request' })
    if (error instanceof Anthropic.APIError) return reply(502, { error: 'upstream_error' })
    return reply(502, { error: 'upstream_error' })
  }
}
