# Mendonça: documento de decisões

Plataforma pessoal de estudos. Uso exclusivo do autor, sem contas nem login.
**Estrela-guia:** tudo conectado num lugar só, simples de usar e livre para personalizar.

---

## 1. Fundamentos

| Decisão | Escolha |
|---|---|
| Público | Só você |
| Tipo de estudo | Livre: Faculdade, Ensino Médio e Idiomas |
| Plataforma | Web (navegador) |
| Quem programa | Claude decide stack e implementa |
| Personalização | Editar o próprio código (sem sistema de plugins) + cores/ajustes na interface |
| Idioma da interface | Português (pt-BR) |

## 2. Stack técnica

- **React + TypeScript + Vite**
- **Tailwind CSS** para o visual
- **IndexedDB via Dexie**: dados no navegador por enquanto
- **Camada de dados isolada**: trocar para o **Supabase** depois mexe num só lugar
- **Tiptap** (editor do caderno) e **React Flow** (mapa mental, na V3)
- **Exportar/importar backup em JSON** desde a V1
- Hospedagem: construído localmente agora; GitHub + Vercel depois

## 3. Organização do conteúdo

```
Área (fixas, nesta ordem): Faculdade → Ensino Médio → Idiomas
 └─ Matéria (Cálculo I, Física, Inglês…)   — peso 1–5, obrigatória/opcional, prazo opcional
     └─ Tópico (Limites, Cinemática…)        — unidade agendada pelo planejador; ordem arrastável
         └─ Notas do caderno (várias por tópico)
```

**Cores:** geradas automaticamente, com uma família por área e um tom por matéria, e editáveis por você.
A cor da matéria é a mesma em todo lugar.

## 4. Caderno

- Editor visual com atalhos de Markdown (`# ` vira título)
- Só texto: títulos, negrito, itálico, listas, **destaque colorido** e ligações `[[Nota]]`
- Sem imagens, LaTeX, código ou tabelas, para manter o banco leve

## 5. Check-in semanal (ritual de segunda)

- A semana começa na **segunda**. O primeiro acesso a partir de segunda redireciona para a **tela de foco**.
  Se você só abrir na quarta, o plano cobre apenas os dias restantes.
- A tela mostra:
  - **Grade de disponibilidade**, pré-preenchida com a da semana anterior e editável
  - **Controles deslizantes de % por área**, com as horas resultantes visíveis ("70% = 14h")
  - **Piso da Faculdade = 2/3 das horas**. Abaixo disso aparece um aviso que pede confirmação (não é trava).
  - Botão **"Repetir a semana passada"**, que confirma tudo com um clique

## 6. Planejador automático

- Horas da área → matérias, **por peso**, com reforço para **prazo próximo**. Você pode **pausar** uma matéria na semana.
- Tópicos seguem a ordem cadastrada.
- **Blocos configuráveis**: padrão de 50 min, com mínimo e máximo definidos; no máximo 2 blocos seguidos da mesma matéria, intercalando matérias.
- **Revisão espaçada** (V2): +1, +7 e +30 dias, ajustada pelos botões 😣 Difícil / 🙂 Ok / 😎 Fácil. Teto de cerca de 20% das horas.
- **Bloco perdido** (V2): replanejamento automático para o próximo horário livre, respeitando prioridades.

## 7. Calendário

- **Somente a visão da semana atual.** A semana vira e a próxima aparece.
- O histórico das semanas anteriores **fica guardado** (para estatísticas, sequência e nível), mas não aparece no calendário.
- Blocos coloridos por matéria, que você pode **arrastar e redimensionar**.
- **Eventos manuais**: *compromisso* (bloqueia o horário) e *prova/entrega* (vira prazo da matéria).
- Legenda de matérias com o total de horas da semana ("Matemática 4h").

## 8. Registro de estudo

- **Cronômetro** no bloco (começar/pausar), sempre visível no topo enquanto roda
- Botão **"feito"** ao terminar

## 9. Dashboard (V2)

- **Topo:** Hoje (próximos blocos com botão "começar") e Revisões pendentes
- **Meio:** progresso da semana (horas planejadas × feitas, por área e por matéria)
- **Base:** sequência 🔥, mapa de calor anual e notas recentes
- **Nível/XP** em destaque no cabeçalho

## 10. Gamificação (V3)

- **XP:** 1 por minuto estudado; +50% em revisões; +20 por bloco concluído inteiro
- **Nível:** curva crescente; **nível geral + nível por área**
- **Cerca de 10 conquistas** simples (7 dias seguidos, 100h de Faculdade…)

## 11. Mapa mental (V3)

- Nós: **matérias e tópicos** (maiores, "centros de gravidade") e **notas** orbitando
- Ligações vêm de `[[...]]` e da hierarquia; você pode arrastar à vontade
- Visões: **global**, **local** (vizinhança da nota aberta) e **filtro por área/matéria**

## 12. Visual

Inspirado na referência enviada, sem copiar marca ou identidade:
- **Só tema claro**: fundo branco/cinza muito claro, cards com cantos bem arredondados e sombra suave
- Navegação no topo com ícones; cronômetro em formato de pílula escura no canto direito
- Cores vivas e saturadas por matéria nos blocos, chips e barras de progresso
- Ar futurista: tipografia geométrica, gradientes sutis, barra de XP em destaque

## 13. Fases

| Fase | Conteúdo |
|---|---|
| **V1 (agora)** | Áreas/Matérias/Tópicos com cores · caderno com `[[ligações]]` · check-in semanal · planejador automático · calendário semanal (arrastar e eventos manuais) · cronômetro + "feito" · histórico salvo · backup JSON |
| V2 | Revisão espaçada · replanejamento de blocos perdidos · dashboard completo |
| V3 | Mapa mental · gamificação · Supabase · deploy na Vercel |
