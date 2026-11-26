/*
 * Banco de conceitos do modo Empresarial.
 * Cada projeto encaixa um recurso da linguagem que você ainda não usou (sem explicar nada),
 * e de vez em quando traz de volta um que você já usou, sem avisar, para ver se ainda lembra.
 */

export type ConceptLang = 'python' | 'javascript'

export interface CodeConcept {
  /** `${lang}:${nome}` */
  id: string
  lang: ConceptLang
  name: string
  /** Acertos seguidos usando o conceito (0 = ainda aprendendo). */
  streak: number
  /** Quando ele deve voltar numa revisão surpresa. */
  due: number
  firstAt: number
  lastAt: number
  history: { at: number; ok: boolean; kind: 'novo' | 'revisao'; project: string }[]
}

/** Recursos que costumam passar batido no começo. O número é o cargo mínimo (1 Estagiário, 2 Júnior, 3 Júnior+). */
export const CATALOG: Record<ConceptLang, [string, number][]> = {
  python: [
    ['f-string com :.2f', 1],
    ['round', 1],
    ['abs', 1],
    ['in (está dentro?)', 1],
    ['str.strip / str.lower', 1],
    ['operador ternário (x if c else y)', 1],
    ['parâmetro com valor padrão', 1],
    ['divmod', 1],
    ['fatiamento [a:b]', 2],
    ['str.split', 2],
    ['str.join', 2],
    ['enumerate', 2],
    ['zip', 2],
    ['dict.get', 2],
    ['range com passo', 2],
    ['sum / min / max', 2],
    ['list.count', 2],
    ['desempacotamento (a, b = ...)', 2],
    ['return de dois valores', 2],
    ['for com break', 2],
    ['list comprehension', 3],
    ['dict comprehension', 3],
    ['sorted com key', 3],
    ['lambda', 3],
    ['min / max com key', 3],
    ['any / all', 3],
    ['dict.setdefault', 3],
    ['set', 3],
    ['try / except', 3],
    ['isinstance', 3],
    ['dict.items', 2],
    ['reversed', 2],
  ],
  javascript: [
    ['template string', 1],
    ['operador ternário', 1],
    ['toFixed', 1],
    ['Math.round / Math.floor', 1],
    ['parâmetro padrão', 1],
    ['includes', 1],
    ['trim / toLowerCase', 1],
    ['for...of', 2],
    ['split / join', 2],
    ['slice', 2],
    ['find', 2],
    ['filter', 2],
    ['map', 2],
    ['some / every', 2],
    ['Object.entries', 2],
    ['Object.keys', 2],
    ['padStart', 2],
    ['desestruturação', 2],
    ['arrow function', 2],
    ['?? (nullish)', 2],
    ['reduce', 3],
    ['sort com comparador', 3],
    ['spread (...)', 3],
    ['?. (optional chaining)', 3],
    ['Set', 3],
    ['Math.max(...lista)', 3],
    ['flatMap', 3],
    ['Array.from', 3],
    ['Number.isInteger', 3],
    ['try / catch', 3],
  ],
}

const DAY = 24 * 60 * 60 * 1000
/** Intervalo até a próxima revisão, pelo número de acertos seguidos. */
export const INTERVALS = [1, 3, 7, 14, 30, 60]
export const conceptId = (lang: ConceptLang, name: string) => `${lang}:${name}`

const shuffle = <T,>(a: T[], rnd: () => number) => {
  const x = [...a]
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[x[i], x[j]] = [x[j], x[i]]
  }
  return x
}

/**
 * O que oferecer à IA ao montar um projeto:
 * - novos: do catálogo, até o cargo escolhido, nunca usados (os já apresentados sem uso vêm primeiro);
 * - revisão: já usados ao menos uma vez e com a revisão vencida (os mais atrasados primeiro).
 */
export function pickCandidates(lang: ConceptLang, level: number, bank: CodeConcept[], now: number, rnd = Math.random) {
  const mine = new Map(bank.filter((c) => c.lang === lang).map((c) => [c.name, c]))
  const used = (c?: CodeConcept) => !!c?.history.some((h) => h.ok)
  const pool = CATALOG[lang].filter(([name, lv]) => lv <= level && !used(mine.get(name))).map(([name]) => name)
  const started = pool.filter((n) => mine.has(n))
  const fresh = shuffle(
    pool.filter((n) => !mine.has(n)),
    rnd,
  )
  const novos = [...started, ...fresh].slice(0, 8)
  const revisao = [...mine.values()]
    .filter((c) => used(c) && c.due <= now)
    .sort((a, b) => a.due - b.due)
    .slice(0, 4)
    .map((c) => c.name)
  return { novos, revisao }
}

/** Atualiza o conceito depois de uma tarefa aprovada que o envolvia. */
export function applyConceptResult(prev: CodeConcept | undefined, lang: ConceptLang, name: string, kind: 'novo' | 'revisao', used: boolean, project: string, now: number): CodeConcept {
  const base: CodeConcept = prev ?? { id: conceptId(lang, name), lang, name, streak: 0, due: now, firstAt: now, lastAt: now, history: [] }
  const streak = used ? base.streak + 1 : 0
  // Não usou: volta logo (amanhã). Usou: espaça conforme os acertos seguidos.
  const days = used ? INTERVALS[Math.min(streak, INTERVALS.length) - 1] : 1
  return { ...base, streak, due: now + days * DAY, lastAt: now, history: [...base.history, { at: now, ok: used, kind, project }].slice(-20) }
}

export type ConceptState = 'aprendendo' | 'aprendido' | 'fixado'
export const conceptState = (c: CodeConcept): ConceptState => (c.streak >= 3 ? 'fixado' : c.streak >= 1 ? 'aprendido' : 'aprendendo')
