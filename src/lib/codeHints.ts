import type { EditorView } from '@codemirror/view'
import { snippetCompletion as snip, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'

/*
 * Sugestões do editor de código, com uma explicação curta em português em cada uma.
 * Palavras e funções da linguagem, modelos prontos (for, if, def...) e, depois de um ponto,
 * os métodos de texto, lista e dicionário.
 */

type Lang = 'python' | 'javascript'
/** Insere nome() e deixa o cursor entre os parênteses. */
const call =
  (name: string) =>
  (view: EditorView, _c: Completion, from: number, to: number) => {
    const hasParen = view.state.sliceDoc(to, to + 1) === '('
    view.dispatch({ changes: { from, to, insert: hasParen ? name : `${name}()` }, selection: { anchor: from + name.length + 1 }, userEvent: 'input.complete' })
  }
const fn = (label: string, detail: string, info: string, boost = 0): Completion => ({ label, type: 'function', detail, info, boost, apply: call(label) })
const kw = (label: string, info: string): Completion => ({ label, type: 'keyword', info })
const m = (label: string, kind: string, info: string, args = true): Completion => ({ label, type: 'method', detail: kind, info, apply: args ? call(label) : label })

/* ---------- Python ---------- */
const PY_BUILTINS: Completion[] = [
  fn('print', 'mostrar', 'Mostra algo na tela. Ex.: print("oi", nome)', 3),
  fn('len', 'tamanho', 'Quantos itens tem uma lista, ou quantas letras tem um texto. Ex.: len([1, 2, 3]) → 3', 3),
  fn('range', 'sequência', 'Sequência de números para o for. range(5) → 0, 1, 2, 3, 4. range(1, 4) → 1, 2, 3', 3),
  fn('input', 'ler', 'Lê o que a pessoa digita (sempre vem como texto). Ex.: nome = input("Seu nome: ")', 2),
  fn('int', 'converter', 'Transforma em número inteiro. Ex.: int("7") → 7', 2),
  fn('float', 'converter', 'Transforma em número com vírgula. Ex.: float("2.5") → 2.5', 1),
  fn('str', 'converter', 'Transforma em texto. Ex.: str(10) → "10"', 2),
  fn('bool', 'converter', 'Transforma em True ou False.'),
  fn('list', 'converter', 'Cria uma lista. Ex.: list("abc") → ["a", "b", "c"]'),
  fn('dict', 'converter', 'Cria um dicionário (chave → valor).'),
  fn('sum', 'soma', 'Soma todos os números de uma lista. Ex.: sum([2, 3]) → 5', 2),
  fn('min', 'menor', 'O menor valor. Ex.: min([4, 1, 9]) → 1', 1),
  fn('max', 'maior', 'O maior valor. Ex.: max([4, 1, 9]) → 9', 1),
  fn('abs', 'distância', 'Valor sem sinal. Ex.: abs(-5) → 5'),
  fn('round', 'arredondar', 'Arredonda. Ex.: round(2.567, 2) → 2.57'),
  fn('sorted', 'ordenar', 'Devolve uma cópia ordenada. Ex.: sorted([3, 1, 2]) → [1, 2, 3]', 1),
  fn('enumerate', 'com índice', 'Percorre com a posição junto. Ex.: for i, item in enumerate(lista):'),
  fn('zip', 'juntar', 'Anda em duas listas ao mesmo tempo. Ex.: for a, b in zip(nomes, notas):'),
  fn('type', 'tipo', 'Diz o tipo de um valor. Ex.: type(3) → int'),
  fn('isinstance', 'checar tipo', 'Confere o tipo. Ex.: isinstance(x, int)'),
  fn('reversed', 'inverter', 'Percorre de trás pra frente.'),
  fn('any', 'algum', 'True se algum item for verdadeiro.'),
  fn('all', 'todos', 'True se todos os itens forem verdadeiros.'),
  fn('map', 'aplicar', 'Aplica uma função em cada item.'),
  fn('filter', 'filtrar', 'Fica só com os itens que passam num teste.'),
  fn('open', 'arquivo', 'Abre um arquivo. Ex.: with open("dados.txt") as f:'),
]
const PY_WORDS: Completion[] = [
  kw('return', 'Devolve um valor e sai da função.'),
  kw('True', 'Verdadeiro.'),
  kw('False', 'Falso.'),
  kw('None', 'Nada / vazio.'),
  kw('and', 'E: as duas condições precisam ser verdadeiras.'),
  kw('or', 'OU: basta uma condição ser verdadeira.'),
  kw('not', 'NÃO: inverte a condição.'),
  kw('in', 'Está dentro? Ex.: if "a" in palavra:'),
  kw('is', 'É o mesmo objeto. Ex.: if x is None:'),
  kw('break', 'Sai do laço na hora.'),
  kw('continue', 'Pula para a próxima volta do laço.'),
  kw('pass', 'Não faz nada (guarda o lugar).'),
  kw('import', 'Traz um módulo. Ex.: import math'),
  kw('from', 'Ex.: from math import sqrt'),
  kw('global', 'Usa a variável de fora da função.'),
  kw('lambda', 'Função de uma linha. Ex.: lambda x: x * 2'),
  kw('class', 'Cria uma classe (um molde de objeto).'),
  kw('with', 'Abre algo e fecha sozinho no fim.'),
  kw('try', 'Tenta rodar; se der erro, cai no except.'),
  kw('except', 'O que fazer quando der erro.'),
]
const PY_SNIPPETS: Completion[] = [
  snip('def ${nome}(${parametros}):\n\t${pass}', { label: 'def', detail: 'função', type: 'keyword', info: 'Cria uma função.', boost: 4 }),
  snip('for ${item} in ${lista}:\n\t${}', { label: 'for', detail: 'laço', type: 'keyword', info: 'Passa por cada item de uma lista.', boost: 4 }),
  snip('for ${i} in range(${n}):\n\t${}', { label: 'for range', detail: 'laço contado', type: 'keyword', info: 'Repete n vezes, com i indo de 0 até n-1.', boost: 3 }),
  snip('if ${condicao}:\n\t${}', { label: 'if', detail: 'condição', type: 'keyword', info: 'Só roda se a condição for verdadeira.', boost: 4 }),
  snip('if ${condicao}:\n\t${}\nelse:\n\t', { label: 'if else', detail: 'condição', type: 'keyword', info: 'Um caminho se for verdade, outro se não for.', boost: 3 }),
  snip('elif ${condicao}:\n\t${}', { label: 'elif', detail: 'senão se', type: 'keyword', info: 'Outra condição, testada se a de cima falhou.', boost: 3 }),
  snip('else:\n\t${}', { label: 'else', detail: 'senão', type: 'keyword', info: 'O que fazer quando nenhuma condição bateu.', boost: 3 }),
  snip('while ${condicao}:\n\t${}', { label: 'while', detail: 'laço', type: 'keyword', info: 'Repete enquanto a condição for verdadeira.', boost: 3 }),
  snip('try:\n\t${}\nexcept ${ValueError}:\n\t', { label: 'try except', detail: 'tratar erro', type: 'keyword', info: 'Tenta rodar e trata o erro se acontecer.' }),
  snip('[${x} for ${x} in ${lista}]', { label: 'lista com for', detail: 'compreensão', type: 'keyword', info: 'Monta uma lista nova a partir de outra. Ex.: [n * 2 for n in numeros]' }),
  snip('f"${texto} {${valor}}"', { label: 'f-string', detail: 'texto com valor', type: 'text', info: 'Texto com variáveis dentro. Ex.: f"Oi, {nome}!"' }),
]
const PY_STR = [
  m('upper', 'texto', 'Tudo em MAIÚSCULAS.'),
  m('lower', 'texto', 'Tudo em minúsculas.'),
  m('strip', 'texto', 'Tira os espaços do começo e do fim.'),
  m('split', 'texto', 'Quebra o texto numa lista. Ex.: "a,b".split(",") → ["a", "b"]'),
  m('replace', 'texto', 'Troca um pedaço por outro. Ex.: t.replace("a", "o")'),
  m('startswith', 'texto', 'Começa com…? Ex.: nome.startswith("A")'),
  m('endswith', 'texto', 'Termina com…?'),
  m('find', 'texto', 'Posição de um pedaço (-1 se não achar).'),
  m('count', 'texto/lista', 'Quantas vezes algo aparece.'),
  m('join', 'texto', 'Junta uma lista num texto. Ex.: ", ".join(nomes)'),
  m('capitalize', 'texto', 'Primeira letra maiúscula.'),
  m('title', 'texto', 'Primeira Letra De Cada Palavra.'),
  m('isdigit', 'texto', 'Só tem números?'),
  m('format', 'texto', 'Coloca valores no texto (prefira f-string).'),
]
const PY_LIST = [
  m('append', 'lista', 'Coloca um item no fim. Ex.: lista.append(5)'),
  m('insert', 'lista', 'Coloca um item numa posição. Ex.: lista.insert(0, "a")'),
  m('pop', 'lista/dicionário', 'Tira e devolve o último item (ou o da posição/chave).'),
  m('remove', 'lista', 'Tira o primeiro item com esse valor.'),
  m('index', 'lista', 'Posição de um valor.'),
  m('sort', 'lista', 'Ordena a própria lista.'),
  m('reverse', 'lista', 'Inverte a própria lista.'),
  m('extend', 'lista', 'Junta outra lista no fim.'),
  m('copy', 'lista/dicionário', 'Faz uma cópia.'),
  m('clear', 'lista/dicionário', 'Esvazia.'),
]
const PY_DICT = [
  m('get', 'dicionário', 'Pega o valor da chave sem dar erro se não existir. Ex.: d.get("nome", "")'),
  m('keys', 'dicionário', 'As chaves.'),
  m('values', 'dicionário', 'Os valores.'),
  m('items', 'dicionário', 'Pares (chave, valor). Ex.: for chave, valor in d.items():'),
  m('update', 'dicionário', 'Junta outro dicionário.'),
  m('setdefault', 'dicionário', 'Pega a chave ou cria com um valor inicial.'),
]

/* ---------- JavaScript ---------- */
const JS_GLOBALS: Completion[] = [
  { label: 'console.log', type: 'function', detail: 'mostrar', info: 'Mostra algo no terminal. Ex.: console.log("oi", nome)', apply: call('console.log'), boost: 3 },
  { label: 'Math.round', type: 'function', detail: 'arredondar', info: 'Arredonda para o inteiro mais próximo.', apply: call('Math.round') },
  { label: 'Math.floor', type: 'function', detail: 'para baixo', info: 'Arredonda para baixo.', apply: call('Math.floor') },
  { label: 'Math.max', type: 'function', detail: 'maior', info: 'O maior valor. Ex.: Math.max(...lista)', apply: call('Math.max') },
  { label: 'Math.min', type: 'function', detail: 'menor', info: 'O menor valor.', apply: call('Math.min') },
  { label: 'Math.abs', type: 'function', detail: 'sem sinal', info: 'Valor sem sinal.', apply: call('Math.abs') },
  { label: 'Math.random', type: 'function', detail: 'sorteio', info: 'Número aleatório entre 0 e 1.', apply: call('Math.random') },
  { label: 'Number', type: 'function', detail: 'converter', info: 'Transforma em número. Ex.: Number("7") → 7', apply: call('Number') },
  { label: 'String', type: 'function', detail: 'converter', info: 'Transforma em texto.', apply: call('String') },
  { label: 'Object.keys', type: 'function', detail: 'objeto', info: 'Lista com as chaves do objeto.', apply: call('Object.keys') },
  { label: 'Object.values', type: 'function', detail: 'objeto', info: 'Lista com os valores do objeto.', apply: call('Object.values') },
  { label: 'Object.entries', type: 'function', detail: 'objeto', info: 'Pares [chave, valor].', apply: call('Object.entries') },
  { label: 'Array.isArray', type: 'function', detail: 'checar', info: 'É uma lista?', apply: call('Array.isArray') },
]
const JS_WORDS: Completion[] = ['return', 'const', 'let', 'true', 'false', 'null', 'undefined', 'break', 'continue', 'new', 'typeof'].map((w) =>
  kw(w, { return: 'Devolve um valor e sai da função.', const: 'Cria uma variável que não muda.', let: 'Cria uma variável que pode mudar.', typeof: 'Diz o tipo do valor.' }[w] ?? ''),
)
const JS_SNIPPETS: Completion[] = [
  snip('function ${nome}(${parametros}) {\n\t${}\n}', { label: 'function', detail: 'função', type: 'keyword', info: 'Cria uma função.', boost: 4 }),
  snip('for (const ${item} of ${lista}) {\n\t${}\n}', { label: 'for of', detail: 'laço', type: 'keyword', info: 'Passa por cada item da lista.', boost: 4 }),
  snip('for (let ${i} = 0; ${i} < ${n}; ${i}++) {\n\t${}\n}', { label: 'for', detail: 'laço contado', type: 'keyword', info: 'Repete n vezes, com i indo de 0 até n-1.', boost: 3 }),
  snip('if (${condicao}) {\n\t${}\n}', { label: 'if', detail: 'condição', type: 'keyword', info: 'Só roda se a condição for verdadeira.', boost: 4 }),
  snip('if (${condicao}) {\n\t${}\n} else {\n\t\n}', { label: 'if else', detail: 'condição', type: 'keyword', info: 'Um caminho se for verdade, outro se não.', boost: 3 }),
  snip('while (${condicao}) {\n\t${}\n}', { label: 'while', detail: 'laço', type: 'keyword', info: 'Repete enquanto a condição for verdadeira.', boost: 3 }),
  snip('(${x}) => ${x}', { label: 'arrow', detail: 'função curta', type: 'keyword', info: 'Função de uma linha. Ex.: (n) => n * 2' }),
  snip('`${texto}`', { label: 'template', detail: 'texto com valor', type: 'text', info: 'Texto com variáveis: `Oi, ${nome}!`' }),
]
const JS_ARR = [
  m('push', 'lista', 'Coloca um item no fim.'),
  m('pop', 'lista', 'Tira o último item.'),
  m('map', 'lista', 'Lista nova transformando cada item. Ex.: nums.map(n => n * 2)'),
  m('filter', 'lista', 'Lista só com os itens que passam no teste.'),
  m('reduce', 'lista', 'Junta tudo num valor só. Ex.: nums.reduce((s, n) => s + n, 0)'),
  m('find', 'lista', 'O primeiro item que passa no teste.'),
  m('includes', 'lista/texto', 'Tem esse valor dentro?'),
  m('indexOf', 'lista/texto', 'Posição do valor (-1 se não achar).'),
  m('forEach', 'lista', 'Roda algo para cada item.'),
  m('sort', 'lista', 'Ordena a própria lista.'),
  m('slice', 'lista/texto', 'Pega um pedaço.'),
  m('join', 'lista', 'Junta tudo num texto. Ex.: nomes.join(", ")'),
  m('some', 'lista', 'Algum item passa no teste?'),
  m('every', 'lista', 'Todos passam no teste?'),
  { label: 'length', type: 'property', detail: 'lista/texto', info: 'Quantos itens (ou letras) tem.' },
]
const JS_STR = [
  m('toUpperCase', 'texto', 'Tudo em MAIÚSCULAS.'),
  m('toLowerCase', 'texto', 'Tudo em minúsculas.'),
  m('trim', 'texto', 'Tira os espaços do começo e do fim.'),
  m('split', 'texto', 'Quebra numa lista. Ex.: "a,b".split(",")'),
  m('replace', 'texto', 'Troca um pedaço por outro.'),
  m('startsWith', 'texto', 'Começa com…?'),
  m('endsWith', 'texto', 'Termina com…?'),
  m('padStart', 'texto', 'Completa à esquerda. Ex.: "7".padStart(2, "0") → "07"'),
  m('toFixed', 'número', 'Número com casas decimais, como texto. Ex.: (2.5).toFixed(2) → "2.50"'),
]

/** Adivinha se a variável é texto, lista ou dicionário pela última vez que ela recebeu um valor. */
function guessKind(doc: string, name: string, lang: Lang): 'texto' | 'lista' | 'dict' | '' {
  if (!/^\w+$/.test(name)) return ''
  const re = new RegExp(`\\b${name}\\s*(?::[^=]+)?=\\s*(\\S)(\\S*)`, 'g')
  let last = ''
  for (let mm = re.exec(doc); mm; mm = re.exec(doc)) last = mm[1] + mm[2].slice(0, 6)
  if (!last) return ''
  if (last[0] === '[') return 'lista'
  if (last[0] === '{') return lang === 'python' ? 'dict' : ''
  if (/^["'`]|^f["']|^input\(|^str\(/.test(last)) return 'texto'
  return ''
}

/** Fonte de sugestões do editor. */
export function codeCompletions(lang: Lang) {
  const words = lang === 'python' ? [...PY_SNIPPETS, ...PY_BUILTINS, ...PY_WORDS] : [...JS_SNIPPETS, ...JS_GLOBALS, ...JS_WORDS]
  return (ctx: CompletionContext): CompletionResult | null => {
    // Depois de um ponto: métodos
    const member = ctx.matchBefore(/[\w)\]"'`]+\.\w*$/)
    if (member) {
      const dot = member.text.lastIndexOf('.')
      const owner = member.text.slice(0, dot)
      const globals = lang === 'javascript' ? JS_GLOBALS.filter((g) => g.label.startsWith(owner + '.')) : []
      if (globals.length)
        return { from: member.from + dot + 1, options: globals.map((g) => ({ ...g, label: g.label.slice(owner.length + 1), apply: call(g.label.slice(owner.length + 1)) })), validFor: /^\w*$/ }
      const doc = ctx.state.doc.toString()
      const kind = /^["'`]|["'`]$/.test(owner) ? 'texto' : /\]$/.test(owner) ? 'lista' : guessKind(doc, owner, lang)
      let options: Completion[]
      if (lang === 'python') options = kind === 'texto' ? PY_STR : kind === 'lista' ? PY_LIST : kind === 'dict' ? PY_DICT : [...PY_LIST, ...PY_DICT, ...PY_STR]
      else options = kind === 'texto' ? [...JS_STR, JS_ARR.find((x) => x.label === 'length')!, ...JS_ARR.filter((x) => /includes|indexOf|slice/.test(x.label))] : kind === 'lista' ? JS_ARR : [...JS_ARR, ...JS_STR]
      return { from: member.from + dot + 1, options, validFor: /^\w*$/ }
    }
    const word = ctx.matchBefore(/\w+$/)
    if (!word && !ctx.explicit) return null
    return { from: word ? word.from : ctx.pos, options: words, validFor: /^\w*$/ }
  }
}
