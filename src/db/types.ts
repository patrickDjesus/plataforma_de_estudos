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
}

export interface Settings {
  id: 'main'
  blockMinutes: number
  minBlockMinutes: number
  maxBlockMinutes: number
  breakMinutes: number
  maxSameSubjectInRow: number
  defaultAvailability: Availability
  lastPercents: AreaPercents
  userName?: string
  /** Duração de um bloco de revisão (min). */
  reviewMinutes?: number
  /** Fatia máxima da semana para revisões (0–1). */
  maxReviewShare?: number
  /** Capi dá boas-vindas ao abrir o site (padrão: sim). */
  mascotWelcome?: boolean
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
