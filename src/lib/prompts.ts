/**
 * Pedidos ao Claude, num lugar só. Cada pedido é independente (o Claude não lembra
 * das conversas anteriores), então leva instrução, contexto e formato de resposta.
 */
import { noteText } from './ai'

export interface StudyContext {
  area: string // Faculdade, Ensino Médio, Idiomas
  subject: string
  topic?: string
  noteHtml?: string
}

/** Contexto do estudante: as anotações dele, ou o aviso de que não há anotações. */
export function contextBlock(c: StudyContext): { text: string; fromNotes: boolean } {
  const notes = c.noteHtml ? noteText(c.noteHtml) : ''
  const head = `Área: ${c.area}\nMatéria: ${c.subject}${c.topic ? `\nTópico: ${c.topic}` : ''}`
  if (notes.length >= 40)
    return { text: `${head}\n\nAnotações do estudante (use como base principal; não invente nada que contradiga):\n"""\n${notes}\n"""`, fromNotes: true }
  return { text: `${head}\n\nO estudante ainda não escreveu anotações sobre isso. Use conhecimento geral, no nível adequado à área.`, fromNotes: false }
}

export function flashcardPrompt(c: StudyContext, existingFronts: string[]) {
  const { text } = contextBlock(c)
  return `Você cria flashcards de estudo em português do Brasil, claros e corretos.

${text}

Crie de 5 a 8 flashcards sobre o conteúdo acima.
- Frente: uma pergunta direta ou um conceito para lembrar (até 20 palavras).
- Verso: a resposta, objetiva, em até 2 frases.
- Cubra ideias diferentes; prefira o que mais cai em provas e o que costuma confundir.
${existingFronts.length ? `- Não repita estes cartões que já existem:\n${existingFronts.map((f) => `  • ${f}`).join('\n')}` : ''}

Responda apenas com JSON, um array assim: [{"front": "Pergunta", "back": "Resposta"}]`
}

export function explainPrompt(c: StudyContext) {
  return `Você é um professor paciente que explica em português do Brasil.

Área: ${c.area}
Matéria: ${c.subject}
Tópico: ${c.topic ?? c.subject}

Escreva uma explicação introdutória do tópico para o estudante ler e depois anotar com as próprias palavras.
- 250 a 400 palavras, em Markdown simples: um título, parágrafos curtos e uma lista com os pontos-chave.
- Inclua um exemplo concreto.
- Termine com "Para fixar:" e 3 perguntas curtas para o estudante tentar responder sozinho.`
}

export function challengePrompt(c: StudyContext, count: number) {
  const { text, fromNotes } = contextBlock(c)
  return `Você cria desafios de recuperação (testar a memória) em português do Brasil. As perguntas devem ser corretas, claras e checar entendimento, não decoreba trivial.

${text}

Crie exatamente ${count} itens, misturando estes tipos (use tipos diferentes; não repita o mesmo tipo mais de 2 vezes):
- "multipla": múltipla escolha com 4 opções plausíveis e só uma correta. Campos: question, options (4 textos), correct (índice 0 a 3), explanation (1 frase).
- "vf": afirmação para julgar como verdadeira ou falsa. Campos: statement, answer (true/false), explanation (1 frase).
- "aberta": pergunta de resposta curta (1 a 3 frases). Campos: question, expected (a resposta esperada).
- "explique": pede para explicar um conceito com as próprias palavras, como se ensinasse um colega. Campos: prompt, keyPoints (2 a 4 pontos que uma boa explicação deve ter).
${fromNotes ? '- "lacunas": copie 1 ou 2 frases importantes das anotações trocando termos-chave por ___ (três sublinhados). Campos: text, answers (os termos na ordem das lacunas; mesmo número de ___).' : ''}

Responda apenas com JSON neste formato:
{"items": [{"type": "multipla", "question": "…", "options": ["…","…","…","…"], "correct": 0, "explanation": "…"}]}`
}

export interface GradeEntry {
  index: number
  kind: string
  question: string
  reference: string
  answer: string
}

export function gradePrompt(c: StudyContext, entries: GradeEntry[]) {
  return `Você corrige respostas de um estudante, em português do Brasil, de forma justa e encorajadora.
Área: ${c.area}. Matéria: ${c.subject}${c.topic ? `. Tópico: ${c.topic}` : ''}.

Para cada item, compare a resposta do estudante com a referência. Aceite outras formulações corretas; não exija as mesmas palavras.
- score: número de 0 a 1 (1 = completo e correto; 0,5 = parcialmente certo; 0 = errado ou vazio).
- feedback: 1 ou 2 frases dizendo o que acertou e o que corrigir.
- missing: lista curta do que faltou (pode ser vazia).

Itens:
${entries.map((e) => `[${e.index}] (${e.kind}) ${e.question}\nReferência: ${e.reference}\nResposta do estudante: ${e.answer.trim() || '(em branco)'}`).join('\n\n')}

Responda apenas com JSON: {"results": [{"index": 0, "score": 1, "feedback": "…", "missing": []}]}`
}
