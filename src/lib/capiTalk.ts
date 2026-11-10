import type { CapiPose } from '../components/Capybara'
import { showMascot, type MascotMessage } from './mascotBus'

export interface CapiBlock {
  id: string
  label: string
  start: number
  end: number
}

export interface CapiContext {
  name: string
  now: Date
  hasSubjects: boolean
  hasWeek: boolean
  /** Próximo bloco de estudo de hoje ainda não feito. */
  nextToday?: CapiBlock
  /** Blocos de hoje que já passaram sem serem feitos nem iniciados. */
  missedToday: CapiBlock[]
  notesCount: number
  /** Revisões vencidas até hoje (nomes dos tópicos). */
  reviewsDue: string[]
  streak: number
  timerRunning: boolean
  startBlock: (id: string) => void
  markDone: (id: string) => void
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const nowMin = (d: Date) => d.getHours() * 60 + d.getMinutes()

export const CAPI_FACTS = [
  'Sabia que a capivara é o maior roedor do mundo? E mesmo assim é a mais tranquila da turma.',
  'Capivaras conseguem ficar alguns minutos debaixo d’água. Foco também é prender o fôlego e mergulhar no assunto.',
  'Os dentes da frente da capivara crescem a vida toda. Igual ao seu conhecimento, se você continuar estudando.',
  'O nome capivara vem do tupi e significa algo como “comedora de capim”. Eu prefiro dizer “comedora de conteúdo”.',
  'Capivaras vivem em grupo. Estudar com alguém e explicar a matéria em voz alta ajuda muito a fixar.',
  'Capivaras passam boa parte do dia descansando. Pausas fazem parte do aprendizado, viu?',
]

export const CAPI_TIPS = [
  'Dica: comece pelo bloco mais difícil enquanto a cabeça está descansada.',
  'Dica: depois de estudar, tente explicar o tópico com suas palavras no caderno. Se travar, é ali que precisa revisar.',
  'Dica: dormir bem é quando a memória se consolida. Virar a noite costuma sair caro.',
  'Dica: alternar matérias no mesmo dia ajuda o cérebro a separar e fixar os assuntos.',
  'Dica: use [[ligações]] no caderno para conectar ideias de matérias diferentes.',
  'Dica: beba água e levante um pouco entre os blocos. Seu foco agradece.',
]

/** Mensagem de boas-vindas ao abrir o site. */
export function capiWelcome(ctx: CapiContext): MascotMessage {
  const h = ctx.now.getHours()
  const late = h < 5 || h >= 23
  const greeting = late ? 'Olá' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const pose: CapiPose = late ? 'dormindo' : h < 12 ? 'acenando' : h < 18 ? pick(['acenando', 'relaxando']) : pick(['acenando', 'estudando'])
  const title = `${greeting}, ${ctx.name}!`
  const close = { label: 'Valeu, Capi!' }

  if (!ctx.hasSubjects)
    return {
      pose: 'acenando',
      title,
      text: 'Eu sou o Capi, a capivara que vai te acompanhar nos estudos. Bora começar cadastrando suas matérias?',
      actions: [{ label: 'Cadastrar matérias', primary: true, to: '/materias' }, close],
    }
  if (!ctx.hasWeek)
    return { pose: 'pensando', title, text: 'Semana nova chegando! Me conta onde você quer focar e eu monto o plano.', actions: [{ label: 'Montar a semana', primary: true, to: '/checkin' }, close] }
  if (late) return { pose, title, text: 'Estudando até tarde? Faz um bloco leve e vai descansar. É dormindo que a memória se fixa. 🌙', actions: [close] }

  const reviewLine = ctx.reviewsDue.length
    ? ` E tem ${ctx.reviewsDue.length === 1 ? `1 revisão pendente (${ctx.reviewsDue[0]})` : `${ctx.reviewsDue.length} revisões pendentes`} te esperando.`
    : ''
  const next = ctx.nextToday
  if (next && next.start <= nowMin(ctx.now))
    return { pose: 'focado', title, text: `Agora é hora de ${next.label}. Vamos nessa?${reviewLine}`, actions: [{ label: 'Começar agora', primary: true, run: () => ctx.startBlock(next.id) }, close] }
  if (next) {
    const streakLine = ctx.streak > 1 ? ` Você está há ${ctx.streak} dias seguidos estudando, não quebra a sequência!` : ''
    return { pose, title, text: `Seu próximo bloco é ${next.label}, às ${hhmm(next.start)}.${streakLine}${reviewLine}`, actions: [{ label: 'Começar já', primary: true, run: () => ctx.startBlock(next.id) }, close] }
  }
  if (ctx.reviewsDue.length)
    return { pose: 'estudando', title, text: `Nada de bloco novo agora, mas${reviewLine.replace(' E tem', '')} Revisar rapidinho faz toda a diferença.`, actions: [{ label: 'Ver revisões', primary: true, to: '/' }, close] }
  if (ctx.streak > 1) return { pose: 'formado', title, text: `${ctx.streak} dias seguidos de estudo! Hoje está livre no plano, mas uma revisão rápida mantém a sequência.`, actions: [close] }
  return { pose: 'relaxando', title, text: 'Hoje não tem nada no plano. Aproveita para descansar ou revisar algo no caderno.', actions: [{ label: 'Abrir caderno', to: '/caderno' }, close] }
}

/** Perguntas e conversas quando você clica no Capi. `n` alterna o assunto. */
export function capiQuestion(ctx: CapiContext, n: number): MascotMessage {
  const close = { label: 'Agora não' }
  const contextual: MascotMessage[] = []

  if (ctx.timerRunning) contextual.push({ pose: 'focado', title: 'Foco total!', text: 'Você está no meio de um bloco. Vou ficar quietinho aqui do lado. 🤫', actions: [{ label: 'Valeu!' }] })

  const missed = ctx.missedToday[0]
  if (missed)
    contextual.push({
      pose: 'pensando',
      title: 'Uma perguntinha…',
      text: `O bloco de ${missed.label} (${hhmm(missed.start)}) ficou pra trás. Você conseguiu estudar?`,
      actions: [
        {
          label: 'Sim, já estudei',
          primary: true,
          run: () => ctx.markDone(missed.id),
        },
        {
          label: 'Não deu',
          run: () => showMascot({ pose: 'relaxando', title: 'Tudo bem!', text: 'Acontece. Se der, encaixa uma revisão curta hoje ou amanhã. O importante é não parar.', autoHideMs: 7000 }),
        },
      ],
    })

  const next = ctx.nextToday
  if (next && !ctx.timerRunning)
    contextual.push({
      pose: 'estudando',
      title: 'Bora estudar?',
      text: next.start <= nowMin(ctx.now) ? `Já está na hora de ${next.label}. Quer começar?` : `Seu próximo bloco é ${next.label}, às ${hhmm(next.start)}. Quer adiantar?`,
      actions: [{ label: 'Começar', primary: true, run: () => ctx.startBlock(next.id) }, close],
    })

  if (ctx.reviewsDue.length)
    contextual.push({
      pose: 'estudando',
      title: 'Hora de revisar',
      text: `${ctx.reviewsDue.length === 1 ? `A revisão de ${ctx.reviewsDue[0]} venceu` : `${ctx.reviewsDue.length} revisões venceram`}. Uma revisada rápida e isso fica na memória de vez.`,
      actions: [{ label: 'Ver revisões', primary: true, to: '/' }, close],
    })

  if (ctx.notesCount === 0 && ctx.hasSubjects)
    contextual.push({ pose: 'estudando', title: 'Caderno vazio?', text: 'Você ainda não escreveu nenhuma nota. Que tal anotar o que aprendeu hoje?', actions: [{ label: 'Abrir caderno', primary: true, to: '/caderno' }, close] })

  const general: MascotMessage[] = [
    {
      pose: 'pensando',
      title: 'Como você está hoje?',
      text: 'Me conta: como está sua energia agora?',
      actions: [
        {
          label: 'Cheio de energia ⚡',
          primary: true,
          run: () => showMascot({ pose: 'focado', title: 'Então aproveita!', text: 'Ataca a matéria mais difícil primeiro, enquanto a cabeça está a mil.', autoHideMs: 7000 }),
        },
        {
          label: 'Meio cansado 😴',
          run: () => showMascot({ pose: 'relaxando', title: 'Vai no seu ritmo', text: 'Faz um bloco curto e leve, uma revisão já conta. E descansa direitinho depois.', autoHideMs: 7000 }),
        },
      ],
    },
    {
      pose: 'pensando',
      title: 'Pergunta rápida',
      text: 'Qual matéria está sendo a mais difícil essa semana? Vale aumentar o peso dela em Matérias.',
      actions: [{ label: 'Ajustar pesos', primary: true, to: '/materias' }, close],
    },
    { pose: pick<CapiPose>(['relaxando', 'acenando', 'formado']), title: 'Curiosidade de capivara', text: pick(CAPI_FACTS), actions: [{ label: 'Haha, legal!' }] },
    { pose: pick<CapiPose>(['estudando', 'focado', 'formado']), title: 'Dica do Capi', text: pick(CAPI_TIPS), actions: [{ label: 'Anotado!' }] },
  ]

  const all = [...contextual, ...general]
  return all[n % all.length]
}
