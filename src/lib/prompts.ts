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

export type ChallengeType = 'multipla' | 'vf' | 'aberta' | 'explique' | 'lacunas'
export type Difficulty = 'facil' | 'medio' | 'dificil'
export interface ChallengeOptions {
  types?: ChallengeType[]
  difficulty?: Difficulty
  /** Pedido livre do estudante (aba Questões). */
  request?: string
  /** 'geral' ignora as anotações. */
  base?: 'notas' | 'geral'
  /** Múltipla escolha no estilo de vestibular (enunciado com contexto, 5 alternativas). */
  vestibular?: boolean
}

const TYPE_SPEC: Record<ChallengeType, string> = {
  multipla: '- "multipla": múltipla escolha com 4 opções plausíveis e só uma correta. Campos: question, options (4 textos), correct (índice 0 a 3), explanation (1 frase).',
  vf: '- "vf": afirmação para julgar como verdadeira ou falsa. Campos: statement, answer (true/false), explanation (1 frase).',
  aberta: '- "aberta": pergunta de resposta curta (1 a 3 frases). Campos: question, expected (a resposta esperada).',
  explique: '- "explique": pede para explicar um conceito com as próprias palavras, como se ensinasse um colega. Campos: prompt, keyPoints (2 a 4 pontos que uma boa explicação deve ter).',
  lacunas: '- "lacunas": copie 1 ou 2 frases importantes das anotações trocando termos-chave por ___ (três sublinhados). Campos: text, answers (os termos na ordem das lacunas; mesmo número de ___).',
}
const DIFFICULTY_TEXT: Record<Difficulty, string> = {
  facil: 'Nível FÁCIL: conceitos básicos e definições, perguntas diretas.',
  medio: 'Nível MÉDIO: aplicar o conceito em situações simples e relacionar ideias.',
  dificil: 'Nível DIFÍCIL: aplicação em situações novas, comparação de conceitos e pegadinhas comuns de prova.',
}

export function challengePrompt(c: StudyContext, count: number, opts: ChallengeOptions = {}) {
  const { text, fromNotes } = contextBlock(opts.base === 'geral' ? { ...c, noteHtml: undefined } : c)
  let types = opts.types?.length ? opts.types : (['multipla', 'vf', 'aberta', 'explique', 'lacunas'] as ChallengeType[])
  if (!fromNotes) types = types.filter((t) => t !== 'lacunas')
  if (!types.length) types = ['multipla']
  const repeat = types.length === 1 ? 'Use só esse tipo.' : `Misture os tipos; nenhum tipo mais de ${Math.max(2, Math.ceil(count / types.length) + 1)} vezes.`
  return `Você cria desafios de recuperação (testar a memória) em português do Brasil. As perguntas devem ser corretas, claras e checar entendimento, não decoreba trivial.

${text}

${DIFFICULTY_TEXT[opts.difficulty ?? 'medio']}

${opts.request?.trim() ? `Pedido do estudante (siga com prioridade, desde que seja sobre estudo): "${opts.request.trim().slice(0, 400)}"\n\n` : ''}Crie exatamente ${count} itens usando estes tipos. ${repeat}
${types.map((t) => (t === 'multipla' && opts.vestibular ? '- "multipla": questão no estilo de vestibular/ENEM: enunciado com um pequeno contexto (situação, dado ou trecho) e 5 alternativas plausíveis, só uma correta. Campos: question (enunciado completo), options (5 textos, sem letras), correct (índice 0 a 4), explanation (por que a correta está certa).' : TYPE_SPEC[t])).join('\n')}

Responda apenas com JSON neste formato:
{"items": [{"type": "${types[0]}", ...campos do tipo}]}`
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

// ---------- Treino de escrita ----------

export function writingThemePrompt(avoid: string[]) {
  return `Você propõe temas para um estudante brasileiro treinar a escrita na norma-padrão.
Proponha UM tema atual e interessante para um texto curto (1 a 3 parágrafos), sobre o qual qualquer estudante consiga opinar.
${avoid.length ? `Evite estes temas já usados: ${avoid.slice(-8).join('; ')}.` : ''}

Responda apenas com JSON: {"tema": "título curto", "contexto": "2 frases apresentando a questão", "dicas": ["3 ideias curtas para desenvolver o texto"]}`
}

export function writingCorrectionPrompt(theme: string, text: string) {
  return `Você é um revisor de língua portuguesa (norma-padrão do Brasil), justo e didático.
Tema do texto: ${theme}

Texto do estudante:
"""
${text.slice(0, 6000)}
"""

Encontre os desvios da norma-padrão: crase, vírgula, concordância, regência, acentuação, ortografia, pontuação e colocação pronominal.
- Não corrija estilo nem opinião; só desvios reais da norma-padrão.
- "trecho": copie EXATAMENTE do texto o pedaço curto que tem o desvio (3 a 12 palavras), para ele poder ser destacado.
- "correcao": o mesmo trecho corrigido.
- "categoria": uma destas: crase, virgula, concordancia, regencia, acentuacao, ortografia, pontuacao, colocacao, outro.
- "explicacao": a regra, em 1 ou 2 frases simples.
Também diga em "resumo" uma avaliação geral em 1 a 2 frases e em "pontosFortes" até 3 coisas que o estudante fez bem.

Responda apenas com JSON: {"resumo": "…", "pontosFortes": ["…"], "desvios": [{"trecho": "…", "correcao": "…", "categoria": "virgula", "explicacao": "…"}]}`
}
