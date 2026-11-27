import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bug, CheckCircle2, ClipboardPaste, Copy, Download, Sparkles, Dices, Dumbbell, Gamepad2, GraduationCap, HeartPulse, Landmark, Loader2, Lock, Plus, Send, Store, Trash2, Truck, UtensilsCrossed, Wrench, XCircle } from 'lucide-react'
import { db, uid } from '../db/db'
import type { OfficeLog, OfficeProject, OfficeTask } from '../db/types'
import { AIError, getAI } from '../lib/ai'
import { centerOf, confetti, playSfx } from '../lib/sfx'
import { showMascot } from '../lib/mascotBus'
import { askConfirm } from './confirm'
import { Capybara } from './Capybara'
import { applyConceptResult, conceptId, conceptState, pickCandidates } from '../lib/concepts'
import { Boss, bossGender, type BossMood } from './OfficeBoss'
import { CodeEditor, GradeRing, LANG_NAME, RichText, runJS, type Lang, type RunResult } from './CodeLab'

/*
 * Modo Empresarial: a IA inventa uma empresa e um sisteminha, e o gerente passa tarefas
 * (função nova, bug para corrigir, melhoria) uma de cada vez, no mesmo arquivo.
 */

const LEVELS: { id: string; bars: number; text: string; tasks: number; lines: string; rules: string }[] = [
  {
    id: 'Estagiário',
    bars: 1,
    text: 'if, contas, textos e funções',
    tasks: 4,
    lines: '45 a 70',
    rules: 'if/else, contas, textos e funções que chamam funções já prontas do arquivo. Exatamente 1 tarefa "bug", simples (conta errada, comparação trocada, > no lugar de >=). Nada de dicionário dentro de dicionário.',
  },
  {
    id: 'Júnior',
    bars: 2,
    text: 'listas, laços e dicionários',
    tasks: 5,
    lines: '80 a 110',
    rules: 'Listas, for, dicionários e listas de dicionários, funções usando outras funções do arquivo, regras de negócio com 2 ou 3 casos. Exatamente 2 tarefas "bug" (uma de lógica, uma de caso de borda) e 1 "melhoria".',
  },
  {
    id: 'Júnior+',
    bars: 3,
    text: 'código bagunçado, bugs sutis e regras de negócio',
    tasks: 6,
    lines: '110 a 150',
    rules: 'Listas de dicionários, contagem e agrupamento, ordenação, validação de dados sujos, regras de negócio com várias faixas (desconto progressivo, frete por região, estoque mínimo). 2 ou 3 tarefas "bug", pelo menos uma sutil (erro de uma posição no range, arredondamento, >= vs >, lista alterada sem querer, acumulador que não zera). 1 "melhoria" que é arrumar uma função bagunçada sem quebrar o resto. Sem classes, bibliotecas ou recursão.',
  },
]

const SECTORS: { id: string; icon: ReactNode; from: string; to: string }[] = [
  { id: 'Qualquer', icon: <Dices size={18} />, from: '#8a93a8', to: '#5b6478' },
  { id: 'Loja', icon: <Store size={18} />, from: '#ff9a3d', to: '#e2551b' },
  { id: 'Restaurante', icon: <UtensilsCrossed size={18} />, from: '#ff6b7a', to: '#c9273b' },
  { id: 'Escola', icon: <GraduationCap size={18} />, from: '#5b7cff', to: '#3e63f2' },
  { id: 'Games', icon: <Gamepad2 size={18} />, from: '#a77bff', to: '#6233d6' },
  { id: 'Banco', icon: <Landmark size={18} />, from: '#2fcf9b', to: '#0f8a63' },
  { id: 'Academia', icon: <Dumbbell size={18} />, from: '#ffb648', to: '#d98a00' },
  { id: 'Clínica', icon: <HeartPulse size={18} />, from: '#2fb5d6', to: '#1479a8' },
  { id: 'Entregas', icon: <Truck size={18} />, from: '#7d8597', to: '#3f4757' },
]
const sectorOf = (id: string) => SECTORS.find((s) => s.id === id) ?? SECTORS[0]

const KIND: Record<OfficeTask['kind'], { label: string; icon: ReactNode; cls: string }> = {
  nova: { label: 'Nova', icon: <Plus size={11} strokeWidth={3} />, cls: 'bg-[#e9f0ff] text-[#3e63f2]' },
  bug: { label: 'Bug', icon: <Bug size={11} strokeWidth={2.6} />, cls: 'bg-[#ffecef] text-[#c9273b]' },
  melhoria: { label: 'Melhoria', icon: <Wrench size={11} strokeWidth={2.6} />, cls: 'bg-[#fff4dc] text-[#b7791f]' },
}

/* ---------------- Prompts ---------------- */

/** Como o gerente fala: gente de verdade, não robô. */
const VOZ = `JEITO DE FALAR: você é uma pessoa de verdade mandando mensagem no chat do trabalho. Português do Brasil do dia a dia, informal, frases curtas, direto. Pode usar "pô", "cara", "beleza", "tá", "pra", "show", "massa". PROIBIDO soar como robô: nada de "Ótimo trabalho", "Excelente", "Parabéns pelo esforço", "Vamos lá", "Lembre-se", "Certifique-se", "É importante", "Fique à vontade", nada de emoji, tópicos ou markdown. Fale do código dele de forma concreta: o nome da função, a linha, o valor que você testou e o que saiu.
Exemplos do tom certo:
- "Boa, rodou liso aqui. Já pode subir."
- "Quase. Testei totalPedido([]) e deu erro em vez de 0. Dá uma olhada no começo da função."
- "Cara, de novo? Continua somando 10 reais em vez de 10%. Faz a conta no papel com 40 antes de me mandar."`

const lit = (v: unknown, lang: Lang): string => {
  if (lang === 'javascript') return JSON.stringify(v) ?? 'undefined'
  if (v === null || v === undefined) return 'None'
  if (v === true) return 'True'
  if (v === false) return 'False'
  if (Array.isArray(v)) return `[${v.map((x) => lit(x, lang)).join(', ')}]`
  if (typeof v === 'object') return `{${Object.entries(v as Record<string, unknown>).map(([k, x]) => `${JSON.stringify(k)}: ${lit(x, lang)}`).join(', ')}}`
  return JSON.stringify(v)
}
/** Linha de exemplo: chamada → resultado esperado, na sintaxe da linguagem. */
const exampleLine = (t: OfficeTask, x: NonNullable<OfficeTask['tests']>[number], lang: Lang) => `${t.fn}(${x.args.map((a) => lit(a, lang)).join(', ')}) → ${lit(x.expected, lang)}`

const projectPrompt = (lang: Lang, level: (typeof LEVELS)[number], sector: string, avoid: string[], novos: string[], revisao: string[]) => {
  const py = lang === 'python'
  return `Você é o gerente de uma empresa brasileira inventada e vai passar um PROJETO de programação para um funcionário novo. Ele ainda está aprendendo: já sabe o básico e está entrando no intermediário.
Linguagem: ${LANG_NAME[lang]}. Cargo do funcionário: ${level.id}. Ramo da empresa: ${sector === 'Qualquer' ? 'escolha um ramo do dia a dia' : sector}.
${avoid.length ? `Não repita estas empresas: ${avoid.slice(0, 12).join('; ')}.` : ''}
Monte:
- Uma empresa com nome criativo e um sistema realista que ela usa no dia a dia (ex.: pedidos e entregas de uma lanchonete, estoque e reposição de uma loja, boletim e frequência de uma escola, ranking e premiação de um campeonato).
- "codigoInicial": o arquivo do sistema, com ${level.lines} linhas. CARA DE EMPRESA DE VERDADE (muito importante): é um arquivo que um time pequeno vem mexendo há meses, não um exemplo de livro nem código de IA arrumadinho. Tem que ter:
  * cabeçalho de comentário tipo "${py ? '#' : '//'} pedidos.${py ? 'py' : 'js'} - sistema do balcão / quem mexeu: Júlio, Pedro, Ana";
  * constantes de negócio (taxas, limites, preços) e dados de exemplo realistas (8 a 15 registros, com nomes, códigos tipo "SKU-0042", datas em texto, um ou outro dado meio sujo);
  * de 4 a 8 funções prontas, de tamanhos diferentes, que as tarefas vão usar;
  * comentários de gente, curtos e informais, com nome de quem escreveu às vezes: "TODO: ver com a Carla se frete grátis vale pra retirada", "FIXME: às vezes sai um centavo a mais", "Pedro: não mexe aqui, o caixa depende disso", "gambiarra pra black friday, tirar depois", e um pedaço de código antigo comentado;
  * estilo um pouco irregular: uma função mais bagunçada que as outras, um nome ruim tipo tmp ou x2, um número mágico, um comentário desatualizado. MAS tudo funcionando, menos os bugs das tarefas;
  * o arquivo inteiro roda sem erro: só constantes, dados e funções, nada executando no topo.
- Exatamente ${level.tasks} tarefas, da mais fácil para a mais difícil. Cada tarefa mexe em UMA função, com nome em ${py ? 'snake_case' : 'camelCase'}, em português sem acento.
  Tipos:
  "nova": criar uma função, de preferência usando funções que já existem no arquivo.
  "bug": o defeito já está DENTRO do codigoInicial, numa função que já existe ("codigoExtra" vazio). A mensagem é uma reclamação de cliente ou de colega descrevendo o SINTOMA ("cliente comprou 3 e pagou como 2", "o relatório de sexta veio com a Ana duplicada"), nunca a causa nem a linha. ${level.id === 'Júnior+' ? 'Não diga qual função é: ele tem que investigar.' : 'Pode dizer qual função está suspeita.'} Pode ter um comentário enganoso perto do bug ("isso aqui tá certo, já testei"). Cada bug é um erro que uma pessoa cometeria de verdade.
  "melhoria": mudar uma função que já existe no arquivo (regra nova, validação, caso de borda, deixar legível sem mudar o resultado).
  ${level.rules}
  CLAREZA (o mais importante): a mensagem e os critérios têm que deixar 100% claro o que a função recebe, o que devolve e o que fazer nos casos especiais. Os "criterios" listam TUDO que vai ser cobrado na revisão; nada fora deles pode ser cobrado depois. Os "testes" batem exatamente com os critérios (confira cada um de cabeça, rodando no código corrigido, antes de responder).
  "mensagem": a ordem do gerente, como mensagem de chat do trabalho, 2 a 4 frases, com o motivo (cliente reclamou, o caixa precisa, o dono pediu...). Pode citar colegas.
  "criterios": 2 a 4 critérios objetivos, cada um verificável por um teste.
  "codigoExtra": código que entra no fim do arquivo quando a tarefa começa. Em "nova": só a assinatura da função com um comentário TODO dentro${py ? ' e pass' : ''}. Em "bug" e "melhoria": vazio (a função já está no arquivo).
  "testes": 3 a 5 testes chamando a função só com valores JSON (números, textos, listas, objetos, true/false). Cada teste funciona sozinho, sem depender de outra tarefa ter mudado os dados.
  "dica": uma pista que não entrega a resposta.
${
  novos.length
    ? `- RECURSO NOVO: escolha UM destes que caia bem no projeto: ${novos.join('; ')}. Uma tarefa (não a primeira) deve ter esse recurso como o jeito natural de resolver. Na mensagem dessa tarefa cite só o nome, do jeito que um colega falaria ("usa um enumerate aí que fica mais limpo"), SEM explicar como funciona. Marque essa tarefa com "conceito" (o nome exatamente como na lista) e "conceitoTipo":"novo".`
    : ''
}
${
  revisao.length
    ? `- REVISÃO SURPRESA: se algum destes combinar com o projeto, faça UMA outra tarefa cuja solução natural use ele, mas NÃO cite o nome nem dê pista em lugar nenhum: ${revisao.join('; ')}. Marque com "conceito" (o nome exatamente como na lista) e "conceitoTipo":"revisao". Se nenhum combinar, não force.`
    : ''
}
${VOZ}
Responda SOMENTE com JSON:
{"ramo":"um destes: ${SECTORS.slice(1)
    .map((x) => x.id)
    .join(', ')}","empresa":"","produto":"nome curto do sistema","resumo":"2 frases: a empresa e o que o sistema faz","gerente":{"nome":"nome e sobrenome","cargo":"","genero":"m ou f"},"arquivo":"nome_do_arquivo.${py ? 'py' : 'js'}","codigoInicial":"","tarefas":[{"titulo":"curto","tipo":"nova","mensagem":"","criterios":[""],"funcao":"","codigoExtra":"","testes":[{"args":[],"esperado":null}],"dica":"","conceito":"","conceitoTipo":""}]}`
}

const head = (p: OfficeProject) => `Você é ${p.manager.name}, ${p.manager.role} da ${p.company}. O funcionário (cargo: ${p.level}) está aprendendo a programar em ${LANG_NAME[p.lang]}.
Projeto: ${p.product}. ${p.pitch}`

const taskText = (t: OfficeTask, lang: Lang) => `Tarefa ${t.id} (${KIND[t.kind].label}): ${t.title}
Pedido: ${t.message}
Critérios de aceite (numerados):
${t.criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}
${t.fn && t.tests?.length ? `Testes da função:\n${t.tests.map((x) => `- ${exampleLine(t, x, lang)}`).join('\n')}` : ''}`

const reviewPrompt = (p: OfficeProject, t: OfficeTask, code: string, ran: string, attempt: number) => `${head(p)}
Você está revisando a entrega número ${attempt} desta tarefa.
${taskText(t, p.lang)}
${ran ? `\nResultado REAL dos testes rodando o código dele:\n${ran}\n` : ''}${
  t.reviews?.length
    ? `\nSuas revisões anteriores desta tarefa (seja coerente com elas):\n${t.reviews
        .slice(-4)
        .map((r, i) => `Entrega ${t.reviews!.length - Math.min(4, t.reviews!.length) + i + 1}: ${r.ok ? 'aprovou' : 'reprovou'}. Você disse: "${r.summary}"${r.points.length ? ` | Problemas: ${r.points.join(' / ')}` : ''}`)
        .join('\n')}\n`
    : ''
}
Arquivo inteiro do projeto:
\`\`\`
${code}
\`\`\`

REGRAS DA REVISÃO (siga à risca):
1. Você SÓ pode reprovar por um critério de aceite não cumprido ou por um teste que falha. Nada de exigência nova. Estilo, nome de variável, eficiência ou "dava pra melhorar" NUNCA reprovam: isso vai em "extra".
2. ${p.lang === 'python' ? 'Rode cada teste de cabeça, linha por linha, no código dele.' : 'Use o resultado real dos testes acima.'} Se um teste contradiz os critérios, o teste está errado: ignore esse teste.
3. Marque cada critério como true ou false em "criterios", na mesma ordem.
4. Se reprovar, liste TODOS os problemas de uma vez em "problemas" (não guarde nada pra próxima entrega). Cada problema é um caso concreto: a chamada que você testou, o que deveria dar, o que o código dele dá e em que parte do código está o erro. Não escreva a correção.
5. Coerência: não volte atrás no que já aceitou e não troque o pedido. Se ele corrigiu o que você apontou e os critérios batem, aprove.
6. Avalie só esta tarefa. Partes do arquivo de outras tarefas (com TODO) não contam.
7. "aprovado" é true só se todos os critérios forem true.
${t.concept ? `8. Diga em "usouConceito" se o código dele usa \`${t.concept}\`. Isso NÃO aprova nem reprova.${t.conceptKind === 'revisao' ? ' Não cite esse nome na "fala" nem nos "problemas".' : ''}` : ''}

${VOZ}
${attempt >= 3 ? `Humor: é a ${attempt}ª entrega e você está perdendo a paciência. Se reprovar, mostre irritação de leve no começo da fala ("Cara, de novo?", "Pô, sério?"), sem xingar de verdade, e continue sendo bem específico.` : 'Humor: tranquilo.'}

Responda SOMENTE com JSON:
{"aprovado":true,"criterios":[true],"fala":"sua mensagem pra ele, 1 a 3 frases","problemas":["..."],"extra":"opcional: uma melhoria que NÃO reprova, ou vazio","usouConceito":false}`

const askPrompt = (p: OfficeProject, t: OfficeTask, code: string, qa: { q: string; a: string }[], q: string) => `${head(p)}
${taskText(t, p.lang)}

Código atual do arquivo:
\`\`\`
${code}
\`\`\`
${qa
  .slice(-4)
  .map((x) => `Funcionário: ${x.q}\nVocê: ${x.a}`)
  .join('\n\n')}

Funcionário: ${q}

Responda como um colega mais experiente que ajuda mas não faz o trabalho por ele: até 4 frases. Se ajudar, mostre um exemplo pequeno em bloco \`\`\` que NÃO seja a resposta da tarefa.${t.conceptKind === 'revisao' && t.concept ? ` Não cite \`${t.concept}\`.` : ''}
${VOZ}

Você:`

const finalPrompt = (p: OfficeProject, code: string) => `${head(p)}
O funcionário terminou todas as tarefas. Entregas até aprovar: ${p.tasks.map((t) => `${t.id}=${t.attempts}`).join(', ')}.
Arquivo final:
\`\`\`
${code}
\`\`\`
Dê a avaliação final, lembrando que ele está aprendendo (cargo ${p.level}): nota inteira de 0 a 10, um veredito de 1 a 2 frases e até 3 dicas para crescer.
${VOZ}
Responda SOMENTE com JSON: {"nota":8,"veredito":"","dicas":[""]}`

/* ---------------- Peças ---------------- */

function Bars({ n, on }: { n: number; on: boolean }) {
  return (
    <span className="flex gap-1">
      {[1, 2, 3].map((k) => (
        <span key={k} className={`h-2 w-5 rounded-full ${k <= n ? (on ? 'bg-[#3e63f2]' : 'bg-[#8aa2ff]') : 'bg-[#e6e8ee]'}`} />
      ))}
    </span>
  )
}

const withPatch = (code: string, t: OfficeTask | undefined) => (t && t.patch && !t.patched ? `${code.trimEnd()}\n\n${t.patch.trim()}\n` : code)

/* ---------------- Principal ---------------- */

export function Office({ lang }: { lang: Lang }) {
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), [], [])
  const [openId, setOpenId] = useState<string | null>(null)
  const open = projects.find((p) => p.id === openId)
  if (open) return <ProjectView key={open.id} project={open} onBack={() => setOpenId(null)} />
  return <OfficeHome lang={lang} projects={projects} onOpen={setOpenId} />
}

function OfficeHome({ lang, projects, onOpen }: { lang: Lang; projects: OfficeProject[]; onOpen: (id: string) => void }) {
  const [level, setLevel] = useState(LEVELS[1].id)
  const [sector, setSector] = useState('Qualquer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const create = async () => {
    setLoading(true)
    setError('')
    try {
      const ai = await getAI()
      if (!ai) throw new AIError('unavailable', 'O Claude não está disponível aqui. Abra o Mendonça pelo claude.ai.')
      const lv = LEVELS.find((l) => l.id === level)!
      const cand = pickCandidates(lang, LEVELS.indexOf(lv) + 1, await db.concepts.toArray(), Date.now())
      type Raw = { titulo?: string; tipo?: string; mensagem?: string; criterios?: string[]; funcao?: string; codigoExtra?: string; testes?: { args?: unknown[]; esperado?: unknown }[]; dica?: string; conceito?: string; conceitoTipo?: string }
      const o = await ai.json<{ ramo?: string; empresa?: string; produto?: string; resumo?: string; gerente?: { nome?: string; cargo?: string; genero?: string }; arquivo?: string; codigoInicial?: string; tarefas?: Raw[] }>(
        projectPrompt(lang, lv, sector, projects.map((p) => p.company), cand.novos, cand.revisao),
        { fresh: true, tier: 'complex' },
      )
      // No máximo um conceito novo e uma revisão, e só da lista oferecida
      const taken = new Set<string>()
      const conceptOf = (t: Raw): Pick<OfficeTask, 'concept' | 'conceptKind'> => {
        const kind = t.conceitoTipo === 'revisao' ? 'revisao' : t.conceitoTipo === 'novo' ? 'novo' : null
        const name = String(t.conceito ?? '').trim()
        if (!kind || taken.has(kind) || !(kind === 'novo' ? cand.novos : cand.revisao).includes(name)) return {}
        taken.add(kind)
        return { concept: name, conceptKind: kind }
      }
      const tasks: OfficeTask[] = (o?.tarefas ?? [])
        .filter((t) => t?.titulo && t.mensagem)
        .map((t, i) => ({
          id: `T-${i + 1}`,
          title: String(t.titulo),
          kind: t.tipo === 'bug' || t.tipo === 'melhoria' ? t.tipo : 'nova',
          message: String(t.mensagem),
          criteria: (t.criterios ?? []).map(String).slice(0, 5),
          patch: t.codigoExtra ? String(t.codigoExtra) : undefined,
          fn: t.funcao ? String(t.funcao) : undefined,
          tests: (t.testes ?? []).filter((x) => Array.isArray(x?.args)).map((x) => ({ args: x.args!, expected: x.esperado })),
          hint: t.dica ? String(t.dica) : undefined,
          done: false,
          attempts: 0,
          ...conceptOf(t),
        }))
      if (!o?.empresa || tasks.length < 2) throw new Error()
      const ext = lang === 'python' ? '.py' : '.js'
      let file = String(o.arquivo ?? '').trim().replace(/[^\w.-]/g, '_') || `sistema${ext}`
      if (!file.endsWith(ext)) file = file.replace(/\.\w+$/, '') + ext
      const p: OfficeProject = {
        id: uid(),
        createdAt: Date.now(),
        lang,
        level,
        sector: sector === 'Qualquer' ? (SECTORS.find((x) => x.id !== 'Qualquer' && x.id === String(o.ramo ?? '').trim())?.id ?? sector) : sector,
        company: String(o.empresa),
        product: String(o.produto ?? 'Sistema'),
        pitch: String(o.resumo ?? ''),
        manager: { name: String(o.gerente?.nome ?? 'Gerente'), role: String(o.gerente?.cargo ?? 'Gerente de projeto'), ...(o.gerente?.genero === 'f' || o.gerente?.genero === 'm' ? { gender: o.gerente.genero } : {}) },
        fileName: file,
        code: withPatch(String(o.codigoInicial ?? ''), tasks[0]),
        tasks: tasks.map((t, i) => (i === 0 && t.patch ? { ...t, patched: true } : t)),
        current: 0,
      }
      await db.projects.add(p)
      playSfx('pop')
      onOpen(p.id)
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Não consegui montar o projeto agora. Tente de novo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid flex-1 items-start gap-5 xl:grid-cols-[1fr_300px]">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Capybara pose="focado" size={64} />
          <div>
            <h2 className="text-xl font-bold">Empresarial</h2>
            <p className="text-sm text-muted">Um projeto inteiro de uma empresa, com tarefas do gerente, em {LANG_NAME[lang]}.</p>
          </div>
        </div>

        <div className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Seu cargo</div>
        <div className="mb-5 grid gap-2.5 sm:grid-cols-3">
          {LEVELS.map((l) => {
            const on = level === l.id
            return (
              <button key={l.id} onClick={() => setLevel(l.id)} className={`rounded-2xl border-2 p-3.5 text-left transition ${on ? 'border-[#3e63f2] bg-[#eef2ff]' : 'border-line bg-white hover:border-[#b9c7ff]'}`}>
                <Bars n={l.bars} on={on} />
                <span className="mt-2 block font-bold">{l.id}</span>
                <span className="block text-xs text-muted">{l.text}</span>
                <span className="mt-1.5 block text-[11px] font-bold text-[#3e63f2]">{l.tasks} tarefas</span>
              </button>
            )
          })}
        </div>

        <div className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Empresa</div>
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {SECTORS.map((s) => {
            const on = sector === s.id
            return (
              <button key={s.id} onClick={() => setSector(s.id)} className={`flex items-center gap-2.5 rounded-2xl border-2 p-2.5 text-left text-sm font-semibold transition ${on ? 'border-[#3e63f2] bg-[#eef2ff]' : 'border-line bg-white hover:border-[#b9c7ff]'}`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-[0_6px_12px_-6px_rgba(16,24,40,.5)]" style={{ background: `linear-gradient(145deg, ${s.from}, ${s.to})` }}>
                  {s.icon}
                </span>
                <span className="leading-tight">{s.id}</span>
              </button>
            )
          })}
        </div>

        {error && <p className="mb-3 text-sm font-semibold text-rose-600">{error}</p>}
        <button
          onClick={create}
          disabled={loading}
          className="act-btn inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-display text-base font-bold text-white disabled:opacity-70"
          style={{ background: 'linear-gradient(145deg, #5b7cff, #3e63f2)', boxShadow: '0 12px 22px -12px #3e63f2' }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Briefcase />}
          {loading ? 'Montando o projeto…' : 'Receber projeto'}
        </button>
      </div>

      <div className="space-y-4">
      {/* projetos como "repositórios" */}
      <div className="overflow-hidden rounded-[20px] bg-[#16181d] text-[#e6e9f2]">
        <div className="border-b border-white/5 bg-[#1d2027] px-4 py-3 text-xs font-bold tracking-wider text-[#8a93a8] uppercase">Seus projetos</div>
        {projects.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#8a93a8]">Nenhum ainda.</p>
        ) : (
          <div className="thin-scroll max-h-[460px] overflow-y-auto py-1.5">
            {projects.map((p) => {
              const done = p.tasks.filter((t) => t.done).length
              const s = sectorOf(p.sector)
              return (
                <div key={p.id} className="group flex items-center gap-2.5 px-3 py-2 hover:bg-white/5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white [&_svg]:h-4 [&_svg]:w-4" style={{ background: `linear-gradient(145deg, ${s.from}, ${s.to})` }}>
                    {s.icon}
                  </span>
                  <button onClick={() => onOpen(p.id)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[13px] font-bold">{p.company}</div>
                    <div className="flex items-center gap-2 text-[10.5px] text-[#8a93a8]">
                      <span>{p.level}</span>
                      {p.finishedAt ? <span className="font-bold text-[#7ef0b5]">entregue · nota {p.grade}</span> : <span>{done}/{p.tasks.length} tarefas</span>}
                    </div>
                  </button>
                  <button onClick={async () => (await askConfirm('Apagar este projeto?')) && db.projects.delete(p.id)} className="rounded p-1 text-[#596071] opacity-0 transition group-hover:opacity-100 hover:text-rose-400" title="Apagar">
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <ConceptBank lang={lang} />
      </div>
    </div>
  )
}

/** Banco de conceitos: o que você já usou nos projetos e quando volta numa revisão surpresa. */
function ConceptBank({ lang }: { lang: Lang }) {
  const all = useLiveQuery(() => db.concepts.where('lang').equals(lang).toArray(), [lang], [])
  const now = Date.now()
  const list = [...all].sort((a, b) => b.lastAt - a.lastAt)
  const label = { aprendendo: 'aprendendo', aprendido: 'aprendido', fixado: 'fixado' } as const
  const tone = { aprendendo: 'bg-[#fff4dc] text-[#b7791f]', aprendido: 'bg-[#eef2ff] text-[#3e63f2]', fixado: 'bg-[#e9f9f2] text-[#0f8a63]' } as const
  return (
    <div className="rounded-[20px] border border-line bg-white p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-bold tracking-wider text-muted uppercase">Banco de conceitos</span>
        {list.length > 0 && <span className="text-[11px] font-bold text-muted">{list.length}</span>}
      </div>
      {list.length === 0 ? (
        <p className="py-3 text-[13px] leading-snug text-muted">Cada projeto traz um recurso de {LANG_NAME[lang]} que você ainda não usou. Usou, ele vem pra cá e volta de surpresa depois.</p>
      ) : (
        <div className="thin-scroll max-h-[320px] space-y-1 overflow-y-auto pt-1">
          {list.map((c) => {
            const st = conceptState(c)
            const due = c.history.some((h) => h.ok) && c.due <= now
            return (
              <div key={c.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
                <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] font-semibold text-ink">{c.name}</code>
                <span className="flex gap-0.5" title={`${c.streak} acerto(s) seguido(s)`}>
                  {[1, 2, 3].map((k) => (
                    <span key={k} className={`h-1.5 w-3 rounded-full ${k <= c.streak ? 'bg-[#2fcf9b]' : 'bg-[#e6e8ee]'}`} />
                  ))}
                </span>
                <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${due ? 'bg-[#ffecef] text-[#c9273b]' : tone[st]}`}>{due ? 'pode voltar' : label[st]}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Briefcase() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="3" fill="#fff" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M3 12.5h18" stroke="#3e63f2" strokeWidth="1.6" />
      <rect x="10.5" y="11" width="3" height="3" rx=".8" fill="#ffd34d" />
    </svg>
  )
}

/* ---------------- Projeto aberto ---------------- */

function ProjectView({ project, onBack }: { project: OfficeProject; onBack: () => void }) {
  const p = project
  const [code, setCode] = useState(p.code)
  const [view, setView] = useState(Math.min(p.current, p.tasks.length - 1))
  const [loading, setLoading] = useState<'' | 'rodar' | 'entregar' | 'perguntar' | 'final'>('')
  const [error, setError] = useState('')
  const [run, setRun] = useState<RunResult | null>(null)
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const thread = useRef<HTMLDivElement>(null)
  const task = p.tasks[view]
  const isCurrent = view === p.current && !p.finishedAt
  const done = p.tasks.filter((t) => t.done).length
  const gender = bossGender(p.manager)
  const first = p.manager.name.split(' ')[0]

  // Abre já no projeto
  useEffect(() => {
    box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Salva o arquivo enquanto você digita
  useEffect(() => {
    if (code === p.code) return
    const t = window.setTimeout(() => db.projects.update(p.id, { code }), 700)
    return () => window.clearTimeout(t)
  }, [code, p.id, p.code])

  // Conversa da tarefa (projetos antigos não tinham o registro: monta a partir das revisões e perguntas)
  const log: OfficeLog[] = task
    ? (task.log ?? [
        ...(task.reviews ?? []).map((r): OfficeLog => ({ t: 'revisao', at: 0, ok: r.ok, fala: r.summary, problemas: r.points, mood: r.ok ? 'feliz' : 'chateado' })),
        ...(task.qa ?? []).flatMap((x): OfficeLog[] => [
          { t: 'pergunta', at: 0, text: x.q },
          { t: 'resposta', at: 0, text: x.a },
        ]),
      ])
    : []
  const lastReview = [...log].reverse().find((e) => e.t === 'revisao') as Extract<OfficeLog, { t: 'revisao' }> | undefined
  const mood: BossMood = loading === 'entregar' ? 'pensando' : task?.done ? 'feliz' : lastReview ? lastReview.mood : 'neutro'
  const crit = task?.feedback?.criteria

  useEffect(() => {
    const el = thread.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [log.length, loading, view, p.finishedAt])

  const fresh = async () => (await db.projects.get(p.id)) ?? p
  const patchTask = async (i: number, patch: (t: OfficeTask) => Partial<OfficeTask>, extra: Partial<OfficeProject> = {}) => {
    const cur = await fresh()
    const tasks = cur.tasks.map((t, k) => (k === i ? { ...t, ...patch(t) } : t))
    return db.projects.update(p.id, { tasks, ...extra })
  }
  const addLog = (i: number, ...entries: OfficeLog[]) => patchTask(i, (t) => ({ log: [...(t.log ?? log), ...entries].slice(-60) }))



  const finish = async (finalCode: string) => {
    setLoading('final')
    try {
      const ai = await getAI()
      if (!ai) throw new AIError('unavailable', 'O Claude não está disponível aqui.')
      const o = await ai.json<{ nota?: number; veredito?: string; dicas?: string[] }>(finalPrompt(await fresh(), finalCode), { fresh: true })
      const grade = Math.max(0, Math.min(10, Math.round(Number(o?.nota ?? 7))))
      const verdict = String(o?.veredito ?? '')
      const tips = Array.isArray(o?.dicas) ? o.dicas.map(String).slice(0, 3) : []
      await db.projects.update(p.id, { finishedAt: Date.now(), grade, verdict, tips, current: p.tasks.length })
      // Vai para a Biblioteca junto com os códigos aprovados
      await db.snippets.add({ id: uid(), createdAt: Date.now(), lang: p.lang, goal: `${p.company}: ${p.product}`, code: finalCode, grade, verdict, tips })
      playSfx('ok')
      const [x, y] = centerOf(box.current)
      confetti(x, y, 110, ['#5b7cff', '#ffd34d', '#ffffff', '#2fcf9b'])
      showMascot({ pose: 'comemorando', title: 'Projeto entregue!', text: `${p.company} agradece. Nota ${grade}.`, autoHideMs: 6000 })
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Não consegui fechar a avaliação agora. Tente de novo.')
    } finally {
      setLoading('')
    }
  }

  const deliver = async (src: string = code) => {
    if (!task || !src.trim() || loading) return
    setCode(src)
    setLoading('entregar')
    setError('')
    const attempt = task.attempts + 1
    try {
      await db.projects.update(p.id, { code: src })
      await addLog(view, { t: 'entrega', at: Date.now(), n: attempt })
      let ran = ''
      if (p.lang === 'javascript' && task.fn) {
        const r = await runJS(src, task.fn, task.tests)
        setRun(r)
        ran = r.error ? `Erro: ${r.error}` : r.results.map((x) => `${x.label} → ${x.got} (esperado ${x.expected}) ${x.ok ? 'OK' : 'ERRADO'}`).join('\n')
      }
      const ai = await getAI()
      if (!ai) throw new AIError('unavailable', 'O Claude não está disponível aqui. Abra o Mendonça pelo claude.ai.')
      const o = await ai.json<{ aprovado?: boolean; criterios?: unknown[]; fala?: string; problemas?: unknown[]; extra?: string; usouConceito?: boolean }>(reviewPrompt(p, task, src, ran, attempt), { fresh: true, tier: 'complex' })
      const crit = task.criteria.map((_, i) => (Array.isArray(o?.criterios) ? o.criterios[i] !== false : true))
      const ok = !!o?.aprovado && crit.every(Boolean)
      const problems = ok ? [] : Array.isArray(o?.problemas) ? o.problemas.map(String).filter(Boolean).slice(0, 6) : []
      const fb = { ok, summary: String(o?.fala ?? ''), points: problems, next: '', criteria: crit, extra: o?.extra ? String(o.extra) : '', usedConcept: !!o?.usouConceito }
      const entry: OfficeLog = {
        t: 'revisao',
        at: Date.now(),
        ok,
        fala: fb.summary,
        problemas: problems,
        extra: fb.extra || undefined,
        mood: ok ? 'feliz' : attempt >= 3 ? 'bravo' : 'chateado',
        ...(ok && task.concept && task.conceptKind ? { concept: { name: task.concept, kind: task.conceptKind, used: fb.usedConcept } } : {}),
      }
      await patchTask(view, (t) => ({
        feedback: fb,
        attempts: attempt,
        done: t.done || ok,
        reviews: [...(t.reviews ?? []), { ok, summary: fb.summary, points: problems }].slice(-6),
        log: [...(t.log ?? log), entry].slice(-60),
      }))
      if (ok) {
        // Banco de conceitos: registra se usou o recurso novo ou lembrou do antigo
        if (task.concept && task.conceptKind && !task.done) {
          const id = conceptId(p.lang, task.concept)
          await db.concepts.put(applyConceptResult(await db.concepts.get(id), p.lang, task.concept, task.conceptKind, fb.usedConcept, p.company, Date.now()))
        }
        playSfx('ok')
        const [x, y] = centerOf(thread.current)
        confetti(x, y, 60, ['#5b7cff', '#ffd34d', '#ffffff'])
        if (view === p.tasks.length - 1) await finish(src)
      } else playSfx('bad')
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Não consegui revisar agora. Seu código continua salvo; tente de novo.')
    } finally {
      setLoading((l) => (l === 'final' ? l : ''))
    }
  }

  const nextTask = async () => {
    const i = p.current + 1
    const nt = p.tasks[i]
    if (!nt) return
    const nextCode = withPatch(code, nt)
    setCode(nextCode)
    await patchTask(i, () => ({ patched: true }), { current: i, code: nextCode })
    setView(i)
    setRun(null)
    playSfx('pop')
  }

  const ask = async () => {
    const text = q.trim()
    if (!task || !text || loading) return
    setLoading('perguntar')
    setError('')
    setQ('')
    try {
      await addLog(view, { t: 'pergunta', at: Date.now(), text })
      const ai = await getAI()
      if (!ai) throw new AIError('unavailable', 'O Claude não está disponível aqui.')
      const a = (await ai.text(askPrompt(p, task, code, task.qa ?? [], text), { tier: 'quick', fresh: true })).trim()
      await patchTask(view, (t) => ({ qa: [...(t.qa ?? []), { q: text, a }], log: [...(t.log ?? log), { t: 'resposta' as const, at: Date.now(), text: a }].slice(-60) }))
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Não consegui responder agora.')
    } finally {
      setLoading('')
    }
  }

  const hintUsed = log.some((e) => e.t === 'dica')
  const askHint = () => task?.hint && !hintUsed && addLog(view, { t: 'pergunta', at: Date.now(), text: 'Me dá uma luz?' }, { t: 'dica', at: Date.now(), text: task.hint })

  const pick = (i: number) => {
    setView(i)
    setRun(null)
    setError('')
  }

  // ---------- Copiar, baixar e colar ----------
  const [paste, setPaste] = useState('')
  const [copied, setCopied] = useState(false)
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      // sem permissão: seleciona um campo escondido e copia do jeito antigo
      const t = document.createElement('textarea')
      t.value = code
      document.body.appendChild(t)
      t.select()
      document.execCommand('copy')
      t.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = p.fileName
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const pasteFromClipboard = async () => {
    try {
      setPaste(await navigator.clipboard.readText())
    } catch {
      setError('O navegador não deixou ler a área de transferência. Cola com Ctrl+V na caixa.')
    }
  }
  const pastedLines = paste.trim() ? paste.replace(/\n+$/, '').split('\n').length : 0
  const canDeliver = isCurrent && !!task && !task.done
  const step = (n: number, on = true) => (
    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-white ${on ? 'bg-[#3e63f2]' : 'bg-[#c3c8d4]'}`}>{n}</span>
  )

  return (
    <div ref={box} className="scroll-mt-[84px] space-y-4">
      <StoreBanner project={p} done={done} onBack={onBack} />

      {task && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            {/* 1. A tarefa */}
            <section className="rounded-[22px] border border-line bg-white p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {step(1)}
                <span className="mr-2 font-display text-[17px] font-bold">A tarefa</span>
                {p.tasks.map((t, i) => {
                  const locked = i > p.current
                  const on = i === view
                  return (
                    <button
                      key={t.id}
                      disabled={locked}
                      onClick={() => pick(i)}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold transition ${on ? 'bg-[#121826] text-white' : t.done ? 'bg-[#e9f9f2] text-[#0f8a63] hover:brightness-95' : locked ? 'border border-line text-[#a5adbf]' : 'bg-[#eef2ff] text-[#3e63f2]'}`}
                    >
                      {t.done ? <CheckCircle2 size={13} /> : locked ? <Lock size={11} /> : null}
                      {t.id}
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${KIND[task.kind].cls}`}>
                  {KIND[task.kind].icon}
                  {KIND[task.kind].label}
                </span>
                {task.fn && <code className="rounded-md bg-[#eef2ff] px-2 py-0.5 font-mono text-[12px] font-semibold text-[#3e63f2]">{task.fn}</code>}
                {task.concept && task.conceptKind === 'novo' && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#fff4dc] px-2 py-0.5 font-mono text-[11.5px] font-semibold text-[#b7791f]" title="Recurso que você ainda não usou. Pesquisa e se vira!">
                    <Sparkles size={11} /> novo: {task.concept}
                  </span>
                )}
              </div>
              <h2 className="mt-2 font-display text-[24px] leading-tight font-extrabold">{task.title}</h2>
              <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-700">{task.message}</p>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">Pra aprovar</div>
                  <ul className="space-y-2">
                    {task.criteria.map((c, i) => {
                      const st = task.done ? true : crit?.[i]
                      return (
                        <li key={i} className="flex gap-2.5 text-[14px] leading-snug">
                          {st === true ? <CheckCircle2 size={18} className="shrink-0 text-[#0f8a63]" /> : st === false ? <XCircle size={18} className="shrink-0 text-[#d92f45]" /> : <span className="mt-px h-[18px] w-[18px] shrink-0 rounded-full border-2 border-slate-300" />}
                          <span className={st === false ? 'font-semibold text-[#9e1d2f]' : 'text-slate-700'}>
                            <RichText text={c} />
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
                {task.fn && !!task.tests?.length && (
                  <div>
                    <div className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">Exemplos</div>
                    <div className="space-y-1.5">
                      {task.tests.slice(0, 4).map((x, i) => {
                        const [call, out] = exampleLine(task, x, p.lang).split(' → ')
                        return (
                          <div key={i} className="thin-scroll overflow-x-auto rounded-lg bg-[#f4f5f8] px-3 py-1.5 font-mono text-[12.5px] whitespace-nowrap">
                            {call} <span className="text-[#8a93a8]">→</span> <b className="text-[#0f8a63]">{out}</b>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 2. Copiar o código */}
            <section className="rounded-[22px] border border-line bg-white p-5">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                {step(2)}
                <div className="min-w-0">
                  <h3 className="font-display text-[17px] font-bold">Copie o código e faça no VS Code</h3>
                  <p className="text-[13px] text-muted">
                    Salve como <code className="font-mono text-[12.5px] text-ink">{p.fileName}</code>. A tarefa de agora está no fim do arquivo{task.kind === 'nova' ? ', com um TODO' : ''}.
                  </p>
                </div>
                <span className="ml-auto flex gap-2">
                  <button onClick={() => void copyCode()} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition ${copied ? 'bg-[#0f8a63]' : 'bg-[#121826] hover:bg-[#262b36]'}`}>
                    {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />} {copied ? 'Copiado!' : 'Copiar código'}
                  </button>
                  <button onClick={download} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50" title={`Baixar ${p.fileName}`}>
                    <Download size={16} /> Baixar
                  </button>
                </span>
              </div>
              <div className="overflow-hidden rounded-2xl">
                <CodeEditor value={code} onChange={() => {}} readOnly lang={p.lang} bare />
              </div>
            </section>

            {/* 3. Colar e entregar */}
            <section className={`rounded-[22px] border bg-white p-5 ${canDeliver ? 'border-line' : 'border-line opacity-70'}`}>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                {step(3, canDeliver)}
                <div className="min-w-0">
                  <h3 className="font-display text-[17px] font-bold">Cole aqui o arquivo inteiro e entregue</h3>
                  <p className="text-[13px] text-muted">Ctrl+A no VS Code, Ctrl+C, e cola aqui. {p.manager.name.split(' ')[0]} revisa só a tarefa de agora.</p>
                </div>
                {canDeliver && (
                  <button onClick={() => void pasteFromClipboard()} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-bold text-slate-700 hover:bg-slate-50">
                    <ClipboardPaste size={15} /> Colar
                  </button>
                )}
              </div>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                disabled={!canDeliver}
                spellCheck={false}
                aria-label="Código para entregar"
                placeholder={canDeliver ? `Cole o ${p.fileName} aqui…` : task.done ? 'Tarefa aprovada.' : 'Tarefa encerrada.'}
                className="thin-scroll h-[240px] w-full resize-y rounded-2xl border border-[#262a33] bg-[#16181d] p-4 font-mono text-[13px] leading-[1.6] whitespace-pre text-[#e6e9f2] outline-none placeholder:text-[#596071] focus:border-[#3e63f2]"
              />
              {run && (
                <div className="mt-3 overflow-hidden rounded-2xl">
                  <RunPanel run={run} onClose={() => setRun(null)} />
                </div>
              )}
              {canDeliver && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => void deliver(paste)}
                    disabled={!!loading || !paste.trim()}
                    className="act-btn inline-flex h-[52px] items-center justify-center gap-2.5 rounded-2xl px-7 font-display text-[17px] font-extrabold text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(145deg, #5b7cff, #3e63f2)', boxShadow: '0 14px 24px -12px #3e63f2' }}
                  >
                    {loading === 'entregar' ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} {loading === 'entregar' ? 'Revisando…' : 'Entregar'}
                  </button>
                  {pastedLines > 0 && <span className="text-[13px] text-muted">{pastedLines} linhas coladas</span>}
                  {task.hint && !hintUsed && (
                    <button type="button" onClick={() => void askHint()} className="ml-auto text-[13px] font-semibold text-muted hover:text-[#b7791f]">
                      Travou? Pedir uma luz {gender === 'f' ? 'pra' : 'pro'} {first}
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* A gerente e a conversa */}
          <aside className="flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-line bg-white lg:sticky lg:top-[84px] lg:max-h-[calc(100dvh-100px)]">
            <div className={`relative flex h-[150px] shrink-0 items-end justify-center transition-colors ${mood === 'bravo' ? 'bg-[#ffe1e5]' : mood === 'feliz' ? 'bg-[#e3f8ee]' : 'bg-[#eef1f8]'}`}>
              <svg aria-hidden="true" viewBox="0 0 340 150" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                <circle cx="60" cy="36" r="42" fill="#ffffff" opacity=".45" />
                <circle cx="292" cy="138" r="56" fill="#ffffff" opacity=".45" />
              </svg>
              <span className="relative">
                <Boss gender={gender} mood={mood} size={140} />
              </span>
              <span className="absolute bottom-3 left-3.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold shadow-[0_4px_10px_-6px_rgba(16,24,40,.4)]">
                {p.manager.name} <span className="font-medium text-muted">· {loading === 'entregar' ? 'testando…' : loading === 'perguntar' ? 'digitando…' : p.manager.role.toLowerCase()}</span>
              </span>
            </div>

            <div ref={thread} className="thin-scroll flex min-h-[220px] flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4">
              {log.length === 0 && !loading && <p className="py-6 text-center text-[13px] text-muted">Quando você entregar, a revisão aparece aqui.</p>}
              {log.map((e, i) =>
                e.t === 'entrega' ? (
                  <div key={i} className="flex justify-end">
                    <span className="inline-flex items-center gap-1.5 rounded-2xl rounded-br-md bg-[#3e63f2] px-3 py-1.5 text-[12.5px] font-semibold text-white">
                      <Send size={11} /> {e.n}ª entrega
                    </span>
                  </div>
                ) : e.t === 'pergunta' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#3e63f2] px-3.5 py-2 text-[13.5px] text-white">{e.text}</div>
                  </div>
                ) : e.t !== 'revisao' ? (
                  <Bubble key={i} tone={e.t === 'dica' ? 'dica' : undefined}>
                    <RichText text={e.text} />
                  </Bubble>
                ) : (
                  <div key={i} className="space-y-2">
                    <span className={`ml-1 inline-flex rounded-md px-2 py-0.5 text-[11px] font-extrabold ${e.ok ? 'bg-[#e9f9f2] text-[#0f8a63]' : 'bg-[#ffecef] text-[#c9273b]'}`}>{e.ok ? 'Aprovado' : 'Voltou pra você'}</span>
                    <Bubble tone={e.ok ? 'ok' : e.mood === 'bravo' ? 'bravo' : 'erro'}>
                      <p>{e.fala}</p>
                      {e.problemas.length > 0 && (
                        <div className="mt-2 border-t border-black/5 pt-2">
                          <div className="mb-1 text-[10.5px] font-bold tracking-wider text-muted uppercase">O que eu testei</div>
                          <ul className="space-y-1.5">
                            {e.problemas.map((pt, k) => (
                              <li key={k} className="flex gap-1.5 text-[13px]">
                                <XCircle size={14} className="mt-0.5 shrink-0 text-[#d92f45]" />
                                <RichText text={pt} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {e.concept && (
                        <p className={`mt-2 border-t border-black/5 pt-2 text-[12.5px] font-semibold ${e.concept.used ? 'text-[#0f8a63]' : 'text-[#8a5a00]'}`}>
                          {e.concept.used ? (e.concept.kind === 'revisao' ? 'Lembrou do ' : 'Usou o ') : 'Dava pra usar '}
                          <code className="font-mono">{e.concept.name}</code>
                          {e.concept.used ? '. Foi pro banco de conceitos.' : ' aqui. Ele volta numa próxima.'}
                        </p>
                      )}
                      {e.extra && <p className="mt-2 border-t border-black/5 pt-2 text-[12.5px] text-slate-500">Só uma ideia, não conta: {e.extra}</p>}
                    </Bubble>
                    {e === lastReview && lastReview.ok && isCurrent && (
                      <div className="pl-1">
                        {view < p.tasks.length - 1 ? (
                          <button
                            onClick={() => {
                              setPaste('')
                              void nextTask()
                            }}
                            className="act-btn inline-flex items-center gap-2 rounded-xl bg-[#3e63f2] px-4 py-2 text-sm font-bold text-white"
                          >
                            Pegar a próxima tarefa →
                          </button>
                        ) : (
                          !p.finishedAt && (
                            <button onClick={() => void finish(code)} disabled={!!loading} className="act-btn inline-flex items-center gap-2 rounded-xl bg-[#3e63f2] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                              {loading === 'final' && <Loader2 size={14} className="animate-spin" />} {loading === 'final' ? 'Fechando o projeto…' : 'Entregar o projeto'}
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                ),
              )}
              {(loading === 'entregar' || loading === 'perguntar') && (
                <div className="w-fit rounded-2xl rounded-bl-md bg-[#f3f5fa] px-4 py-3">
                  <span className="of-typing flex gap-1">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              )}
              {p.finishedAt && view === p.tasks.length - 1 && (
                <div className="capi-pop flex items-center gap-3 rounded-2xl border-2 border-[#c9d4ff] bg-white p-3">
                  <GradeRing grade={p.grade ?? 0} size={64} />
                  <div className="min-w-0 text-[13px] text-slate-700">
                    <div className="font-display font-bold text-[#3e63f2]">Projeto entregue</div>
                    <p className="mt-0.5">{p.verdict}</p>
                  </div>
                </div>
              )}
              {error && <p className="text-center text-[13px] font-semibold text-rose-600">{error}</p>}
            </div>

            {canDeliver && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void ask()
                }}
                className="flex gap-2 border-t border-[#eef0f4] p-3"
              >
                <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Mensagem para ${first}`} placeholder={`Perguntar pra ${first}…`} className="h-11 min-w-0 flex-1 rounded-xl bg-[#f1f3f8] px-3.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#c9d4ff]" />
                <button disabled={!q.trim() || !!loading} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#121826] text-white disabled:opacity-30" aria-label="Enviar mensagem">
                  <Send size={15} />
                </button>
              </form>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

/** Saída dos testes (JavaScript) embaixo do editor. */
function RunPanel({ run, onClose }: { run: RunResult; onClose: () => void }) {
  return (
    <div className="thin-scroll max-h-36 shrink-0 overflow-y-auto border-t border-white/5 bg-[#14161a] px-4 py-2.5 font-mono text-[12.5px]">
      <div className="mb-1 flex items-center text-[10.5px] font-bold tracking-wider text-[#596071] uppercase">
        Testes
        <button onClick={onClose} className="ml-auto rounded px-1.5 text-[#8a93a8] normal-case hover:bg-white/10" aria-label="Fechar testes">
          ×
        </button>
      </div>
      {run.error && <p className="text-rose-300">{run.error}</p>}
      {run.results.map((r, i) => (
        <div key={i} className="flex items-start gap-2 text-[#c9cede]">
          {r.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#2fcf9b]" /> : <XCircle size={14} className="mt-0.5 shrink-0 text-rose-400" />}
          <span className="min-w-0 break-all">
            {r.label} → <b className={r.ok ? 'text-[#7ef0b5]' : 'text-rose-300'}>{r.got}</b>
            {!r.ok && <span className="text-[#596071]"> (esperado {r.expected})</span>}
          </span>
        </div>
      ))}
      {run.logs.length > 0 && <pre className="mt-1.5 text-[#8a93a8]">{run.logs.join('\n')}</pre>}
    </div>
  )
}

/** Balão de mensagem da gerente. */
function Bubble({ children, tone }: { children: ReactNode; tone?: 'ok' | 'erro' | 'bravo' | 'dica' }) {
  const cls =
    tone === 'ok'
      ? 'bg-[#e3f8ee] text-[#0b4a33]'
      : tone === 'bravo'
        ? 'bg-[#ffe3e6] text-[#5c1420]'
        : tone === 'erro'
          ? 'bg-[#fff6f7] text-slate-800 ring-1 ring-[#ffd1d7]'
          : tone === 'dica'
            ? 'bg-[#fff6df] text-[#5a4200]'
            : 'bg-[#f3f5fa] text-slate-800'
  return <div className={`max-w-[94%] rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[13.5px] leading-relaxed ${cls}`}>{children}</div>
}


/** Faixa da empresa: cor do ramo, prédios com janelas acendendo e a fachada da empresa. */
function StoreBanner({ project: p, done, onBack }: { project: OfficeProject; done: number; onBack: () => void }) {
  const s = sectorOf(p.sector)
  const sign = p.company.length > 18 ? p.company.split(' ').slice(0, 2).join(' ') : p.company
  return (
    <section className="relative min-h-[138px] overflow-hidden rounded-[22px] text-white" style={{ background: `linear-gradient(120deg, ${s.from}, ${s.to})`, boxShadow: `0 18px 30px -22px ${s.to}` }}>
      <svg aria-hidden="true" viewBox="0 0 560 150" preserveAspectRatio="xMaxYMax meet" className="absolute right-0 bottom-0 hidden h-full w-[58%] max-w-[600px] sm:block">
        <g className="of-cloud" fill="#fff" opacity=".35">
          <ellipse cx="40" cy="30" rx="26" ry="8" />
          <ellipse cx="56" cy="24" rx="15" ry="9" />
        </g>
        <g fill="#000" opacity=".16">
          <rect x="40" y="58" width="56" height="92" rx="3" />
          <rect x="104" y="30" width="70" height="120" rx="3" />
          <rect x="470" y="50" width="70" height="100" rx="3" />
        </g>
        <g fill="#fff3b0">
          {[
            [50, 68],
            [66, 68],
            [50, 88],
            [66, 108],
            [114, 42],
            [130, 42],
            [146, 62],
            [130, 82],
            [482, 62],
            [498, 82],
            [514, 62],
            [498, 102],
          ].map(([x, y], i) => (
            <rect key={i} className="of-win" x={x} y={y} width="8" height="10" rx="1" style={{ animationDelay: `${(i * 0.7) % 5}s` }} />
          ))}
        </g>
        {/* fachada */}
        <rect x="196" y="44" width="254" height="106" rx="6" fill="#fff7ef" />
        <rect x="208" y="20" width="230" height="30" rx="8" fill="#121826" />
        <text x="323" y="41" textAnchor="middle" fontFamily="Sora, sans-serif" fontSize={sign.length > 14 ? 12 : 14} fontWeight="800" fill="#ffd34d" letterSpacing="1.5">
          {sign.toUpperCase()}
        </text>
        <path d="M196 52h254v18H196z" fill="#fff" />
        <path d="M196 52h21v18h-21zM238 52h21v18h-21zM280 52h21v18h-21zM322 52h21v18h-21zM364 52h21v18h-21zM406 52h21v18h-21z" fill={s.to} />
        <path d="M196 70q10.5 10 21 0q10.5 10 21 0q10.5 10 21 0q10.5 10 21 0q10.5 10 21 0q10.5 10 21 0q10.5 10 21 0q10.5 10 21 0q10.5 10 21 0q10.5 10 21 0q10.5 10 21 0q10.5 10 23 0z" fill={s.to} />
        <rect x="214" y="88" width="120" height="52" rx="5" fill="#bfe6ff" />
        <rect x="224" y="98" width="40" height="32" rx="4" fill="#fff" opacity=".55" />
        <rect x="272" y="104" width="50" height="6" rx="3" fill="#fff" opacity=".55" />
        <rect x="272" y="116" width="34" height="6" rx="3" fill="#fff" opacity=".55" />
        <rect x="352" y="86" width="74" height="64" rx="4" fill="#7a3b1f" />
        <circle cx="414" cy="120" r="3" fill="#ffd34d" />
        <rect x="360" y="94" width="58" height="26" rx="3" fill="#a5d8ff" opacity=".6" />
      </svg>
      <div className="relative flex flex-col gap-2.5 p-5 sm:max-w-[52%] sm:px-6">
        <button onClick={onBack} className="flex h-[30px] w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 text-[12.5px] font-bold transition hover:bg-white/30">
          ← Projetos
        </button>
        <div>
          <div className="text-[11px] font-extrabold tracking-[.14em] uppercase opacity-85">
            {p.product} · {p.level}
          </div>
          <h2 className="mt-0.5 font-display text-[26px] leading-tight font-extrabold">{p.company}</h2>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex w-[220px] gap-1">
            {p.tasks.map((t, i) => (
              <span key={t.id} className={`h-2 flex-1 rounded-full ${t.done ? 'bg-white' : i === p.current ? 'of-live bg-white/60' : 'bg-white/25'}`} />
            ))}
          </div>
          <span className="text-[12.5px] font-bold">
            {done} de {p.tasks.length} entregues
          </span>
        </div>
      </div>
    </section>
  )
}
