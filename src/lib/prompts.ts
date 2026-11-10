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
