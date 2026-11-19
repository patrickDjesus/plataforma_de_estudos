import type { Challenge, ErrorEntry, ErrorReason, WritingCategory } from '../db/types'
import { addDays } from './dates'

export const REASON_LABEL: Record<ErrorReason, { emoji: string; label: string }> = {
  'nao-sabia': { emoji: '', label: 'Não sabia' },
  confundi: { emoji: '', label: 'Confundi' },
  desatencao: { emoji: '', label: 'Desatenção' },
  tempo: { emoji: '', label: 'Faltou tempo' },
}

export const CATEGORY_LABEL: Record<WritingCategory, string> = {
  crase: 'Crase',
  virgula: 'Vírgula',
  concordancia: 'Concordância',
  regencia: 'Regência',
  acentuacao: 'Acentuação',
  ortografia: 'Ortografia',
  pontuacao: 'Pontuação',
  colocacao: 'Colocação pronominal',
  outro: 'Outro',
}

/** Revisar um erro: 2 acertos seguidos resolvem; errar volta para amanhã. */
export function reviewError(e: ErrorEntry, ok: boolean, today: string): ErrorEntry {
  const streak = ok ? e.streak + 1 : 0
  const resolved = streak >= 2
  return { ...e, streak, resolved, due: addDays(today, ok ? (streak === 1 ? 3 : 7) : 1), history: [...e.history, { date: today, ok }] }
}

type Answer = Challenge['answers'][number]

function answerText(c: Challenge, k: number): string {
  const it = c.items[k]
  const a: Answer = c.answers[k]
  if (a === null || a === undefined) return ''
  if (it.type === 'multipla') return typeof a === 'number' ? it.options[a] : ''
  if (it.type === 'vf') return a === true ? 'Verdadeiro' : a === false ? 'Falso' : ''
  return Array.isArray(a) ? a.join(' · ') : String(a)
}

/** Itens errados de um desafio viram entradas do caderno de erros (id estável: não duplica). */
export function errorsFromChallenge(c: Challenge, today: string): ErrorEntry[] {
  const out: ErrorEntry[] = []
  c.items.forEach((it, k) => {
    const r = c.results[k]
    if (!r || r.contested || r.score >= 0.75) return
    const question = it.type === 'multipla' || it.type === 'aberta' ? it.question : it.type === 'vf' ? it.statement : it.type === 'explique' ? it.prompt : it.text
    const correctAnswer =
      it.type === 'multipla' ? it.options[it.correct] : it.type === 'vf' ? (it.answer ? 'Verdadeiro' : 'Falso') : it.type === 'aberta' ? it.expected : it.type === 'explique' ? it.keyPoints.join(' · ') : it.answers.join(' · ')
    const explanation = r.feedback ?? ('explanation' in it ? it.explanation : undefined)
    out.push({
      id: `${c.id}-${k}`,
      source: c.origin === 'questoes' ? 'questoes' : 'desafio',
      subjectId: c.subjectId,
      topicId: c.topicId,
      question,
      yourAnswer: answerText(c, k),
      correctAnswer,
      explanation,
      createdAt: c.createdAt,
      due: addDays(today, 1),
      streak: 0,
      resolved: false,
      history: [],
    })
  })
  return out
}
