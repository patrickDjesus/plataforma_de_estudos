/** No build do claude.ai o Supabase nunca é usado; este vazio evita levar a biblioteca junto. */
export function createClient(): never {
  throw new Error('Supabase indisponível neste build')
}
