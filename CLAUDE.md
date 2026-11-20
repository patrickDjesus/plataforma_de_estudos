# Mendonça: notas para o Claude

Site pessoal de estudos do Patrick. **Sempre responder em português.** Detalhes de produto em `docs-decisoes.md`; Vercel/Supabase em `docs-supabase.md`.

## Onde roda
- **Uso real:** Artifact do claude.ai → https://claude.ai/artifact/9xDXDsSC1pNCW3nhMhkZV6 (IA pela conta Pro via `sample`, dados na nuvem do claude.ai via `db`). Capabilities: dictation, sample, db, user.
- **Reserva:** Vercel + Supabase (`api/ia.ts`, `src/lib/supabase.ts`). Não está em uso (a API do Claude é paga à parte).

## Publicar uma mudança (sempre os dois)
```bash
npx tsc --noEmit -p . && npx vitest run
npx vite build --mode artifact --base ./ --outDir dist-artifact
rm -f artifact/app.js artifact/app.css && cp dist-artifact/assets/*.js artifact/app.js && cp dist-artifact/assets/*.css artifact/app.css
git add -A && git commit -m "..." && git push origin main
```
Depois publicar `artifact/mendonca.html` com files `{app.js, app.css}` na URL acima (Artifact tool, sem `capabilities` para manter as atuais). O build `--mode artifact` precisa sair num arquivo JS só.

## Stack
React 19, TypeScript, Vite 8, Tailwind v4, react-router 7 (MemoryRouter no Artifact), Dexie 4 (IndexedDB) + sincronização em `src/lib/cloud.ts` (claude.ai `db` ou Supabase). IA em `src/lib/ai.ts`.

## Gosto do usuário (importante)
- Visual atual (tema claro, cartões, ícones com degradê, painel com barra lateral escura no Início) é o que ele gosta. Tentativas de "redesign editorial"/tema creme foram rejeitadas e revertidas: não refazer o visual sem ele pedir.
- Ele gosta de coisas animadas e "gamificadas" (rank, Rush, Capi a capivara mascote).
- Textos curtos; sem explicação longa em botões.

## Regras do app que já foram decididas
- Áreas: Faculdade (≥2/3 do tempo), Ensino Médio, Idiomas (Inglês). Semana temática: 1 matéria por área; a do Ensino Médio é sorteada na roleta do check-in.
- Planejamento padrão: **horas por dia** (`Week.dailyMinutes`, blocos `flex` sem hora); horários fixos são opção.
- Bloco não marcado fica **pendente** por 24h depois do fim (no modo horas: depois do fim do dia) antes de virar perdido (`GRACE_MS` em `src/db/repo.ts`).
- Nuvem do claude.ai: limite de 25.000 registros; faxina remove marcas de apagado com mais de 30 dias; contador em Ajustes.
- Rank e emblemas em `src/lib/rank.ts`, `src/components/RankArt.tsx`.

## Testes
`npx vitest run` (unitários). Testes de ponta a ponta eram scripts Playwright temporários fora do repositório; recriar se precisar (a página falsa de `window.claude` simula `sample`, `db` e `user`).
