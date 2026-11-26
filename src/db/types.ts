export type AreaId = 'faculdade' | 'ensino' | 'idiomas'

export interface Area {
  id: AreaId
  name: string
  order: number
}

export interface Subject {
  id: string
  areaId: AreaId
  name: string
  color: string // hex
  icon?: string // chave em SUBJECT_ICONS
  weight: number // 1–5
  mandatory: boolean
  deadline?: string // YYYY-MM-DD
  createdAt: number
}

export interface Topic {
  id: string
  subjectId: string
  name: string
  order: number
  done: boolean
  studiedSeconds: number
  /** Quando o tópico foi concluído (inicia as revisões). */
  doneAt?: number
}

export interface Note {
  id: string
  title: string
  subjectId: string
  topicId?: string
  content: string // HTML do editor
  updatedAt: number
}

/** Janela de disponibilidade em minutos desde 00:00. */
export interface TimeWindow {
  start: number
  end: number
}

/** 0 = segunda … 6 = domingo */
export type Availability = TimeWindow[][]

export type AreaPercents = Record<AreaId, number>

export interface Week {
  id: string // YYYY-MM-DD da segunda-feira
  percents: AreaPercents
  availability: Availability
  pausedSubjectIds: string[]
  createdAt: number
  /** Revisão semanal feita no check-in seguinte. */
  retro?: WeekRetro
  /** Semana temática: a matéria da semana de cada área (sem isso, a semana é variada). */
  themes?: Partial<Record<AreaId, string>>
  /** Modo flexível: minutos de estudo por dia (seg..dom), sem horário marcado. Sem isso, vale a disponibilidade por horário. */
  dailyMinutes?: number[]
}

export type RetroTag = 'pouco-tempo' | 'cansaco' | 'distracoes' | 'materia-dificil' | 'plano-irreal'

export interface WeekRetro {
  worked: string
  blocked: string
  tags: RetroTag[]
  at: number
}

export type BlockKind = 'study' | 'revisao' | 'compromisso' | 'prova'

export interface Block {
  id: string
  weekId: string
  date: string // YYYY-MM-DD
  start: number // minutos desde 00:00
  end: number
  kind: BlockKind
  subjectId?: string
  topicId?: string
  title?: string
  done: boolean
  studiedSeconds: number
  /** true quando foi gerado pelo planejador (pode ser regerado). */
  auto: boolean
  /** Passou do horário sem ser feito; o conteúdo foi remarcado. */
  missed?: boolean
  /** Bloco sem hora marcada (modo flexível): vale o dia inteiro; start/end só ordenam. */
  flex?: boolean
  /** Questões feitas por fora (livro, lista) neste bloco; 0 = respondeu "não fiz". */
  questions?: number
  /** Quantas dessas questões acertou (opcional). */
  correct?: number
}

export type ReviewRating = 'dificil' | 'ok' | 'facil'

/** Estado da revisão espaçada de um tópico concluído. */
export interface Review {
  topicId: string
  subjectId: string
  due: string // YYYY-MM-DD
  intervalDays: number
  count: number // revisões feitas
  history: { date: string; rating: ReviewRating }[]
  createdAt: number
}

export interface Session {
  id: string
  blockId?: string
  subjectId?: string
  topicId?: string
  startedAt: number
  seconds: number
  /** Sessão guiada: objetivo escrito antes de começar. */
  goal?: string
  /** Sessão guiada: autoavaliação de confiança (1–5) no fim. */
  confidence?: number
  /** Sessão guiada: o que você lembrou de memória ("tela em branco"). */
  recall?: string
}

export interface Settings {
  id: 'main'
  blockMinutes: number
  minBlockMinutes: number
  maxBlockMinutes: number
  breakMinutes: number
  maxSameSubjectInRow: number
  defaultAvailability: Availability
  /** Como planejar: horas por dia (padrão) ou horários fixos. */
  scheduleMode?: 'horas' | 'horarios'
  /** Últimos minutos por dia usados no modo de horas (seg..dom). */
  defaultDailyMinutes?: number[]
  lastPercents: AreaPercents
  userName?: string
  /** Duração de um bloco de revisão (min). */
  reviewMinutes?: number
  /** Fatia máxima da semana para revisões (0–1). */
  maxReviewShare?: number
  /** Sessão guiada: minutos de foco e de pausa por ciclo. */
  focusMinutes?: number
  focusPauseMinutes?: number
  /** Versão dos conteúdos padrão já aplicada. */
  seedVersion?: number
  /** Mendi dá boas-vindas ao abrir o site (padrão: sim). */
  mascotWelcome?: boolean
  /** Preferência: semanas temáticas (uma matéria por área). Padrão: sim. */
  themeWeeks?: boolean
  /** Meta de questões por dia (padrão 20). */
  dailyGoal?: number
  /** Prova alvo (ex.: ENEM, Fuvest) para a IA imitar o estilo. */
  targetExam?: string
}

export interface TimerState {
  id: 'timer'
  blockId?: string
  subjectId?: string
  topicId?: string
  label: string
  startedAt: number | null // ms; null = pausado
  accumulated: number // segundos acumulados antes do último start
}

/** Posição salva de um nó no mapa mental (id do nó: "s:<id>", "t:<id>", "n:<id>"). */
export interface MapPosition {
  id: string
  x: number
  y: number
}

/** Ligação criada à mão no mapa mental. */
export interface MapLink {
  id: string
  source: string
  target: string
  createdAt: number
}

export interface UnlockedAchievement {
  id: string
  unlockedAt: number
}

/** Flashcard com revisão espaçada própria. */
export interface Flashcard {
  id: string
  subjectId: string
  topicId?: string
  noteId?: string
  front: string
  back: string
  source: 'manual' | 'ia'
  createdAt: number
  due: string // YYYY-MM-DD
  intervalDays: number
  count: number
  history: { date: string; rating: ReviewRating }[]
}

// ---------- Desafios ----------

export type ChallengeItem =
  | { type: 'multipla'; question: string; options: string[]; correct: number; explanation?: string }
  | { type: 'vf'; statement: string; answer: boolean; explanation?: string }
  | { type: 'aberta'; question: string; expected: string }
  | { type: 'explique'; prompt: string; keyPoints: string[] }
  | { type: 'lacunas'; text: string; answers: string[] }

export interface ChallengeResult {
  /** 0–1 */
  score: number
  correct: boolean
  feedback?: string
  missing?: string[]
  /** Você contestou a correção (sai da nota). */
  contested?: boolean
}

export interface Challenge {
  id: string
  subjectId: string
  topicId?: string
  origin: 'bloco' | 'revisao' | 'demanda' | 'questoes'
  /** Lista de questões: o que foi pedido (pedido livre, dificuldade). */
  request?: string
  fromNotes: boolean
  createdAt: number
  items: ChallengeItem[]
  /** Resposta do estudante por item (texto, índice, V/F ou lista de lacunas). */
  answers: (string | number | boolean | string[] | null)[]
  results: ChallengeResult[]
  /** Nota final 0–1 (sem os itens contestados). */
  score: number
}

// ---------- Caderno de erros ----------

export type ErrorReason = 'nao-sabia' | 'confundi' | 'desatencao' | 'tempo'
export type WritingCategory = 'crase' | 'virgula' | 'concordancia' | 'regencia' | 'acentuacao' | 'ortografia' | 'pontuacao' | 'colocacao' | 'outro'

export interface ErrorEntry {
  id: string
  source: 'desafio' | 'questoes' | 'flashcard' | 'escrita' | 'rush' | 'simulado'
  subjectId?: string
  topicId?: string
  question: string
  yourAnswer: string
  correctAnswer: string
  explanation?: string
  /** Só no treino de escrita. */
  category?: WritingCategory
  reason?: ErrorReason
  createdAt: number
  due: string // YYYY-MM-DD
  /** Acertos seguidos; com 2, o erro é resolvido. */
  streak: number
  resolved: boolean
  history: { date: string; ok: boolean }[]
}

export interface WritingDeviation {
  excerpt: string
  correction: string
  category: WritingCategory
  explanation: string
}

export interface Writing {
  id: string
  theme: string
  text: string
  createdAt: number
  summary?: string
  strengths?: string[]
  deviations: WritingDeviation[]
}

/** Questões feitas fora dos blocos: no Rush (somadas por dia/matéria/tópico) ou extras registradas à mão. */
export interface Practice {
  id: string
  date: string // YYYY-MM-DD
  source: 'rush' | 'extra' | 'simulado'
  subjectId?: string
  topicId?: string
  done: number
  /** Acertos (o Rush sempre sabe; nas extras é opcional). */
  correct?: number
  note?: string
  createdAt: number
}

/** Desafio de programação (aba Código das Questões). */
export interface CodeChallenge {
  id: string
  createdAt: number
  lang: 'python' | 'javascript'
  level: string
  title: string
  statement: string
  examples: { input: string; output: string }[]
  hint?: string
  solution?: string
  fn?: string
  tests?: { args: unknown[]; expected: unknown }[]
  code: string
  solved: boolean
  attempts: number
  feedback?: string
}

/** Tarefa do modo Empresarial: uma ordem do gerente dentro do projeto. */
export interface OfficeTask {
  id: string
  title: string
  kind: 'nova' | 'bug' | 'melhoria'
  message: string
  criteria: string[]
  /** Código que entra no arquivo quando a tarefa começa (função pela metade, código com defeito...). */
  patch?: string
  patched?: boolean
  fn?: string
  tests?: { args: unknown[]; expected: unknown }[]
  hint?: string
  done: boolean
  attempts: number
  feedback?: { ok: boolean; summary: string; points: string[]; next: string; criteria?: boolean[]; extra?: string; usedConcept?: boolean }
  /** Histórico das revisões (para o gerente não mudar de ideia entre uma entrega e outra). */
  reviews?: { ok: boolean; summary: string; points: string[] }[]
  qa?: { q: string; a: string }[]
  /** Conceito do banco que a tarefa usa: apresentado pelo nome (novo) ou cobrado sem aviso (revisão). */
  concept?: string
  conceptKind?: 'novo' | 'revisao'
}

/** Projeto do modo Empresarial: uma empresa inventada, um arquivo que cresce e uma fila de tarefas. */
export interface OfficeProject {
  id: string
  createdAt: number
  lang: 'python' | 'javascript'
  level: string
  sector: string
  company: string
  product: string
  pitch: string
  manager: { name: string; role: string; gender?: 'm' | 'f' }
  fileName: string
  code: string
  tasks: OfficeTask[]
  current: number
  finishedAt?: number
  grade?: number
  verdict?: string
  tips?: string[]
}

/** Código revisado pela Mendi e aprovado (biblioteca do "Meu código"). */
export interface CodeReview {
  id: string
  createdAt: number
  lang: 'python' | 'javascript'
  goal: string
  code: string
  grade: number
  verdict: string
  tips: string[]
  capiCode?: string
}
