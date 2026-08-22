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
```

Aplica `supabase/migrations/20260821190000_shhhh_echoes_voices_communities.sql`
com `ON_ERROR_STOP=1` (a migração é transacional) e confere tabelas, funções
RPC, categorias e o bucket `echo-audio`. **Não prossiga se a verificação falhar.**

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
| `publish-echo`, `discovery-feed`, `generate-echo-hook`, `transcribe-audio` | sessão de usuário |
| `moderate-echo` | usuário com papel administrativo |
| `cleanup-expired-audios` | somente a chave server-side (service role) |

Cada Function revalida a sessão internamente, então o gate do roteador
(`VERIFY_JWT`) é defesa em profundidade, não a única barreira.

## 5. Expiração periódica de mídia

```bash
sudo install -d -m 700 /usr/local/lib/shhhh
sudo install -m 700 scripts/deploy/cleanup-expired-audios.sh /usr/local/lib/shhhh/
sudo /usr/local/lib/shhhh/cleanup-expired-audios.sh
sudo crontab -l | { cat; echo '*/15 * * * * /usr/local/lib/shhhh/cleanup-expired-audios.sh >> /var/log/shhhh-cleanup.log 2>&1'; } | sudo crontab -
```

O script lê a chave server-side do próprio serviço do Swarm, em memória; o
crontab não contém credencial alguma.

## 5.1 Correções de infraestrutura necessárias uma única vez

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
ao final. Continuam manuais: onboarding, Protect My Voice, comunidades e o
fluxo de denúncia/bloqueio pela interface.

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
