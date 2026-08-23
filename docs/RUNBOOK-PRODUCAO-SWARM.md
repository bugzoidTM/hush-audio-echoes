# Runbook de produção — shhhh em Supabase self-hosted (Docker Swarm)

Este documento executa o mesmo procedimento do PRD
[`Implantação em produção_ shhhh + Supabase self-hosted.md`](../Implanta%C3%A7%C3%A3o%20em%20produ%C3%A7%C3%A3o_%20shhhh%20%2B%20Supabase%20self-hosted.md),
adaptado à instalação real: nela o Supabase roda como **stack do Docker Swarm**
(`supabase_db`, `supabase_functions`, `supabase_kong`, …), e não como um projeto
`docker compose` com `run.sh`. Os comandos do PRD (`docker compose exec`,
`sh run.sh restart functions`, `.env` da stack) **não existem** nesse formato e
foram traduzidos abaixo.

| PRD (docker compose) | Aqui (Swarm) |
|---|---|
| `docker compose exec -T db psql …` | `docker exec -i $(docker ps -q -f name=^/supabase_db\.) psql …` |
| `sh run.sh restart functions` | `docker service update --force supabase_functions` |
| `sh run.sh recreate functions` | `docker service update --env-add … supabase_functions` |
| `.env` da stack + `env_file:` | variáveis no `docker-stack` (`/root/supabase.yaml`) / `--env-add` |
| `volumes/functions/` | bind mount `/root/supabase/docker/volumes/functions` |

Todos os scripts abaixo estão em `scripts/deploy/` e leem os caminhos das
variáveis `SUPABASE_STACK`, `SUPABASE_VOLUMES_DIR`, `PUBLIC_SUPABASE_URL` e
`BACKUP_DIR` (valores padrão já correspondem à VPS).

## 1. Pré-requisitos

- Acesso root ao nó *manager* do Swarm (é onde o bind mount das Functions existe).
- `OPENAI_API_KEY` válida para `transcribe-audio` e `generate-echo-hook`.
  Grave-a em `/root/.shhhh-openai-key` com `chmod 600`; nunca em Git ou no crontab.
- Checkout deste repositório atualizado.

> Nunca use `docker stack rm`, `docker volume rm` ou qualquer comando que remova
> volumes. Eles destroem dados e não fazem parte deste runbook.

## 2. Backup verificável

```bash
scripts/deploy/01-backup.sh
```

Gera `shhhh-pre-hush2-<stamp>.dump` (formato custom do `pg_dump`) e
`functions-pre-hush2-<stamp>.tgz` em `$BACKUP_DIR` (padrão `/root/backups/shhhh`),
e valida os dois artefatos. Só siga adiante se o script terminar com sucesso.

## 3. Migração de banco

```bash
scripts/deploy/02-apply-migration.sh
scripts/deploy/02-apply-migration.sh supabase/migrations/20260823120000_shhhh_authorization_and_moderation_hardening.sql
```

Aplica `supabase/migrations/20260821190000_shhhh_echoes_voices_communities.sql`
com `ON_ERROR_STOP=1` (a migração é transacional) e confere tabelas, funções
RPC, categorias e o bucket `echo-audio`. **Não prossiga se a verificação falhar.**

A segunda migração (2026-08-23) fecha três buracos de autorização e é
obrigatória antes de qualquer beta aberto:

- `audio_posts` não aceita mais `INSERT/UPDATE/DELETE` direto — um `PATCH` no
  PostgREST trocava `moderation_status`, `visibility`, `voice_id` e `audio_url`.
  O dono passa por `update_echo_metadata()` e `delete_echo()`, campo a campo.
- `community_members` não aceita mais entrar com qualquer papel em qualquer
  Community: era escalonamento de privilégio direto (bastava inserir-se como
  `creator`). Não existe política de `UPDATE`: promoção de papel não passa pela
  API pública.
- A moderação deixa de acreditar no cliente (veja §5.1).

Ela também recoloca na fila os Echoes já aprovados pelo caminho antigo
(`moderation_source = 'legacy_client'`): eles somem do Discovery até o worker
transcrever o áudio. Rode o worker logo depois, ou espere o cron de 2 min.

## 4. Edge Functions

```bash
OPENAI_KEY_FILE=/root/.shhhh-openai-key scripts/deploy/03-install-functions.sh
```

Copia as seis Functions para o volume do edge-runtime e recria o serviço.
Sem `OPENAI_KEY_FILE`, o script apenas reinicia o serviço (use quando só o
código mudou). A chave nunca é impressa; em Swarm ela fica na especificação do
serviço, visível apenas a quem já tem acesso ao Docker do host.

| Function | Autorização |
|---|---|
| `main` | roteador do edge-runtime (limites de memória/CPU/tempo do worker) |
| `publish-echo`, `discovery-feed`, `generate-echo-hook`, `transcribe-audio` | sessão de usuário |
| `moderate-echo` | usuário com papel administrativo |
| `cleanup-expired-audios` | somente a chave server-side (service role) |

Cada Function revalida a sessão internamente, então o gate do roteador
(`VERIFY_JWT`) é defesa em profundidade, não a única barreira.

### Serviços de IA: nada de OpenAI

O PRD previa uma `OPENAI_API_KEY`. Em vez dela, as duas Functions que usariam a
OpenAI falam com serviços gratuitos que já rodam na VPS:

| Function | Serviço | Variáveis |
|---|---|---|
| `transcribe-audio` | `whisper-stt` (faster-whisper, CPU) | `STT_URL` (padrão `http://whisper-stt:8000`), `STT_TIMEOUT_MS` |
| `generate-echo-hook` | `chatgptproxy` (API compatível com a da OpenAI) | `HOOK_API_URL`, `HOOK_API_KEY`, `HOOK_MODEL`, `HOOK_TIMEOUT_MS` |

Nenhum áudio sai da infraestrutura. Os dois proxies de LLM da VPS (`chatgptproxy`
e `qwenproxy`) dirigem um navegador e levam de 45 s a alguns minutos, enquanto o
Kong corta a requisição em 60 s — por isso a sugestão de chamada tem teto de
50 s, cai num resumo local calculado a partir da transcrição e o cliente já
mostra esse resumo na hora, trocando pelo texto do modelo só se ele chegar.

Os limites do worker ficam em `supabase/functions/main/index.ts` (memória, tempo
de parede e tempo de CPU). Os padrões do pacote self-hosted — 150 MB, 60 s e o
limite de CPU implícito — matavam a transcrição com `WorkerRequestCancelled`.

## 5. Manutenção periódica: expiração de mídia e moderação

```bash
scripts/deploy/06-install-cron.sh
```

Instala os dois jobs em `/usr/local/lib/shhhh` (fora do checkout) e escreve o
crontab:

| job | intervalo | log |
| --- | --- | --- |
| `cleanup-expired-audios.sh` | 15 min | `/var/log/shhhh-cleanup.log` |
| `moderate-pending-echoes.sh` | 2 min | `/var/log/shhhh-moderation.log` |

Os scripts leem a chave server-side do próprio serviço do Swarm, em memória; o
crontab não contém credencial alguma.

## 5.1 Moderação server-side (obrigatória)

Desde a migração `20260823120000`, **nenhum Echo nasce aprovado**. A moderação
automática lia a transcrição que o navegador enviava — bastava não enviar
transcrição para publicar sem análise nenhuma. Agora:

1. `publish-echo` grava o Echo com `moderation_status = 'pending'` e guarda o
   texto do navegador em `client_transcription` (sinal de UX, nunca de
   confiança). `transcription` só recebe texto vindo do servidor.
2. O Echo fica invisível: `get_discovery_feed`, `get_public_echo` e
   `get_echo_replies` só devolvem `approved`. O autor vê o estado pelo
   `get_my_echo_status` (a tela `/e/:id` mostra "em análise" e se atualiza
   sozinha).
3. O worker `moderate-pending-echoes.sh` baixa o áudio publicado, normaliza o
   pico (o VAD do whisper devolve texto vazio em áudio baixo), transcreve no
   `whisper-stt` da VPS e chama `apply_server_moderation`.
4. `classify_transcription` decide: `approved`, `review_required` (dado
   pessoal, risco à vida, assédio) ou `rejected` (abuso infantil, ameaça de
   morte, instrução para explosivo).

Fail closed em todo caminho: transcrição vazia conta tentativa e, na terceira,
o Echo vai para `review_required` (fila humana) — nunca para `approved`. Se a
fila envelhecer 30 minutos, o worker avisa no Telegram (token em
`/root/.shhhh-telegram-token`).

**Por que no host e não em Edge Function:** o whisper roda em CPU e leva de
dezenas de segundos a minutos por Echo, enquanto o Kong corta qualquer
requisição em 60 s.

Fila e decisões à mão:

```bash
# o que está preso na fila
docker exec $(docker ps -q -f 'name=^/supabase_db\.') psql -h 127.0.0.1 -U supabase_admin -d postgres \
  -c "select id, moderation_status, moderation_attempts, moderation_note from public.audio_posts where moderation_status in ('pending','review_required');"

# rodar o worker fora do cron
/usr/local/lib/shhhh/moderate-pending-echoes.sh
```

A decisão humana passa pela Edge Function `moderate-echo` (exige papel `admin`
ou `moderator` em `user_roles`) e grava `moderation_source = 'human'`.

## 5.2 Feature flags

`public.feature_flags` é lida pelo front (`useFeatureFlags`) **e** pelo banco
(`public.feature_enabled`, usada nas políticas de RLS e nas RPCs de
Communities). Ligar/desligar uma área é um `UPDATE`, sem migração nem build:

```sql
update public.feature_flags set enabled = true, updated_at = now() where key = 'COMMUNITIES_ENABLED';
```

`COMMUNITIES_ENABLED` está **desligada**: o contêiner existe antes do
comportamento (publicar Echo dentro da Community ainda não existe). Com ela
desligada, a rota some da navegação, o roteador redireciona e as RPCs não
devolvem nada — o gate vale nos três níveis.

## 5.3 Correções de infraestrutura necessárias uma única vez

Encontradas ao executar este runbook em 2026-08-22; já aplicadas em produção.

```bash
# Storage falhava em todo upload com 500 porque o serviço apontava para o alias
# ambíguo `db` (que resolve para cortex_db na rede Nutef).
scripts/deploy/fix-storage-db-host.sh
```

Configuração do GoTrue (`supabase_auth`), necessária para o cadastro do app
funcionar — a instância vinha com registro público desligado e sem SMTP:

```bash
docker service update \
  --env-add GOTRUE_DISABLE_SIGNUP=false \
  --env-add GOTRUE_MAILER_AUTOCONFIRM=true \
  --env-add GOTRUE_SITE_URL=https://shhhh.me \
  --env-add 'GOTRUE_URI_ALLOW_LIST=https://shhhh.me,https://shhhh.me/*,https://www.shhhh.me,https://www.shhhh.me/*,http://localhost:5173,http://localhost:5173/*' \
  supabase_auth
```

`GOTRUE_MAILER_AUTOCONFIRM=true` acompanha `enable_confirmations = false` do
`supabase/config.toml`: sem SMTP configurado, exigir confirmação por e-mail
deixaria toda conta nova sem conseguir entrar.

## 6. Front-end

O cliente lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (veja
`.env.production.example`). A chave é a **publishable/anon** — qualquer valor em
`VITE_*` vai para o bundle público; service-role/secret nunca entram aqui.

**Não existe mais endereço embutido no código.** Antes, um build sem `.env`
apontava calado para a instalação de produção — inclusive um build de teste. Se
faltar variável, `vite build` para com a mensagem em vez de gerar bundle. Em
`npm run dev` o aviso aparece no terminal; sem as variáveis o app abre em
branco, porque o cliente Supabase falha ao carregar. Os testes (`vitest`) e o
e2e (`playwright`) trazem o próprio ambiente fictício, então nunca falam com a
instalação real.

```bash
cp .env.production.example .env.production   # e preencha os valores
npm ci
npm run typecheck && npm run lint && npm test && npm run build
```

Publicação na VPS (stack `shhhh-site`, nginx atrás do Traefik):

```bash
rsync -a --delete dist/ /root/shhhh-site/public/
docker stack deploy -c /root/shhhh-site.yaml shhhh-site
```

As cópias versionadas do stack e do nginx estão em `deploy/shhhh-site.yaml` e
`deploy/nginx.conf`; na VPS elas vivem em `/root/shhhh-site.yaml` e
`/root/shhhh-site/nginx.conf`.

O `nginx.conf` faz fallback de SPA (`/app/echoes`, `/e/:id`, `/v/:handle` caem
no `index.html`) e cacheia `/assets/` por um ano — os nomes têm hash.
O roteador do Traefik responde por `shhhh.me` e `www.shhhh.me`; o certificado
Let's Encrypt só é emitido depois que o DNS do domínio apontar para a VPS.

## 7. Smoke tests

```bash
scripts/deploy/04-smoke-test.sh
scripts/deploy/05-verificacao-funcional.sh
```

Cobre o que dá para verificar sem sessão: roteamento de Functions, leitura
pública de `categories`, recusa de `discovery-feed`/`moderate-echo` sem sessão,
recusa do cleanup com chave anon e execução do cleanup com a chave correta.
`05-verificacao-funcional.sh` vai além: cria uma conta descartável, publica um
Echo anônimo e um Echo com Voice, confere que o payload público não expõe
identidade nem identificador de conta, valida `/e/:id` e `/v/:handle`, força a
expiração de um Echo e confirma que a mídia sumiu do Storage — removendo tudo
ao final. Desde 2026-08-23 ele também prova as correções de autorização: o Echo
nasce `pending` e invisível, a transcrição do navegador fica isolada em
`client_transcription`, `PATCH`/`DELETE` diretos em `audio_posts` são recusados,
`community_members` recusa papel `creator`, o classificador separa
aprovado/humano/rejeitado, o worker processa a fila e o `exclude` do
`discovery-feed` é respeitado. Continuam manuais: onboarding, Protect My Voice,
comunidades e o fluxo de denúncia/bloqueio pela interface.

## 8. Rollback

```bash
# Functions anteriores
tar -C /root/supabase/docker/volumes -xzf "$BACKUP_DIR/functions-pre-hush2-<stamp>.tgz"
docker service update --force supabase_functions

# Banco: destrutivo, somente em manutenção aprovada
# docker exec -i $(docker ps -q -f 'name=^/supabase_db\.') \
#   pg_restore -U postgres -d postgres --clean --if-exists < "$BACKUP_DIR/shhhh-pre-hush2-<stamp>.dump"
```

## Observação sobre o alias `db`

Na rede overlay `Nutef` o hostname `db` é ambíguo (`cortex_db` usa o mesmo
alias). Serviços do Supabase que ainda apontam para `db` podem falhar em um
restart futuro com `password authentication failed`. Ao mexer na stack, prefira
`supabase_db`. Isso não afeta os scripts acima, que falam com o container
diretamente via `docker exec`.
