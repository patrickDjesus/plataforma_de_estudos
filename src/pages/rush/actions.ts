import { AIError, getAI } from '../../lib/ai'
import {
  addBatch,
  addVariants,
  advance,
  checkPrompt,
  ensureMissions,
  finish as finishEngine,
  genPrompt,
  ITEMS,
  localCheck,
  localTheoryCheck,
  override as overrideEngine,
  parseLoose,
  pick,
  planBatch,
  rawList,
  restart as restartEngine,
  shuffle,
  variantPrompt,
  type Conf,
  type ItemId,
  type RushQ,
  type SpawnRequest,
} from '../../lib/rush'
import { fixRushAnswer, logRushAnswer, logRushError } from '../../db/practice'
import { db } from '../../db/db'
import { playSfx, type Sfx } from '../../lib/sfx'
import { generatingFor, runtime, rush } from './store'

// ---------- Nomes das matérias e tópicos (vêm do banco, via página) ----------
let names = { subject: (id: string) => id, topic: (_id: string) => undefined as string | undefined }
export function setLookups(l: typeof names) {
  names = l
}
export const subjectName = (id: string) => names.subject(id)

// ---------- Som e fala da Capi ----------
export function sfx(kind: Sfx) {
  if (rush.get().sound) playSfx(kind)
}

export const LINES = {
  newq: {
    calm: ['Bora, essa é de aquecimento', 'Tranquila. Lê com calma.', 'Essa você tira de letra.', 'Uma de cada vez. Vai.', 'Olha, essa é presente.'],
    warm: ['Essa já pede atenção…', 'Hmm, capricha nessa.', 'Lê duas vezes antes de responder.', 'Tem pegadinha no ar? Talvez.'],
    hot: ['Olha o nível subindo, hein', 'Agora é sério. Respira.', 'Essa separa quem estudou.', 'Tá ficando quente aqui…'],
    demon: ['Hehe. Vamos ver se você aguenta essa.', 'Essa aqui derrubou muita gente.', 'Sem dica dessa vez? Duvido.', 'Seu combo tá em perigo'],
    boss: ['CHEFÃO NA ÁREA. Lê duas vezes.', 'Vale 3x. Não erra feio.', 'Ele tá te olhando. Vai com tudo.'],
    rev: ['Essa ideia voltou. Mostra que aprendeu!', 'Olha ela de novo. Dessa vez vai.', 'Revisão! A mesma ideia, outra roupa.'],
  },
  pick: ['Hmm, {L}? Tem certeza?', '{L}… boa escolha… ou não', 'Confere a conta antes do Enter.', 'Na dúvida entre duas, elimina as erradas.', '{L}. Se tá firme, manda.'],
  typing: ['Tô vendo você digitar… capricha', 'Não esquece a unidade!', 'Só a resposta final, sem enrolar.'],
  t60: ['1 minuto. Sem pressa, mas sem dormir.', 'Tá pensando bastante. Bom sinal… eu acho.', 'Um minutinho já. Quer uma dica?'],
  t150: ['Travou? Tenta a dica ou chuta e aprende.', 'Vale mais errar e aprender do que ficar preso.', 'Pode marcar Chute, eu trago essa de volta.'],
  idle: ['Tá aí?', 'Ei… a questão não se resolve sozinha.', 'Alô? Terra chamando.', 'Foi buscar um café? Tô esperando.'],
  sleepy: ['zZz… me acorda quando voltar.'],
  wake: ['Opa, acordei! Bora?', 'Voltou! Vamos lá.', 'Dormi? Não dormi. Responde aí.'],
  certeza: ['Confiante! Gosto disso', 'Certeza? Então vai.', 'Essa postura. Agora prova.'],
  chute: ['Chute é válido, mas eu vou cobrar depois', 'Chutou? Vou trazer essa de volta, hein.', 'Chute honesto vale mais que certeza falsa.'],
  acho: ['Acha? Então confere mais uma vez.', '"Acho" é o começo do "sei".'],
  hint: ['Toma a dica. Agora vai.', 'Dica liberada. Metade dos pontos, mas tá valendo.', 'Pronto, dei um empurrãozinho.'],
  fifty: ['Zap! Duas erradas sumiram.', 'Sobraram 3. Agora é com você.', '50/50 usado. Não desperdiça.'],
  pause: ['Vai lá, bebe água. Eu espero', 'Pausa merecida. Volta logo.'],
  correct: {
    low: ['Isso!', 'Boa!', 'Aí sim.', 'É disso que eu gosto.', 'Certinho', 'Mandou bem.'],
    mid: ['Tá esquentando', 'Combo subindo!', 'Ninguém segura.', 'Que sequência boa!'],
    high: ['VOCÊ TÁ ON FIRE', 'Para, tá humilhando.', 'Monstro. Simplesmente monstro.', 'Isso é um rush de verdade.'],
    demon: ['Hmpf. Dessa vez passou.', 'Sorte. Só sorte.', 'Tá… essa foi boa.', 'Você tá melhor do que eu pensava'],
    boss: ['ACABOU COM O CHEFÃO', 'Ele nem viu de onde veio!', 'Chefão? Que chefão?'],
    fast: ['Rápido demais!', 'Nem pensou e acertou. Perigoso.', 'Velocidade e precisão. Chique.'],
  },
  wrong: {
    calm: ['Relaxa, a ideia volta daqui a pouco.', 'Errar aqui é melhor que errar na prova.', 'Olha a resolução, vai fazer sentido.', 'Anota essa. Ela volta.'],
    certeza: ['Eita, tinha certeza? Esse erro vale ouro: lê a resolução.', 'Confiança boa, resposta errada. Anota essa.', 'Essa é a que mais ensina. Lê com calma.'],
    naosei: ['Beleza, bora aprender do zero então.', 'Sem problema. Lê os passos com calma.', 'Primeira vez vendo? Agora não é mais.'],
    demon: ['HAHA. Eu avisei.', 'Mais um pro meu caderno', 'Essa era braba. Volta mais forte.'],
    boss: ['Ele venceu hoje. Vai voltar pra te pegar.', 'Chefão 1 x 0. Por enquanto.', 'Doeu? Doeu. Bora revisar.'],
  },
  click: ['Ei! Foca na questão', 'Tô aqui te esperando.', 'Cutuca não, responde.', 'Tô observando. Sempre.', 'Me dá um combo de 5 que eu danço.', 'Eu era uma capivara tranquila. Agora sou sua coach.'],
} as const

type LineKey = keyof typeof LINES
type Listener = (line: string) => void
const talkers = new Set<Listener>()
let lastLine = ''
export function onTalk(l: Listener) {
  talkers.add(l)
  return () => {
    talkers.delete(l)
  }
}
/** A Capi fala uma frase do grupo (e do tom) pedido. */
export function say(key: LineKey, tier?: string, vars?: { L?: string }) {
  let pool: readonly string[] | Record<string, readonly string[]> = LINES[key]
  if (!Array.isArray(pool)) {
    const obj = pool as Record<string, readonly string[]>
    pool = (tier && obj[tier]) || obj.calm || obj.low || Object.values(obj)[0]
  }
  const list = pool as readonly string[]
  let line = pick(list)
  if (list.length > 1 && line === lastLine) line = pick(list)
  lastLine = line
  line = line.replace('{L}', vars?.L ?? '')
  talkers.forEach((f) => f(line))
}
export function newqTier(q: RushQ | null) {
  if (!q) return 'calm'
  if (q.boss) return 'boss'
  if (q.kind === 'revisao' && Math.random() < 0.6) return 'rev'
  const d = q.dificuldade ?? 3
  return d >= 8 ? 'demon' : d >= 6 ? 'hot' : d >= 4 ? 'warm' : 'calm'
}

// ---------- Avisos rápidos (toasts) e grandes letreiros ----------
export interface Toast {
  id: number
  text: string
  tone?: 'gold' | 'item'
}
type ToastL = (t: Toast) => void
const toastL = new Set<ToastL>()
let tid = 0
export function onToast(l: ToastL) {
  toastL.add(l)
  return () => {
    toastL.delete(l)
  }
}
export function toast(text: string, tone?: Toast['tone']) {
  const t = { id: ++tid, text, tone }
  toastL.forEach((f) => f(t))
}
type MegaL = (text: string) => void
const megaL = new Set<MegaL>()
export function onMega(l: MegaL) {
  megaL.add(l)
  return () => {
    megaL.delete(l)
  }
}
export function mega(text: string) {
  megaL.forEach((f) => f(text))
}

// ---------- IA ----------
const FATAL = ['not_granted', 'sampling_disabled', 'unavailable', 'session_expired']

export function errCopy(code?: string | null) {
  return (
    (code &&
      {
        unavailable: 'A IA só funciona com o Mendonça aberto pelo claude.ai.',
        not_granted: 'Você não liberou o uso do Claude nesta página. Recarregue e aceite o pedido de permissão.',
        sampling_disabled: 'O Claude não está disponível para essa conta.',
        rate_limited: 'Bateu no limite de uso por agora. Espere um pouco e tente de novo.',
        session_expired: 'Sua sessão expirou. Entre de novo no claude.ai.',
        invalid_json: 'A IA respondeu num formato estranho. Tente de novo.',
        refused: 'A IA não quis responder isso.',
        empty: 'A IA não mandou nenhuma questão válida. Tente de novo.',
      }[code]) ||
    'Deu um erro de conexão com a IA. Tente de novo.'
  )
}

async function aiText(prompt: string, tier: 'quick' | 'default' = 'default', onText?: (t: string) => void, signal?: AbortSignal) {
  const ai = await getAI()
  if (!ai) {
    runtime.update({ aiFatal: 'unavailable', aiReady: 'sem' })
    throw new AIError('unavailable', errCopy('unavailable'))
  }
  try {
    return await ai.text(prompt, { tier, fresh: true, onText, signal })
  } catch (e) {
    const code = e instanceof AIError ? e.code : 'upstream_error'
    if (FATAL.includes(code)) runtime.update({ aiFatal: code })
    throw e instanceof AIError ? e : new AIError(code, errCopy(code))
  }
}

async function aiJSON(prompt: string, tier: 'quick' | 'default' = 'default') {
  const text = await aiText(prompt, tier)
  const v = parseLoose(text)
  if (v === undefined) throw new AIError('invalid_json', errCopy('invalid_json'), text)
  return v
}

export async function checkAI() {
  const ai = await getAI()
  runtime.update({ aiReady: ai ? 'ok' : 'sem', aiFatal: ai ? runtime.get().aiFatal : 'unavailable' })
}

const taskId = () => Math.random().toString(36).slice(2)

/** Gera uma leva de questões novas. */
export async function fill(n = 5) {
  const S0 = rush.get()
  if (!S0.cfg.subjects.length) return
  const id = taskId()
  runtime.update((r) => ({ freshInFlight: r.freshInFlight + 1, tasks: [...r.tasks, { id, label: `Gerando ${n} questões novas…` }] }))
  const plan = rush.update((S) => planBatch(S, n, names.topic))
  try {
    const raw = rawList(await aiJSON(genPrompt(rush.get(), plan, names.subject), 'default'))
    const added = rush.update((S) => addBatch(S, plan, raw))
    if (!added) throw new AIError('empty', errCopy('empty'))
    runtime.update({ fillError: null })
  } catch (e) {
    runtime.update({ fillError: e instanceof AIError ? e.code : 'upstream_error' })
  } finally {
    runtime.update((r) => ({ freshInFlight: r.freshInFlight - 1, tasks: r.tasks.filter((t) => t.id !== id) }))
  }
  const S = rush.get()
  if (S.started && !S.current && S.queue.length) goNext(true)
}

/** Mantém a fila abastecida: quando sobra 1 questão nova, pede mais 5. */
export function ensureFill() {
  const S = rush.get()
  const r = runtime.get()
  if (!S.started || r.aiFatal) return
  const fresh = S.queue.filter((q) => q.kind === 'nova').length
  if (fresh <= 1 && r.freshInFlight === 0 && !r.fillError) fill(5)
}

/** Gera as variações de uma ideia (revisões que voltam na fila). */
async function spawnVariants(req: SpawnRequest, lastOverride?: null) {
  const { q, n, motivo, offs, long } = req
  if (!n || runtime.get().aiFatal) return
  const id = taskId()
  runtime.update((r) => ({ tasks: [...r.tasks, { id, label: long ? `Agendando checagem final: ${q.conceito}` : `Criando ${n} ${n > 1 ? 'revisões' : 'revisão'}: ${q.conceito}`, family: q.family, n }] }))
  const setSpawn = (sp: NonNullable<RushStateLast>['spawn']) =>
    rush.update((S) => {
      if (S.last && S.current?.id === q.id) S.last.spawn = sp
    })
  setSpawn({ qid: q.id, n, offs: offs ?? [], status: 'gerando', long })
  try {
    const last = lastOverride === null ? null : rush.get().current?.id === q.id ? rush.get().last : null
    const raw = rawList(await aiJSON(variantPrompt(rush.get(), q, n, motivo, last, names.subject), 'default'))
    runtime.update((r) => ({ tasks: r.tasks.filter((t) => t.id !== id) }))
    if (rush.get().cancelled.includes(q.id)) return setSpawn({ qid: q.id, n, offs: [], status: 'cancelada' })
    const sp = rush.update((S) => addVariants(S, q, raw, n, { offs, long }))
    if (!sp) throw new AIError('empty', errCopy('empty'))
    setSpawn(sp)
    toast(long ? `Checagem final de "${q.conceito}" agendada` : `${sp.n} ${sp.n > 1 ? 'revisões entraram' : 'revisão entrou'} na fila: ${q.conceito}`)
    sfx('whoosh')
  } catch (e) {
    runtime.update((r) => ({ tasks: r.tasks.filter((t) => t.id !== id) }))
    setSpawn({ qid: q.id, n, offs: [], status: 'erro', err: e instanceof AIError ? e.code : 'upstream_error' })
  }
  const S = rush.get()
  if (S.started && !S.current && S.queue.length) goNext(true)
}
type RushStateLast = ReturnType<typeof rush.get>['last']

// ---------- Fluxo da questão ----------
export function goNext(silent = false) {
  rush.update((S) => advance(S, names.subject))
  ensureFill()
  const q = rush.get().current
  if (q && !silent) {
    window.setTimeout(() => say('newq', newqTier(q)), 350)
  } else if (q) window.setTimeout(() => say('newq', newqTier(q)), 350)
}

export interface AnswerCtx {
  conf: Conf
  hintUsed: boolean
  fiftyHidden: number[]
}

/** Registra a resposta (placar, banco, caderno de erros, revisões, efeitos). */
export function finishAnswer(correct: boolean, ctx: AnswerCtx, extra: { comment?: string; erro?: string; naosei?: boolean } = {}) {
  const q = rush.get().current
  if (!q) return
  const req = rush.update((S) => finishEngine(S, { correct, comment: extra.comment, erro: extra.erro, naosei: extra.naosei, conf: ctx.conf, hintUsed: ctx.hintUsed, usedFifty: ctx.fiftyHidden.length > 0 }, names.subject, generatingFor))
  const S = rush.get()
  // Estatísticas do Mendonça: questão feita (e acerto), erro no caderno
  logRushAnswer(q.materia, q.topicId, correct).catch(() => undefined)
  if (!correct) logRushError(q, S.last).catch(() => undefined)
  if (req) spawnVariants(req)
  else if (!correct)
    rush.update((d) => {
      if (d.last) d.last.spawn = { qid: q.id, n: 0, offs: [], status: 'skip' }
    })
  celebrate(correct)
}

function celebrate(correct: boolean) {
  const S = rush.get()
  const L = S.last ?? {}
  const q = S.current
  const st = S.stats
  const heat = q ? (q.boss ? 1 : (q.dificuldade ?? 3) / 10) : 0
  const demon = heat >= 0.8 && !q?.boss
  let delay = 300
  const later = (fn: () => void, ms?: number) => window.setTimeout(fn, ms ?? (delay += 900))
  if (correct) {
    sfx('ok')
    say('correct', q?.boss ? 'boss' : demon ? 'demon' : L.fast && st.streak < 4 && Math.random() < 0.5 ? 'fast' : st.streak >= 10 ? 'high' : st.streak >= 4 ? 'mid' : 'low')
    if (q?.boss) later(() => (mega('CHEFÃO DERROTADO!'), sfx('big')), 300)
    else if ([5, 10, 15, 20, 30, 40, 50, 75, 100].includes(st.streak)) later(() => (mega(`${st.streak} seguidas!`), sfx('big')), 350)
    else if (L.levelUp) later(() => (mega(`Dificuldade ${L.levelUp}`), sfx('big'), toast('As questões vão ficar um pouco mais difíceis!')), 350)
    if (L.comeback) later(() => (mega('VOLTA POR CIMA'), sfx('big')))
  } else {
    sfx(L.shielded ? 'shield' : 'bad')
    say('wrong', q?.boss ? 'boss' : demon ? 'demon' : L.naosei ? 'naosei' : 'calm')
    if (L.shielded) later(() => toast(`Escudo usado: seu combo continua em ${st.streak}!`, 'item'), 500)
    if (q?.boss) later(() => toast('O chefão venceu dessa vez. Ele volta mais pra frente!'), 900)
    else if (L.levelDown) later(() => toast('Dei uma segurada na dificuldade para calibrar'), 900)
  }
  if (L.gift) later(() => giveItemFx(L.gift!, `pelo combo de ${st.streak}`))
  if (L.gift2) later(() => giveItemFx(L.gift2!, 'por vencer o chefão'))
  for (const m of L.missions ?? []) later(() => (toast(`Missão completa: ${m.text} · +${m.xp} pts${m.item ? ` + ${ITEMS[m.item].name}` : ''}`, 'gold'), sfx('badge')))
  if (S.goalHit && st.done === S.cfg.goal) later(() => (mega('META BATIDA!'), sfx('big')), 600)
  else if (st.done % 50 === 0 && st.done) later(() => toast(`${st.done} questões feitas!`), 1200)
}

function giveItemFx(id: ItemId, why: string) {
  toast(`Ganhou ${ITEMS[id].name} ${why}!`, 'item')
  sfx('gift')
}

/** Confere a resposta: local primeiro, IA se preciso, autoavaliação se a IA falhar. */
export async function submit(ctx: AnswerCtx, input: { choice: number | null; answer: string; rac: string }) {
  const S = rush.get()
  const q = S.current
  if (!q || S.phase !== 'answer') return
  if (q.formato === 'multipla') {
    if (input.choice == null) return
    rush.update((d) => (d.last = { choice: input.choice }))
    const ok = input.choice === q.correta
    const why = q.erros[input.choice] ?? ''
    return finishAnswer(ok, ctx, ok ? {} : { comment: why, erro: why || `marcou ${'ABCDE'[input.choice]}` })
  }
  const ans = input.answer.trim()
  if (!ans) return
  rush.update((d) => (d.last = { answer: ans, rac: input.rac.trim() }))
  if (localCheck(q, ans) === true || localTheoryCheck(q, ans) === true) return finishAnswer(true, ctx)
  rush.update((d) => (d.phase = 'checking'))
  try {
    const r = (await aiJSON(checkPrompt(q, ans, input.rac.trim()), S.cfg.grading === 'caprichada' ? 'default' : 'quick')) as { correta?: boolean; comentario?: string; erro?: string }
    if (rush.get().current?.id !== q.id) return
    finishAnswer(r?.correta === true, ctx, { comment: String(r?.comentario ?? ''), erro: String(r?.erro ?? '') })
  } catch (e) {
    if (rush.get().current?.id !== q.id) return
    rush.update((d) => {
      d.phase = 'selfgrade'
      if (d.last) d.last.aiErr = e instanceof AIError ? e.code : 'upstream_error'
    })
  }
}

/** "Fiquei em dúvida, manda de novo". */
export function markDoubt() {
  const S = rush.get()
  const q = S.current
  if (!q || !S.last) return
  rush.update((d) => {
    const f = (d.families[q.family] ??= { conceito: q.conceito, topico: q.topico, materia: q.materia, erros: 0, acertos: 0, last: '', ts: 0 })
    f.last = 'duvida'
    f.ts = Date.now()
    f.duvida = true
    if (d.last) d.last.doubt = true
  })
  spawnVariants({ q, n: 2, motivo: 'acertou, mas ficou em dúvida (talvez chutou)' })
}

/** "Na real eu acertei". */
export function overrideWrong() {
  const q = rush.get().current
  if (!q) return
  rush.update((S) => overrideEngine(S))
  fixRushAnswer(q.materia, q.topicId).catch(() => undefined)
  // Sem outros erros dessa ideia, ela sai do caderno de erros também
  if (!rush.get().families[q.family]) db.errors.delete(`rush-${q.family}`).catch(() => undefined)
  celebrate(true)
}

export function applyFifty(q: RushQ): number[] {
  const S = rush.get()
  if (q.formato !== 'multipla' || q.correta == null || S.items.fifty <= 0) return []
  rush.update((d) => d.items.fifty--)
  sfx('zap')
  say('fifty')
  const wrong = q.alternativas.map((_, i) => i).filter((i) => i !== q.correta)
  return shuffle(wrong).slice(0, Math.min(2, wrong.length))
}

export function skipQuestion() {
  const S = rush.get()
  if (!S.current || S.phase !== 'answer' || S.items.skip <= 0) return
  rush.update((d) => {
    d.items.skip--
    d.skipped++
  })
  sfx('skip')
  toast('Pulou. Não conta como erro.')
  goNext()
}

export function togglePause() {
  rush.update((d) => {
    if (d.paused) {
      d.qStart += Date.now() - d.paused
      d.paused = 0
    } else d.paused = Date.now()
  })
  say(rush.get().paused ? 'pause' : 'wake')
}

export function startRush() {
  rush.update((d) => {
    d.started = true
    d.view = 'rush'
    ensureMissions(d, names.subject)
  })
  runtime.update({ fillError: null })
  sfx('big')
  fill(5)
}

export function restartRush() {
  rush.set(restartEngine(rush.get()))
  runtime.update({ fillError: null, tasks: [] })
}

export async function askAboutQuestion(prompt: string, onText: (t: string) => void, signal: AbortSignal) {
  return aiText(prompt, 'quick', onText, signal)
}
export async function diagnose(prompt: string, onText: (t: string) => void) {
  return aiText(prompt, 'default', onText)
}
