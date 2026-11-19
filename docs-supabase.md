# Mendonça na Vercel + Supabase

O mesmo código roda em dois lugares:

- **claude.ai (Artifact):** sincroniza pela nuvem do claude.ai e usa a IA da sua conta do Claude.
- **Vercel:** sincroniza pelo Supabase (com login por link no e-mail) e usa a IA pela função `api/ia.ts`, com a sua chave da API.

## 1. Supabase: criar a tabela

No painel do Supabase, abra **SQL Editor → New query**, cole e rode:

```sql
create table if not exists public.mendonca_docs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  body jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.mendonca_docs enable row level security;

create policy "dono lê" on public.mendonca_docs for select using (auth.uid() = user_id);
create policy "dono insere" on public.mendonca_docs for insert with check (auth.uid() = user_id);
create policy "dono atualiza" on public.mendonca_docs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono apaga" on public.mendonca_docs for delete using (auth.uid() = user_id);

alter publication supabase_realtime add table public.mendonca_docs;
```

Cada registro do app (matéria, nota, bloco, cartão…) vira uma linha. As regras de segurança (RLS) fazem cada pessoa ver e mexer só nas próprias linhas.

## 2. Supabase: login por e-mail

Em **Authentication → URL Configuration**:

- **Site URL:** o endereço do site na Vercel (ex.: `https://plataforma-de-estudos.vercel.app`).
- **Redirect URLs:** adicione o mesmo endereço.

O login por link no e-mail (Email / Magic Link) já vem ligado por padrão em **Authentication → Sign In / Providers → Email**.

## 3. Vercel: variáveis de ambiente

Em **Project → Settings → Environment Variables**:

| Nome | Valor | Observação |
|---|---|---|
| `ANTHROPIC_API_KEY` | sua chave da API do Claude (console.anthropic.com) | obrigatória para a IA; nunca vai para o site |
| `ALLOWED_EMAILS` | seu e-mail | opcional, mas recomendado: só esse e-mail usa a IA (e gasta a chave) |
| `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` | URL e chave pública do projeto | a integração Supabase da Vercel já cria; se não usou a integração, crie com o prefixo `VITE_` ou `NEXT_PUBLIC_` |

Depois de mudar variáveis, faça um novo deploy (**Deployments → … → Redeploy**), porque as do Supabase entram no build.

## 4. Como funciona

- **Dados:** continuam salvos no navegador (funciona offline) e são espelhados na tabela; mudanças de outro aparelho chegam ao vivo. Conflito: vence a alteração mais recente.
- **Aparelho novo:** entre antes de usar. Os conteúdos padrão criados antes do login nunca sobrescrevem o que já está na nuvem.
- **IA:** `POST /api/ia` confere o login no Supabase, chama o Claude Opus 5.5 (esforço baixo, médio ou alto conforme o pedido) e devolve o texto. Se um pedido for recusado pelos filtros de segurança, a API tenta sozinha um modelo reserva.
- **Custo:** a API do Claude é cobrada por uso, à parte da assinatura do claude.ai. Defina um limite de gastos no console da Anthropic.
