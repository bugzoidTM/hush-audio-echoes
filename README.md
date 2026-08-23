# shhhh

**Ouça o que ninguém conta.** Rede social de áudio: histórias, segredos e
desabafos contados pela própria voz — com identidade pseudônima (uma *Voice*)
ou de forma anônima.

Produção: **https://shhhh.me** · backend em Supabase self-hosted (Docker Swarm).

## Nome do produto e nome do código

Uma convenção, para não haver renomeação aleatória nos dois sentidos:

| Onde | Nome |
| --- | --- |
| Marca pública: domínio, título, manifest, textos da interface, loja | **shhhh** |
| Codinome interno do pivot: docs de arquitetura, PRD, mensagens de commit | **Hush 2.0** |
| Código: `HushLayout`, `hushApi`, `src/pages/hush/`, repositório `hush-audio-echoes` | **Hush** (identificador, não marca) |

Nada que o usuário lê diz "Hush". Nada que o código chama de `Hush` precisa
virar `shhhh`: renomear identificador não muda produto e só gera diff.

## Conceitos

- **Echo** — o post: um áudio com categoria, chamada opcional e prazo de
  validade (1h, 24h, 7d ou permanente).
- **Voice** — a identidade pública pseudônima (`@handle`), separada da conta.
  Publicar anonimamente não vincula Voice nenhuma ao Echo.
- **Protect My Voice** — preview com a voz alterada; o áudio original nunca sai
  do dispositivo.
- **Communities** — congeladas atrás da flag `COMMUNITIES_ENABLED` até publicar
  Echo dentro da Community existir.

## Moderação

Nenhum Echo nasce aprovado. A publicação grava `pending`; um worker no host
transcreve o **áudio publicado** com o whisper local e só então classifica. O
texto que o navegador envia serve de UX e nunca de fonte de confiança. O que a
análise automática não libera vai para a fila humana em `/admin`, que exige
papel `admin` ou `moderator` — a checagem é do banco, não da tela.

Detalhes e comandos: [`docs/RUNBOOK-PRODUCAO-SWARM.md`](docs/RUNBOOK-PRODUCAO-SWARM.md) §5.1 e §5.1.1.

## Desenvolvimento

```sh
npm ci
cp .env.example .env        # e preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

Não existe endereço de Supabase embutido no código: sem `.env`, `vite build`
falha e `npm run dev` avisa no terminal. Isso é proposital — antes, um build sem
ambiente apontava calado para a instalação de produção.

Gate antes de qualquer publicação — o mesmo que o CI roda em todo push e PR
(`.github/workflows/ci.yml`):

```sh
npm run typecheck && npm run lint && npm test && npm run build
npx playwright test        # e2e
```

O E2E `tests/e2e/fluxo-completo.spec.ts` percorre o caminho inteiro de um
usuário novo — cadastro, onboarding, gravação (com microfone falso do Chromium),
Protect My Voice, publicação, o gate de "em análise", Discovery, reação, seguir
Voice e responder — contra um backend simulado em `tests/e2e/support/backend.ts`.
Ele é hermético de propósito: o CI não tem credencial da instalação real. A
verdade do backend é verificada contra produção pelos scripts `scripts/deploy/05`
(fluxo e limites), `07` (moderação) e `08` (rate limiting).

## Implantação

O runbook vivo é [`docs/RUNBOOK-PRODUCAO-SWARM.md`](docs/RUNBOOK-PRODUCAO-SWARM.md):
esta instalação roda o Supabase como **stack do Docker Swarm**, não como
`docker compose` (o PRD em `docs/PRODUCAO_VPS_SUPABASE.md` assume o contrário e
está mantido só como referência histórica).

```sh
scripts/deploy/01-backup.sh              # backup verificável
scripts/deploy/02-apply-migration.sh     # migrações
scripts/deploy/03-install-functions.sh   # Edge Functions
scripts/deploy/04-smoke-test.sh
scripts/deploy/05-verificacao-funcional.sh
scripts/deploy/06-install-cron.sh        # limpeza + moderação
scripts/deploy/07-verificacao-moderacao.sh
npm run build && rsync -a --delete dist/ /root/shhhh-site/public/
```

## Limites por conta

`public.rate_limits` guarda o limite de cada ação (publicar, reagir, denunciar,
criar Voice, seguir). Vale no banco — gatilho nas tabelas que o PostgREST expõe
e chamada explícita na Edge Function de publicação — então nenhum cliente escapa.
Ajustar é um `UPDATE`, sem deploy:

```sql
update public.rate_limits set max_hits = 10 where action = 'publish_echo';
```

## Stack

Vite · React · TypeScript · Tailwind · shadcn-ui · Supabase (Postgres + RLS,
GoTrue, Storage, Edge Functions em Deno) · whisper local para transcrição.
