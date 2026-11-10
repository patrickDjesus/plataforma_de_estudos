# Mendonça: pacote "estudo eficaz" (decisões)

**Objetivo:** reforço geral, sem prova marcada. O foco é **domínio dos tópicos e constância**, não contagem regressiva.
**Princípio:** o Mendonça já organiza *quando* estudar; este pacote cuida de *como* estudar, com prática de recuperação (tentar lembrar em vez de reler).

---

## 1. Claude dentro do Mendonça

- **Agora:** usa a sua conta do claude.ai pela própria página publicada (pede permissão na 1ª vez; entra no seu limite de uso). **Nenhuma chave de API no site.**
- **Depois (site próprio):** um pequeno servidor (função na Vercel) guarda a chave da API em segredo, com login e limite de uso. A nuvem passa a ser o Supabase.
- **Tomadas trocáveis:** a IA e a nuvem ficam atrás de uma interface única. Migrar = configurar, não reescrever.
- Toda correção feita pela IA é marcada como **sugestão**, com botão **"Contestar"**.

## 2. Aba Recuperação (nova)

Painel do dia: desafios pendentes, flashcards a revisar e caderno de erros.

**Desafios personalizados**
- Montados a partir das **suas anotações** + nome da matéria e do tópico.
- Cada desafio sorteia **3 a 5 itens** variados entre: múltipla escolha, V/F com justificativa, resposta aberta corrigida pelo Claude, "explique com suas palavras" e completar lacunas (frases da sua nota).
- **Quando aparecem:**
  1. No **fim de cada bloco**, dentro da sessão guiada (3 itens rápidos);
  2. Nas **revisões espaçadas**: o resultado do desafio define a próxima data (a avaliação manual Difícil/Ok/Fácil continua disponível);
  3. **Sob demanda**: botão **"Desafie-me"** em cada nota e cada tópico.
- **Nota vazia:** o desafio usa conhecimento geral sobre o tópico (avisando), e o botão **"Explicar este tópico"** gera um resumo para você ler e anotar.

**Flashcards**
- O Claude **sugere cartões** a partir das suas notas (você aprova, edita ou descarta) **e** você pode criar à mão.
- Entram na mesma revisão espaçada (Difícil/Ok/Fácil por cartão).

**Caderno de erros**
- Toda questão errada (desafio, questões, flashcard, treino de escrita) vira registro: tópico, **motivo** (não sabia / confundi / desatenção / tempo) e a correção.
- O erro volta na revisão espaçada até ser **acertado 2 vezes seguidas**.

## 3. Aba Questões (nova)

**Gerador sob demanda**
- Matéria e tópicos (um, vários ou matéria inteira) · quantidade (5 / 10 / 20) · dificuldade (fácil / médio / difícil / misto) · tipo (múltipla escolha estilo vestibular / discursiva / V/F / misto) · base (minhas anotações / conhecimento geral) · **pedido livre** em texto.
- Depois de responder: nota, correção item a item, explicação e **histórico salvo**. Erros vão para o caderno de erros.

**Treino de escrita (norma-padrão)**
- O Claude **propõe um tema**; você escreve livremente sobre ele.
- O Claude marca cada desvio (crase, vírgula, concordância, regência, acentuação, ortografia…), explica a regra e mostra a forma correta.
- Os desvios entram no **caderno de erros** e são contados por tipo (ex.: "vírgula antes de 'que': 12×").

## 4. Sessão guiada (modo foco)

Abre pelo botão **"Começar"** de qualquer bloco, em tela cheia.
1. **Antes (30 s):** "O que você quer conseguir neste bloco?"
2. **Durante:** ciclos de foco e pausa **configuráveis (padrão 25/5)**, nota do tópico aberta ao lado e o Capi em silêncio.
3. **Depois (1 min):** desafio rápido (3 itens) ou tela em branco + **autoavaliação de confiança (1–5)**.

## 5. Domínio por tópico (0–100%)

- **Desafios e questões: 50%** · **revisões e flashcards: 25%** · **autoavaliação: 15%** · **tempo estudado: 10%**.
- Erros não resolvidos no caderno **descontam** pontos.
- O domínio **cai devagar sem revisão** e sobe quando você revisa.
- **Usos:** o planejador prioriza os tópicos mais fracos; o mapa mental pinta cada tópico de **vermelho (fraco) a verde (dominado)**; Matérias mostra o domínio em vez do "concluído".

## 6. Revisão da semana

Primeiro passo do check-in em tela cheia: horas por área, plano cumprido, tópicos mais fracos e erros mais comuns. O Capi pergunta **"O que funcionou? O que travou?"**, e as respostas ajustam a semana seguinte.

## 7. Menu

**Início · Semana · Recuperação · Questões · Caderno · Mapa · Matérias · Ajustes**

## 8. Ordem de construção

| Etapa | Conteúdo |
|---|---|
| **1** | Tomada de IA (claude.ai agora) · flashcards na revisão espaçada · sessão guiada |
| **2** | Desafios personalizados (3 momentos) · "Explicar este tópico" · aba Recuperação |
| **3** | Aba Questões · treino de escrita · caderno de erros |
| **4** | Domínio por tópico (planejador + mapa) · revisão da semana |
| Depois | Migração para site próprio (servidor com a chave + Supabase), quando você quiser |
