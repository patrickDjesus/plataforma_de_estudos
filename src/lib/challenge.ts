import type { Challenge, ChallengeItem, ChallengeResult, ReviewRating } from '../db/types'

/** Itens que o Claude corrige (os outros o app corrige sozinho). */
export const needsAIGrading = (it: ChallengeItem) => it.type === 'aberta' || it.type === 'explique'

/** Limpa o JSON vindo da IA: descarta itens malformados em vez de quebrar a tela. */
export function sanitizeItems(raw: unknown, allowCloze: boolean): ChallengeItem[] {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { items?: unknown })?.items) ? (raw as { items: unknown[] }).items : []
  const out: ChallengeItem[] = []
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  for (const r of list as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object') continue
    const type = str(r.type)
    if (type === 'multipla') {
      const options = Array.isArray(r.options) ? r.options.map(str).filter(Boolean) : []
      const correct = Number(r.correct)
      if (str(r.question) && options.length >= 3 && options.length <= 5 && Number.isInteger(correct) && correct >= 0 && correct < options.length)
        out.push({ type, question: str(r.question), options, correct, explanation: str(r.explanation) || undefined })
    } else if (type === 'vf') {
      if (str(r.statement) && typeof r.answer === 'boolean') out.push({ type, statement: str(r.statement), answer: r.answer, explanation: str(r.explanation) || undefined })
    } else if (type === 'aberta') {
      if (str(r.question) && str(r.expected)) out.push({ type, question: str(r.question), expected: str(r.expected) })
    } else if (type === 'explique') {
      const keyPoints = Array.isArray(r.keyPoints) ? r.keyPoints.map(str).filter(Boolean) : []
      if (str(r.prompt) && keyPoints.length) out.push({ type, prompt: str(r.prompt), keyPoints })
    } else if (type === 'lacunas' && allowCloze) {
      const text = str(r.text)
      const answers = Array.isArray(r.answers) ? r.answers.map(str).filter(Boolean) : []
      const blanks = (text.match(/_{3,}/g) ?? []).length
      if (text && blanks > 0 && blanks === answers.length) out.push({ type, text, answers })
    }
  }
  return out
}

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

/** Lacuna certa: igual ignorando acentos/maiúsculas, ou com um errinho de digitação em palavras maiores. */
export function blankMatches(given: string, expected: string) {
  const g = normalize(given)
  const e = normalize(expected)
  if (!g) return false
  if (g === e) return true
  return e.length > 4 && distance(g, e) <= 1
}

/** Corrige o que não precisa de IA. Devolve null para itens que o Claude deve corrigir. */
export function gradeLocal(it: ChallengeItem, answer: Challenge['answers'][number]): ChallengeResult | null {
  if (it.type === 'multipla') {
    const ok = answer === it.correct
    return { score: ok ? 1 : 0, correct: ok, feedback: ok ? undefined : `Correta: ${it.options[it.correct]}${it.explanation ? `. ${it.explanation}` : ''}` }
  }
  if (it.type === 'vf') {
    const ok = answer === it.answer
    return { score: ok ? 1 : 0, correct: ok, feedback: `${it.answer ? 'Verdadeiro' : 'Falso'}.${it.explanation ? ` ${it.explanation}` : ''}` }
  }
  if (it.type === 'lacunas') {
    const given = Array.isArray(answer) ? answer : []
    const hits = it.answers.filter((a, i) => blankMatches(String(given[i] ?? ''), a)).length
    const score = hits / it.answers.length
    return { score, correct: score === 1, feedback: score === 1 ? undefined : `Respostas: ${it.answers.join(', ')}` }
  }
  return null
}

/** Nota final, sem os itens contestados. */
export function finalScore(results: ChallengeResult[]) {
  const counted = results.filter((r) => !r.contested)
  if (!counted.length) return 0
  return counted.reduce((a, r) => a + r.score, 0) / counted.length
}

/** Desafio de revisão: a nota decide a próxima data. */
export function ratingFromScore(score: number): ReviewRating {
  if (score < 0.5) return 'dificil'
  if (score < 0.85) return 'ok'
  return 'facil'
}

export const ITEM_LABEL: Record<ChallengeItem['type'], string> = {
  multipla: 'Múltipla escolha',
  vf: 'Verdadeiro ou falso',
  aberta: 'Resposta aberta',
  explique: 'Explique com suas palavras',
  lacunas: 'Complete as lacunas',
}
