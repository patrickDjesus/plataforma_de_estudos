/**
 * Motor do Rush de questões: fila adaptativa (dificuldade 0–10), chefões, combo,
 * itens, missões e revisões que voltam na fila depois de um erro.
 * Tudo aqui é lógica pura sobre um estado JSON; a página cuida da IA, sons e telas.
 */

// ---------- Tipos ----------
export type Formato = 'aberta' | 'multipla'
export type Conf = 'certeza' | 'acho' | 'chute'
export type Phase = 'answer' | 'checking' | 'feedback' | 'selfgrade'
export type ItemId = 'fifty' | 'shield' | 'skip'

export interface RushSubjectCfg {
  id: string // id da matéria no Mendonça
  focus: string // texto livre (ex.: "genética, ecologia")
  topicIds: string[] // tópicos escolhidos da lista da matéria
}

export interface RushCfg {
  subjects: RushSubjectCfg[]
  level: string
  mix: number // % de questões de conta
  format: 'misturado' | Formato
  goal: number
  grading: 'rapida' | 'caprichada'
  longReview: boolean
}

export interface RushQ {
  id: string
  materia: string // id da matéria
  topicId?: string
  topico: string
  conceito: string
  tipo: 'conta' | 'teoria'
  formato: Formato
  enunciado: string
  alternativas: string[]
  correta: number | null
  gabarito: string
  unidade: string
  valor: number | null
  tolerancia: number
  resolucao: string
  erros: string[]
  ideia: string
  dica: string
  dificuldade: number
  kind: 'nova' | 'revisao'
  family: string
  gen: number
  boss?: boolean
  parentQ?: string
  revIdx?: number
  revOf?: number
  long?: boolean
}

export interface Family {
  conceito: string
  topico: string
  materia: string
  erros: number
  acertos: number
  last: '' | 'errou' | 'duvida' | 'acertou'
  ts: number
  consolidado?: boolean
  longQueued?: boolean
  duvida?: boolean
}

export interface HistoryItem {
  id: string
  family: string
  materia: string
  topico: string
  conceito: string
  rev: boolean
  conf: Conf | ''
  hint: boolean
  correct: boolean
  ms: number
  ts: number
  dif: number
  boss: boolean
  pts: number
}

export interface Mission {
  id: MissionId
  n: number
  p: number
  done: boolean
  xp: number // pontos de bônus do rush
  item: ItemId | null
  m?: string // matéria (missão de matéria)
  text: string
}
type MissionId = 'done' | 'streak' | 'subj' | 'fast' | 'certeza' | 'rev' | 'dif' | 'boss' | 'nohint'

export interface Spawn {
  qid: string
  n: number
  offs: number[]
  status: 'gerando' | 'pronto' | 'erro' | 'skip' | 'cancelada'
  long?: boolean
  err?: string
}

export interface LastInfo {
  choice?: number | null
  answer?: string
  rac?: string
  correct?: boolean
  comment?: string
  erro?: string
  prevStreak?: number
  ms?: number
  fifty?: boolean
  shielded?: boolean
  pts?: number
  fast?: boolean
  levelUp?: number
  levelDown?: number
  gift?: ItemId
  gift2?: ItemId
  missions?: Mission[]
  comeback?: boolean
  doubt?: boolean
  overridden?: boolean
  note?: string
  spawn?: Spawn | null
  aiErr?: string
  naosei?: boolean
}

export interface RushState {
  cfg: RushCfg
  started: boolean
  view: 'setup' | 'rush' | 'report'
  queue: RushQ[]
  current: RushQ | null
  phase: Phase
  last: LastInfo | null
  qStart: number
  paused: number
  history: HistoryItem[]
  stats: { done: number; correct: number; streak: number; best: number; ms: number }
  bySubj: Record<string, { done: number; correct: number }>
  families: Record<string, Family>
  recent: string[]
  level: number
  score: number
  nextBoss: number
  bosses: number
  maxDif: number
  items: Record<ItemId, number>
  missions: Mission[]
  missionsDone: number
  wrongRun: number
  cbNeed: number
  skipped: number
  goalHit: boolean
  sound: boolean
  /** O próprio usuário escolheu o som (sem isso, vale o padrão: desligado). */
  soundChosen?: boolean
  fbag: Record<string, { sig: string; items: string[] }>
  lastSubj?: string
  seq: number
  cancelled: string[]
}

export const ITEMS: Record<ItemId, { name: string; desc: string }> = {
  fifty: { name: '50/50', desc: 'Tira 2 alternativas erradas. Vale metade dos pontos.' },
  shield: { name: 'Escudo', desc: 'Se errar, seu combo não zera. Usa sozinho.' },
  skip: { name: 'Pular', desc: 'Troca a questão sem contar como erro.' },
}

/** Onde as revisões entram na fila (posições a partir da próxima). */
export const OFFSETS: Record<number, number[]> = { 1: [3], 2: [2, 7], 3: [2, 6, 11] }

export function defaultRushState(): RushState {
  return {
    cfg: { subjects: [], level: '', mix: 50, format: 'misturado', goal: 100, grading: 'rapida', longReview: true },
    started: false,
    view: 'setup',
    queue: [],
    current: null,
    phase: 'answer',
    last: null,
    qStart: 0,
    paused: 0,
    history: [],
    stats: { done: 0, correct: 0, streak: 0, best: 0, ms: 0 },
    bySubj: {},
    families: {},
    recent: [],
    level: 1,
    score: 0,
    nextBoss: 15,
    bosses: 0,
    maxDif: 0,
    items: { fifty: 1, shield: 1, skip: 1 },
    missions: [],
    missionsDone: 0,
    wrongRun: 0,
    cbNeed: 0,
    skipped: 0,
    goalHit: false,
    sound: false,
    fbag: {},
    seq: 0,
    cancelled: [],
  }
}

/** Junta o salvo com o padrão (versões antigas ou campos faltando). */
export function hydrateRush(raw: unknown): RushState {
  const d = defaultRushState()
  if (!raw || typeof raw !== 'object') return d
  const r = raw as Partial<RushState>
  const s: RushState = { ...d, ...r, cfg: { ...d.cfg, ...(r.cfg ?? {}) }, stats: { ...d.stats, ...(r.stats ?? {}) }, items: { ...d.items, ...(r.items ?? {}) } }
  s.cfg.subjects = (s.cfg.subjects ?? []).map((x) => ({ id: x.id, focus: x.focus ?? '', topicIds: x.topicIds ?? [] }))
  if (s.phase === 'checking') s.phase = 'answer'
  if (!s.soundChosen) s.sound = false
  return s
}

// ---------- Utilidades ----------
export const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
export const strip = (s: string) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export function newId(S: RushState) {
  S.seq = (S.seq || 0) + 1
  return 'q' + Date.now().toString(36) + S.seq
}

export const DIF_LABELS = ['Moleza', 'Moleza', 'Tranquila', 'Tranquila', 'Média', 'Média', 'Puxada', 'Puxada', 'Brava', 'Brava', 'Impossível']
export const DIF_EMOJI = ['😌', '😌', '🙂', '🙂', '🤔', '🤔', '🔥', '🔥', '😤', '😤', '💀']
export function difInfo(d: number) {
  const v = Math.max(0, Math.min(10, Math.round(d)))
  return { d: v, label: DIF_LABELS[v], emoji: DIF_EMOJI[v], tier: v <= 1 ? 1 : v <= 3 ? 2 : v <= 5 ? 3 : v <= 7 ? 4 : 5 }
}
/** "Calor" da questão (0–1): muda as cores e o humor da Capi. */
export const qHeat = (q: RushQ | null) => (q ? (q.boss ? 1 : Math.max(0, Math.min(10, q.dificuldade ?? 3)) / 10) : 0)

// ---------- Foco e planejamento das levas ----------
export function splitFocus(f: string) {
  return String(f || '')
    .split(/[,;/|\n]+|\s+e\s+/i)
    .map((x) => x.trim().replace(/\.$/, ''))
    .filter((x) => x.length > 1)
}

export interface FocusPart {
  label: string
  topicId?: string
}

/** Partes do foco de uma matéria: tópicos escolhidos + texto livre. */
export function focusParts(sub: RushSubjectCfg, topicName: (id: string) => string | undefined): FocusPart[] {
  const fromTopics = sub.topicIds.map((id) => ({ label: topicName(id) ?? '', topicId: id })).filter((p) => p.label)
  return [...fromTopics, ...splitFocus(sub.focus).map((label) => ({ label }))]
}

/** Sorteia o próximo assunto de uma matéria, sem repetir até dar a volta. */
export function nextFocus(S: RushState, sub: RushSubjectCfg, topicName: (id: string) => string | undefined): FocusPart | null {
  const parts = focusParts(sub, topicName)
  if (!parts.length) return null
  if (parts.length === 1) return parts[0]
  const sig = parts.map((p) => p.label).join('|')
  let bag = S.fbag[sub.id]
  if (!bag || bag.sig !== sig || !bag.items.length) bag = S.fbag[sub.id] = { sig, items: shuffle(parts.map((_, i) => String(i))) }
  return parts[Number(bag.items.pop())] ?? parts[0]
}

/** Cada leva passa por todas as matérias escolhidas, em ordem embaralhada. */
export function subjSlots(S: RushState, n: number): RushSubjectCfg[] {
  const subs = S.cfg.subjects
  const out: RushSubjectCfg[] = []
  if (!subs.length) return out
  while (out.length < n) for (const s of shuffle(subs.slice())) if (out.length < n) out.push(s)
  if (S.lastSubj && subs.length > 1 && out[0].id === S.lastSubj) {
    const j = out.findIndex((x) => x.id !== S.lastSubj)
    if (j > 0) [out[0], out[j]] = [out[j], out[0]]
  }
  S.lastSubj = out[out.length - 1].id
  return out
}

export interface PlanSlot {
  s: RushSubjectCfg
  d: number
  boss: boolean
  focus: FocusPart | null
}

export function planBatch(S: RushState, n: number, topicName: (id: string) => string | undefined): PlanSlot[] {
  const L = S.level || 1
  let targets = !S.stats.done && !S.queue.length ? [2, 3, 4, 3, 5] : shuffle([L - 1, L, L + 1, L + 0.5, L + 2])
  targets = targets.slice(0, n).map((t) => Math.max(0, Math.min(10, Math.round(t))))
  while (targets.length < n) targets.push(Math.round(L))
  const freshQueued = S.queue.filter((q) => q.kind === 'nova').length
  let boss = -1
  if (S.stats.done + freshQueued + n >= (S.nextBoss || 15) && S.stats.done >= 5) {
    boss = n - 1
    targets[boss] = Math.max(7, Math.min(10, Math.round(L) + 3))
  }
  const slots = subjSlots(S, n)
  return targets.map((d, i) => ({ s: slots[i], d, boss: i === boss, focus: nextFocus(S, slots[i], topicName) }))
}

// ---------- Prompts ----------
const RULES = `Regras:
- Português do Brasil (em Inglês, texto-base e alternativas podem ser em inglês; pergunta e resolução em português).
- Resposta única e verificável. Refaça a conta antes de escrever: gabarito, valor, alternativa correta e resolução têm que bater.
- Contas com resultado razoável (até 3 algarismos significativos). Diga no enunciado se usar g = 10 m/s², π ≈ 3,14 etc.
- Fórmulas em LaTeX entre $...$, barra invertida dupla dentro do JSON (ex.: "$\\\\frac{v^2}{2a}$"). Dinheiro em "reais", nunca $.
- Texto puro, sem markdown. Seja enxuto: enunciado só com o necessário (até ~70 palavras, salvo texto-base), resolução com no máximo 4 passos curtos, "erros" com até 8 palavras cada, "ideia" e "dica" com até 15 palavras.
- Distratores vindos de erros comuns de verdade (confundir conceitos, esquecer conversão, trocar sinal).`

function schema(names: string) {
  return `Responda SOMENTE com um array JSON, sem texto fora dele. Cada item:
{"materia": um de [${names}], "topico": assunto curto (ex.: "Genética"), "conceito": rótulo específico (ex.: "1ª Lei de Mendel – Aa x Aa"), "tipo": "conta"|"teoria", "formato": "aberta"|"multipla", "enunciado": string, "alternativas": 5 strings se multipla (sem letra na frente) senão [], "correta": índice 0–4 ou null, "gabarito": resposta final curta com unidade, "unidade": unidade pra digitar ou "", "valor": número da resposta nessa unidade ou null, "tolerancia": erro relativo aceito (ex.: 0.02), "resolucao": passos numerados separados por \\n, "erros": 5 strings se multipla (erro que leva a cada alternativa; "" na correta) senão [], "ideia": ideia-chave numa frase, "dica": dica curta sem entregar a resposta, "dificuldade": inteiro 0–10}`
}

const DIF_SCALE = `Escala 0–10: 0 trivial; 2 fácil, uma ideia direta; 4 fácil do ENEM; 5 média do ENEM; 7 difícil do ENEM (vários passos ou pegadinha); 8 das mais difíceis do ENEM; 9 nível IME/ITA; 10 quase impossível.`

function difDesc(d: number) {
  return d <= 1
    ? 'bem fácil, um passo só, números redondos'
    : d <= 3
      ? 'fácil, aplicação direta de uma ideia'
      : d <= 5
        ? 'média, 2 ou 3 passos ou interpretação de texto'
        : d <= 7
          ? 'difícil, vários passos, conversão de unidades ou pegadinha'
          : d <= 9
            ? 'muito difícil, combina conceitos e exige raciocínio longo'
            : 'quase impossível, o máximo que uma prova poderia cobrar'
}

function fmtRule(f: RushCfg['format']) {
  if (f === 'aberta') return 'Todas de resposta aberta (o aluno digita a resposta final, curta).'
  if (f === 'multipla') return 'Todas de múltipla escolha com 5 alternativas.'
  return 'Misture: mais ou menos metade aberta (o aluno digita uma resposta curta) e metade múltipla escolha com 5 alternativas. Em teoria, prefira múltipla escolha ou respostas de uma ou duas palavras.'
}

const uniq = (a: string[]) => a.filter((v, i) => a.indexOf(v) === i)

export function genPrompt(S: RushState, plan: PlanSlot[], name: (id: string) => string) {
  const c = S.cfg
  const recent = S.recent.slice(-25).join('; ') || 'nenhum ainda'
  const lines = plan
    .map(
      (p, i) =>
        `${i + 1}. MATÉRIA: ${name(p.s.id)}${p.focus ? ` | ASSUNTO: ${p.focus.label}` : ''} | dificuldade ${p.d} (${difDesc(p.d)})${p.boss ? ' | QUESTÃO CHEFÃO: a mais difícil e marcante da leva, com contexto de prova de verdade' : ''}`,
    )
    .join('\n')
  const mats = uniq(plan.map((p) => name(p.s.id)))
  return `Você gera questões pra um "rush" de estudo: a pessoa vai resolver centenas de questões seguidas.

Gere exatamente ${plan.length} questões, NESTA ORDEM. Cada linha abaixo é uma questão, e a matéria e o assunto de cada uma são OBRIGATÓRIOS — não troque, não repita a matéria de outra linha, não junte duas matérias na mesma questão:
${lines}
${mats.length > 1 ? `Esta leva tem ${mats.length} matérias diferentes (${mats.join(', ')}). Cada questão usa exatamente a matéria da sua linha.\n` : ''}Quando a linha traz um ASSUNTO, a questão tem que ser daquele assunto específico, não de outro da mesma matéria.
${DIF_SCALE}
Respeite a dificuldade pedida de verdade: uma questão de dificuldade 1 tem que ser muito mais simples que uma de dificuldade 7.
Nível: ${c.level || 'ensino médio, estilo ENEM/vestibular (reforço: comece fácil e suba com a dificuldade pedida)'}
Mistura: em torno de ${c.mix}% de questões de CONTA (exigem cálculo numérico) quando a matéria permitir. Em Biologia, conta é genética (probabilidade, cruzamentos), ecologia (pirâmides, populações), proporções, diluições etc. Em matérias sem conta (História, Português, Filosofia…), faça só teoria/interpretação.
Formato: ${fmtRule(c.format)}
Varie subtópicos, contextos e o que é pedido. Evite repetir estes conceitos que já caíram: ${recent}

${RULES}

${schema(mats.join(', '))}`
}

export function qBrief(q: RushQ) {
  let s = q.enunciado
  if (q.formato === 'multipla') s += '\n' + q.alternativas.map((a, i) => 'ABCDE'[i] + ') ' + a).join('\n')
  return s
}

export function userAnswerText(q: RushQ, last: LastInfo | null) {
  if (!last) return '(não respondeu)'
  if (q.formato === 'multipla') return last.choice == null ? '(não respondeu)' : 'ABCDE'[last.choice] + ') ' + q.alternativas[last.choice]
  return last.answer || '(não respondeu)'
}

export function variantPrompt(S: RushState, q: RushQ, n: number, motivo: string, last: LastInfo | null, name: (id: string) => string) {
  const plano = [
    'Variação 1: parecida com a original, mas com outros números/exemplos e outra situação.',
    'Variação 2: contexto bem diferente, ou pedindo outra coisa com o mesmo raciocínio.',
    'Variação 3: um pouco mais difícil (um passo a mais).',
  ]
    .slice(0, n)
    .join('\n')
  return `Um aluno ${motivo} a questão abaixo. Gere ${n} variações pra ele treinar de novo a MESMA ideia, como se fosse uma nova tentativa de ver se aprendeu.

Questão original (matéria: ${name(q.materia)}; conceito: ${q.conceito}; tópico: ${q.topico}; nível: ${S.cfg.level || 'ensino médio / ENEM / vestibular'}):
${qBrief(q)}
Gabarito: ${q.gabarito}
Resolução: ${q.resolucao}
Resposta do aluno: ${userAnswerText(q, last)}
${last && last.rac ? 'Raciocínio do aluno: ' + last.rac + '\n' : ''}Diagnóstico do erro: ${(last && last.erro) || 'não informado'}

Como fazer:
- Mesmo conceito e mesmo tipo de raciocínio, mas com números/exemplos E situação diferentes (não é só trocar os números).
${plano}
- Mire no erro do aluno: quem repetir o mesmo erro tem que errar de novo. Na resolução, inclua um aviso curto sobre esse erro.
- Se der, pelo menos uma das variações deve ser de resposta aberta curta, pra não dar pra acertar por eliminação.
- Use "materia": "${name(q.materia)}" e mantenha "conceito": "${q.conceito}".
- Dificuldade da original: ${q.dificuldade ?? 4} de 10. Mantenha as variações nessa dificuldade (a última pode ser 1 ponto acima). ${DIF_SCALE}

${RULES}

${schema(name(q.materia))}`
}

export function checkPrompt(q: RushQ, ans: string, rac: string) {
  return `Corrija a resposta de um aluno. Português, informal, direto.

Questão: ${q.enunciado.slice(0, 600)}
Gabarito: ${q.gabarito}${q.valor != null ? ` (valor ${q.valor}${q.unidade ? ' ' + q.unidade : ''})` : ''}
Resolução: ${q.resolucao.slice(0, 500)}
Resposta do aluno: "${ans.slice(0, 300)}"${rac ? `\nRaciocínio do aluno: "${rac.slice(0, 400)}"` : ''}

CERTA se equivalente ao gabarito: unidade convertida certo, forma equivalente, fração/notação científica do mesmo valor, arredondamento até ~2%, sinônimo ou mesma ideia com outras palavras, pequenos erros de grafia.
Responda SOMENTE com JSON: {"correta": true|false, "comentario": "1 ou 2 frases: se errou, onde errou e o que fazer; se acertou, confirmação curta", "erro": "rótulo curto do erro ou vazio"}
LaTeX entre $...$, barra invertida dupla no JSON.`
}

export function askPrompt(q: RushQ, last: LastInfo | null, doubt: string) {
  return `Aluno num rush de questões com uma dúvida. Responda em português, informal, curto e direto (até ~110 palavras). LaTeX entre $...$, sem markdown.

Questão: ${qBrief(q).slice(0, 900)}
Gabarito: ${q.gabarito}
Resolução: ${q.resolucao.slice(0, 500)}
Resposta do aluno: ${userAnswerText(q, last)}
Dúvida: ${doubt.slice(0, 300)}`
}

// ---------- JSON tolerante a LaTeX mal escapado ----------
export function sanitizeJSON(s: string) {
  let out = ''
  let inStr = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (!inStr) {
      out += c
      if (c === '"') inStr = true
      continue
    }
    if (c === '\\') {
      const n = s[i + 1]
      if (n !== undefined && '"\\/bfnrt'.includes(n)) {
        out += c + n
        i++
        continue
      }
      if (n === 'u' && /^[0-9a-fA-F]{4}$/.test(s.substr(i + 2, 4))) {
        out += s.substr(i, 6)
        i += 5
        continue
      }
      out += '\\\\'
      continue
    }
    if (c === '"') {
      out += c
      inStr = false
      continue
    }
    if (c === '\n') {
      out += '\\n'
      continue
    }
    if (c === '\r') continue
    if (c === '\t') {
      out += '\\t'
      continue
    }
    out += c
  }
  return out
}

function fixStrings(v: unknown): unknown {
  if (typeof v === 'string')
    return v
      .replace(/\f/g, '\\f')
      .replace(/\x08/g, '\\b')
      .replace(/\t/g, '\\t')
      .replace(/\r/g, '\\r')
      .replace(/\n(?=(?:eq|abla|u|ot|eg|i|ewline|otin|parallel|leq|geq|cong|mid|exists|subset)(?![A-Za-zÀ-ÿ]))/g, '\\n')
  if (Array.isArray(v)) return v.map(fixStrings)
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const k in v as Record<string, unknown>) o[k] = fixStrings((v as Record<string, unknown>)[k])
    return o
  }
  return v
}

export function parseLoose(text: string): unknown {
  const t = String(text || '').trim()
  const tries = [t]
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (f) tries.push(f[1])
  const starts = ['[', '{'].map((c) => t.indexOf(c)).filter((k) => k >= 0)
  const i = starts.length ? Math.min(...starts) : -1
  const j = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'))
  if (i >= 0 && j > i) tries.push(t.slice(i, j + 1))
  for (const s of tries)
    for (const cand of [s, sanitizeJSON(s)]) {
      try {
        return fixStrings(JSON.parse(cand))
      } catch {
        /* tenta o próximo */
      }
    }
  return undefined
}

/** Lista de questões vinda da IA (array direto ou dentro de "questoes"). */
export function rawList(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[]
  const o = v as { questoes?: unknown; questions?: unknown } | null
  const inner = o?.questoes ?? o?.questions
  return Array.isArray(inner) ? (inner as Record<string, unknown>[]) : []
}

// ---------- Normalização ----------
export function normQ(S: RushState, x: Record<string, unknown>, materia: string): RushQ | null {
  if (!x || typeof x !== 'object' || !x.enunciado) return null
  const alts = Array.isArray(x.alternativas) ? x.alternativas.map((a) => String(a).replace(/^\s*[A-Ea-e][).]\s+/, '')).filter((a) => a.trim()) : []
  const ci = Number(x.correta)
  const mc = x.formato === 'multipla' && alts.length >= 2 && Number.isInteger(ci) && ci >= 0 && ci < alts.length
  const valor = x.valor === null || x.valor === '' || x.valor === undefined || !isFinite(Number(x.valor)) ? null : Number(x.valor)
  const tol = Number(x.tolerancia)
  const dif = Number(x.dificuldade)
  const id = newId(S)
  return {
    id,
    dificuldade: Number.isFinite(dif) ? Math.max(0, Math.min(10, Math.round(dif))) : 3,
    materia,
    topico: String(x.topico || ''),
    conceito: String(x.conceito || x.topico || 'Questão'),
    tipo: x.tipo === 'conta' ? 'conta' : 'teoria',
    formato: mc ? 'multipla' : 'aberta',
    enunciado: String(x.enunciado),
    alternativas: mc ? alts : [],
    correta: mc ? ci : null,
    gabarito: String(x.gabarito || (mc ? 'ABCDE'[ci] + ') ' + alts[ci] : '')),
    unidade: String(x.unidade || ''),
    valor,
    tolerancia: tol > 0 && tol < 0.5 ? tol : 0.02,
    resolucao: String(x.resolucao || ''),
    erros: Array.isArray(x.erros) ? x.erros.map(String) : [],
    ideia: String(x.ideia || ''),
    dica: String(x.dica || ''),
    kind: 'nova',
    family: id,
    gen: 0,
  }
}

/** Aplica uma leva gerada à fila. */
export function addBatch(S: RushState, plan: PlanSlot[], raw: Record<string, unknown>[]): number {
  const list = raw
    .map((x, i) => {
      const p = plan[i] ?? plan[0]
      const q = normQ(S, x, p.s.id)
      if (!q) return null
      if (plan[i]) {
        q.dificuldade = Math.abs(q.dificuldade - p.d) <= 1 ? q.dificuldade : p.d
        q.boss = p.boss
        if (p.focus) {
          if (!q.topico) q.topico = p.focus.label
          if (p.focus.topicId) q.topicId = p.focus.topicId
        }
      }
      return q
    })
    .filter((q): q is RushQ => !!q)
  if (list.some((q) => q.boss)) S.nextBoss = (S.nextBoss || 15) + 15
  for (const q of list) {
    S.queue.push(q)
    S.recent.push(q.conceito)
  }
  S.recent = S.recent.slice(-80)
  return list.length
}

/** Quantas revisões de uma família já estão na fila ou sendo geradas. */
export const pendingFor = (S: RushState, fam: string, generating = 0) => S.queue.filter((q) => q.family === fam).length + generating

/** Coloca as variações na fila nas posições combinadas. */
export function addVariants(S: RushState, q: RushQ, raw: Record<string, unknown>[], n: number, opt: { offs?: number[]; long?: boolean }): Spawn | null {
  const list = raw
    .map((x) => normQ(S, x, q.materia))
    .filter((v): v is RushQ => !!v)
    .slice(0, n)
  if (!list.length) return null
  const offs = opt.offs ?? OFFSETS[list.length]
  list.forEach((v, i) => {
    Object.assign(v, {
      kind: 'revisao',
      family: q.family,
      gen: (q.gen || 0) + 1,
      parentQ: q.id,
      revIdx: i + 1,
      revOf: list.length,
      conceito: q.conceito,
      materia: q.materia,
      topicId: q.topicId,
      topico: v.topico || q.topico,
      long: !!opt.long,
    })
    S.queue.splice(Math.min(offs[i] ?? offs[offs.length - 1], S.queue.length), 0, v)
  })
  return { qid: q.id, n: list.length, offs, status: 'pronto', long: opt.long }
}

// ---------- Correção local ----------
function toN(t: string): number | null {
  let [mant] = t.split('e')
  const exp = t.split('e')[1]
  if (mant.includes('.') && mant.includes(',')) mant = mant.replace(/\./g, '').replace(',', '.')
  else if (mant.includes(',')) mant = mant.replace(',', '.')
  else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(mant)) mant = mant.replace(/\./g, '') // 1.000 = mil; 0.251 continua decimal
  const v = parseFloat(mant + (exp !== undefined ? 'e' + exp : ''))
  return isFinite(v) ? v : null
}

export function parseNum(raw: string): { v: number; rest: string } | null {
  let s = String(raw).trim().toLowerCase().replace(/−/g, '-').replace(/\s+/g, '')
  s = s.replace(/[×x·*]10\^?\(?([+-]?\d+)\)?/, 'e$1')
  let m = s.match(/^(-?\d+(?:[.,]\d+)?)\/(-?\d+(?:[.,]\d+)?)/)
  if (m) {
    const a = toN(m[1])
    const b = toN(m[2])
    return a != null && b ? { v: a / b, rest: s.slice(m[0].length) } : null
  }
  m = s.match(/^-?(?:\d[\d.,]*|[.,]\d+)(?:e[+-]?\d+)?/)
  if (!m) return null
  const v = toN(m[0])
  return v == null ? null : { v, rest: s.slice(m[0].length) }
}

const normUnit = (u: string) =>
  String(u || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[²]/g, '^2')
    .replace(/[³]/g, '^3')
    .replace(/\$|\\/g, '')

/** Conta com valor: confere o número (e a unidade, se digitada). true = certa; null = precisa da IA. */
export function localCheck(q: RushQ, ans: string): true | null {
  if (q.valor == null) return null
  const p = parseNum(ans)
  if (!p) return null
  if (p.rest && normUnit(p.rest) !== normUnit(q.unidade)) return null
  const tol = Math.max(q.tolerancia, 0.005)
  return (q.valor === 0 ? Math.abs(p.v) < 1e-9 : Math.abs(p.v - q.valor) <= tol * Math.abs(q.valor)) ? true : null
}

/** Teoria: igual ao gabarito (ignorando artigos, acentos e plural). */
export function localTheoryCheck(q: RushQ, ans: string): true | null {
  if (q.valor != null) return null
  const norm = (t: string) =>
    strip(t)
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\b(o|a|os|as|um|uma|de|do|da|e)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const g = norm(q.gabarito)
  const a = norm(ans)
  if (!g || !a) return null
  if (a === g) return true
  if (g.length >= 4 && a.length <= g.length + 3 && a.replace(/s\b/g, '') === g.replace(/s\b/g, '')) return true
  return null
}

// ---------- Missões ----------
const MISSION_T: { id: MissionId; n: number[] | null; text: (n: number, m?: string) => string; xp: number }[] = [
  { id: 'done', n: [15, 25, 40], text: (n) => `Resolva ${n} questões`, xp: 100 },
  { id: 'streak', n: [5, 8, 12], text: (n) => `Faça um combo de ${n}`, xp: 150 },
  { id: 'subj', n: [6, 10], text: (n, m) => `Acerte ${n} de ${m}`, xp: 120 },
  { id: 'fast', n: [5, 8], text: (n) => `Acerte ${n} em menos de 20s`, xp: 150 },
  { id: 'certeza', n: [6, 10], text: (n) => `Acerte ${n} com certeza`, xp: 150 },
  { id: 'rev', n: [3, 5], text: (n) => `Acerte ${n} revisões`, xp: 180 },
  { id: 'dif', n: null, text: (n) => `Acerte uma de dificuldade ${n}+`, xp: 200 },
  { id: 'boss', n: [1], text: () => 'Derrote 1 chefão', xp: 300 },
  { id: 'nohint', n: [8, 12], text: (n) => `Acerte ${n} sem dica e sem chute`, xp: 150 },
]

function newMission(S: RushState, exclude: string[], name: (id: string) => string): Mission {
  let pool = MISSION_T.filter((t) => !exclude.includes(t.id))
  if (S.stats.done < 5) pool = pool.filter((t) => t.id !== 'boss')
  if (!Object.keys(S.families).length) pool = pool.filter((t) => t.id !== 'rev')
  if (!S.cfg.subjects.length) pool = pool.filter((t) => t.id !== 'subj')
  const t = pool.length ? pick(pool) : MISSION_T[0]
  const n = t.id === 'dif' ? Math.max(4, Math.min(10, Math.round((S.level || 1) + 2))) : pick(t.n!)
  const m = t.id === 'subj' ? pick(S.cfg.subjects).id : undefined
  return { id: t.id, n, p: 0, done: false, xp: t.xp, item: Math.random() < 0.35 ? pick(Object.keys(ITEMS) as ItemId[]) : null, m, text: t.text(n, m && name(m)) }
}

export function ensureMissions(S: RushState, name: (id: string) => string) {
  S.missions = (S.missions || []).filter((m) => !m.done)
  let guard = 0
  while (S.missions.length < 3 && guard++ < 10) S.missions.push(newMission(S, S.missions.map((m) => m.id), name))
}

interface MissionEv {
  correct: boolean
  ms: number
  conf: Conf | ''
  hint: boolean
  rev: boolean
  dif: number
  boss: boolean
  materia: string
  streak: number
  fifty: boolean
}
function missionEvent(S: RushState, ev: MissionEv): Mission[] {
  const done: Mission[] = []
  for (const m of S.missions || []) {
    if (m.done) continue
    let inc = 0
    if (m.id === 'done') inc = 1
    else if (m.id === 'streak') m.p = Math.min(m.n, Math.max(m.p, ev.streak))
    else if (ev.correct) {
      if (m.id === 'subj' && ev.materia === m.m) inc = 1
      else if (m.id === 'fast' && ev.ms < 20000) inc = 1
      else if (m.id === 'certeza' && ev.conf === 'certeza') inc = 1
      else if (m.id === 'rev' && ev.rev) inc = 1
      else if (m.id === 'dif' && ev.dif >= m.n) inc = 1
      else if (m.id === 'boss' && ev.boss) inc = 1
      else if (m.id === 'nohint' && !ev.hint && ev.conf !== 'chute' && !ev.fifty) inc = 1
    }
    m.p = Math.min(m.n, m.p + inc)
    if (m.p >= m.n) {
      m.done = true
      done.push(m)
    }
  }
  return done
}

// ---------- Fluxo ----------
/** Vai para a próxima questão da fila. */
export function advance(S: RushState, name: (id: string) => string) {
  S.current = S.queue.shift() ?? null
  S.phase = 'answer'
  S.last = null
  S.qStart = Date.now()
  S.paused = 0
  ensureMissions(S, name)
}

export function famOf(S: RushState, q: RushQ): Family {
  return (S.families[q.family] ??= { conceito: q.conceito, topico: q.topico, materia: q.materia, erros: 0, acertos: 0, last: '', ts: 0 })
}

export function famStatus(S: RushState, id: string, f: Family, generating = 0): { label: string; tone: 'bad' | 'rev' | 'ok' } {
  const pend = pendingFor(S, id, generating)
  if (f.last === 'errou') return { label: 'pendente', tone: 'bad' }
  if (f.consolidado && !pend) return { label: 'dominado', tone: 'ok' }
  if (pend > 0) return { label: 'treinando', tone: 'rev' }
  if (f.last === 'duvida') return { label: 'dúvida', tone: 'rev' }
  return { label: 'recuperado', tone: 'ok' }
}

export interface FinishInput {
  correct: boolean
  comment?: string
  erro?: string
  naosei?: boolean
  conf: Conf
  hintUsed: boolean
  usedFifty: boolean
  now?: number
}

/** Pedido de variações que a página deve gerar com a IA. */
export interface SpawnRequest {
  q: RushQ
  n: number
  motivo: string
  offs?: number[]
  long?: boolean
}

/**
 * Registra a resposta da questão atual: placar, combo, escudo, dificuldade adaptativa,
 * pontos, missões, itens e caderno de erros do rush. Devolve as variações a gerar.
 */
export function finish(S: RushState, inp: FinishInput, name: (id: string) => string, generatingFor: (fam: string) => number = () => 0): SpawnRequest | null {
  const q = S.current
  if (!q) return null
  const now = inp.now ?? Date.now()
  const { correct, naosei = false, conf, hintUsed, usedFifty } = inp
  const ms = now - (S.qStart || now)
  const st = S.stats
  const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '')
  S.last = { ...(S.last ?? {}), correct, comment: naosei ? '' : cap(inp.comment ?? ''), erro: inp.erro ?? '', prevStreak: st.streak, ms, fifty: usedFifty, naosei }
  const L = S.last
  st.done++
  st.ms += ms
  const bs = (S.bySubj[q.materia] ??= { done: 0, correct: 0 })
  bs.done++

  // Escudo segura o combo num erro (não vale para "não sei")
  let shielded = false
  if (!correct && !naosei && st.streak > 0 && S.items.shield > 0) {
    S.items.shield--
    shielded = true
    L.shielded = true
  }
  if (correct) {
    st.correct++
    bs.correct++
    st.streak++
    st.best = Math.max(st.best, st.streak)
  } else if (!shielded) st.streak = 0

  // Volta por cima: 3 acertos seguidos depois de 3 erros seguidos
  let comeback = false
  if (correct) {
    if (S.cbNeed > 0) {
      S.cbNeed--
      if (S.cbNeed === 0) comeback = true
    }
    S.wrongRun = 0
  } else {
    S.wrongRun++
    S.cbNeed = 0
    if (S.wrongRun >= 3) {
      S.cbNeed = 3
      S.wrongRun = 0
    }
  }
  L.comeback = comeback

  // Dificuldade adaptativa (só nas questões novas)
  const dif = q.dificuldade ?? 3
  const prevLv = Math.floor(S.level || 1)
  if (q.kind === 'nova') {
    let dl: number
    if (naosei) dl = -0.8
    else if (correct) {
      const g = 0.75 + Math.min(st.streak, 5) * 0.07 + (conf === 'certeza' ? 0.15 : 0) + (ms < 40000 ? 0.15 : 0) + (dif >= S.level ? 0.2 : 0) - (hintUsed ? 0.25 : 0) - (usedFifty ? 0.2 : 0)
      dl = Math.max(0.1, g) * (1 - (S.level || 1) / 15) // sobe rápido no começo, desacelera perto do topo
    } else dl = -0.55 - (dif < S.level - 1 ? 0.35 : 0)
    S.level = Math.max(0, Math.min(10, (S.level || 1) + dl))
  }

  // Pontos
  const fast = correct && ms < 45000 && !hintUsed
  if (correct) {
    const pts = Math.round(10 * (dif + 1) * (1 + Math.min(st.streak - 1, 9) * 0.1) * (q.boss ? 3 : 1) * (hintUsed ? 0.5 : 1) * (usedFifty ? 0.5 : 1) * (q.kind === 'revisao' ? 0.8 : 1) * (fast ? 1.25 : 1))
    S.score += pts
    L.pts = pts
    L.fast = fast
    if (dif > S.maxDif) S.maxDif = dif
    if (q.boss) S.bosses++
    if (st.streak === 5 || (st.streak > 0 && st.streak % 10 === 0)) {
      const id = pick(Object.keys(ITEMS) as ItemId[])
      if (S.items[id] < 5) {
        S.items[id]++
        L.gift = id
      }
    }
    if (q.boss && S.items.shield < 5) {
      S.items.shield++
      L.gift2 = 'shield'
    }
  }
  const newLv = Math.floor(S.level)
  if (newLv > prevLv) L.levelUp = newLv
  else if (newLv < prevLv) L.levelDown = newLv

  // Missões (dão pontos de bônus e, às vezes, itens)
  const doneM = missionEvent(S, { correct, ms, conf: naosei ? '' : conf, hint: hintUsed, rev: q.gen > 0, dif, boss: !!q.boss, materia: q.materia, streak: st.streak, fifty: usedFifty })
  for (const m of doneM) {
    S.missionsDone++
    S.score += m.xp
    if (m.item) S.items[m.item] = Math.min(5, S.items[m.item] + 1)
  }
  L.missions = doneM
  ensureMissions(S, name)

  S.history.push({ id: q.id, family: q.family, materia: q.materia, topico: q.topico, conceito: q.conceito, rev: q.gen > 0, conf: naosei ? '' : conf, hint: hintUsed, correct, ms, ts: now, dif, boss: !!q.boss, pts: L.pts ?? 0 })
  if (S.history.length > 800) S.history = S.history.slice(-800)
  S.phase = 'feedback'
  if (!S.goalHit && st.done >= S.cfg.goal) S.goalHit = true

  // Revisões: errou → 3 variações; chute/dica → mais uma chance; acertou revisões → checagem final
  const room = (n: number) => Math.max(0, Math.min(n, 4 - pendingFor(S, q.family, generatingFor(q.family))))
  if (!correct) {
    const f = famOf(S, q)
    f.erros++
    f.last = 'errou'
    f.ts = now
    f.consolidado = false
    f.longQueued = false
    const n = room(q.gen === 0 ? 3 : q.gen >= 3 ? 1 : 2)
    if (conf === 'certeza' && !naosei) L.note = 'Você estava com certeza e errou: esse é o tipo de erro mais importante de consertar. Lê com calma a ideia-chave!'
    return n ? { q, n, motivo: naosei ? 'não soube fazer' : conf === 'certeza' ? 'errou mesmo tendo certeza (provável confusão de conceito)' : 'errou' } : null
  }
  if (conf === 'chute' || hintUsed) {
    const f = famOf(S, q)
    f.last = 'duvida'
    f.ts = now
    f.duvida = true
    L.doubt = true
    L.note = conf === 'chute' ? 'Acertou no chute! Vou trazer essa ideia de novo para ver se você sabe mesmo.' : 'Acertou com dica. Vou trazer de novo para você fazer sem ajuda.'
    const n = room(conf === 'chute' ? 2 : 1)
    return n ? { q, n, motivo: conf === 'chute' ? 'acertou, mas no chute' : 'acertou, mas precisou de dica' } : null
  }
  const f = S.families[q.family]
  if (f) {
    f.acertos++
    f.last = 'acertou'
    f.ts = now
    if (q.long) {
      f.consolidado = true
      L.note = 'Checagem final certinha! Esse conceito está dominado.'
    } else if (q.gen > 0 && S.cfg.longReview && !f.longQueued && !f.consolidado && pendingFor(S, q.family, generatingFor(q.family)) === 0) {
      f.longQueued = true
      return { q, n: 1, motivo: 'já acertou as revisões; esta é uma checagem final depois de um tempo, pra ver se fixou de verdade', offs: [18], long: true }
    }
  }
  return null
}

/** "Na real eu acertei": desfaz o erro de uma questão digitada. */
export function override(S: RushState) {
  const q = S.current
  const L = S.last
  if (!q || !L || L.correct) return
  const st = S.stats
  st.correct++
  st.streak = (L.prevStreak ?? 0) + 1
  st.best = Math.max(st.best, st.streak)
  const bs = S.bySubj[q.materia]
  if (bs) bs.correct++
  const he = S.history[S.history.length - 1]
  if (he && he.id === q.id) he.correct = true
  S.cancelled = [...S.cancelled, q.id].slice(-200)
  S.queue = S.queue.filter((x) => x.parentQ !== q.id)
  const f = S.families[q.family]
  if (f) {
    f.erros = Math.max(0, f.erros - 1)
    f.last = 'acertou'
    if (!f.erros && !f.duvida) delete S.families[q.family]
  }
  Object.assign(L, { correct: true, overridden: true, spawn: null })
}

/** Começa de novo, mantendo os ajustes e o som. */
export function restart(S: RushState): RushState {
  const d = defaultRushState()
  d.cfg = S.cfg
  d.sound = S.sound
  d.soundChosen = S.soundChosen
  return d
}

export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}
export const fmtLong = (ms: number) => {
  const m = Math.round(ms / 60000)
  return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0')
}
