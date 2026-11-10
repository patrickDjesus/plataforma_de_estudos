# Mendonça

Plataforma pessoal de estudos: matérias, caderno conectado, check-in semanal e planejador automático.
As decisões de produto estão em [`docs-decisoes.md`](docs-decisoes.md).

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes do planejador
npm run build    # versão de produção em dist/
```

## Onde fica cada coisa

| Pasta | O quê |
|---|---|
| `src/db/` | Banco local (IndexedDB/Dexie). **Único lugar** a trocar quando entrar o Supabase. |
| `src/lib/planner.ts` | Algoritmo do plano semanal (função pura, testada). |
| `src/lib/wikilink.ts` | Ligações `[[Nota]]` do caderno. |
| `src/pages/` | Telas: Início, Check-in, Semana, Caderno, Matérias, Ajustes. |

## Publicar (Vercel)

Suba para um repositório no GitHub e importe na Vercel. O `vercel.json` já cuida das rotas.
Lembre: até o Supabase entrar, os dados ficam no navegador. Use **Ajustes → Exportar backup**.
