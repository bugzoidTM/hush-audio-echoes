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

A decisão humana é tomada no painel de Trust & Safety (§5.1.1) e grava
`moderation_source = 'human'`. A Edge Function `moderate-echo` continua
disponível para automação, com a mesma exigência de papel.

## 5.1.1 Painel de Trust & Safety (`/admin`)

A tela em `https://shhhh.me/admin` é a outra metade da moderação: sem ela, tudo
que o worker manda para `review_required` fica invisível para sempre. Exige
papel `admin` ou `moderator` em `public.user_roles` — a checagem é do banco
(`public.is_moderator()`), refeita dentro de cada RPC; a tela só deixa de
renderizar.

Dar papel a alguém:

```sql
insert into public.user_roles (user_id, role)
select id, 'moderator' from auth.users where email = 'pessoa@exemplo.com'
on conflict do nothing;
```

O painel mostra a fila (revisão humana, presos em análise há 30+ min, e Echoes
denunciados), com player, **transcrição do servidor** e o texto enviado pelo
cliente escondido e rotulado como não confiável — útil para ver quem tentou
enganar a moderação. Ações, todas com nota que fica no registro:

| Ação | Efeito |
| --- | --- |
| Aprovar | volta ao Discovery; denúncias abertas viram `dismissed` |
| Limitar alcance | sai do Discovery, **link direto continua valendo** |
| Rejeitar | sai do ar (`status='deleted'`) e a mídia expira na limpeza seguinte |
| Suspender Voice | `voices.status='suspended'`; os Echoes dela somem do feed na hora |
| Suspender conta | bloqueia o login no GoTrue e manda o conteúdo para `review_required` |

Suspender conta é a única ação que passa por Edge Function (`suspend-account`):
bloquear login exige a `service_role`, que nunca pode chegar ao navegador. Duas
travas: ninguém suspende a própria conta, e conta com papel de moderação não é
suspensa pelo painel. Reativar devolve o login, mas **não republica em massa** —
cada Echo volta pela fila.

Verificação ponta a ponta (cria duas contas descartáveis e apaga tudo):

```bash
scripts/deploy/07-verificacao-moderacao.sh
```

## 5.1.2 Limites de gravação

| Limite | Onde é aplicado |
| --- | --- |
| 5 a 60 segundos | gravador corta sozinho (com contagem regressiva na tela) e `publish-echo` recusa duração declarada fora da faixa |
| 3 MB por arquivo | `publish-echo` (60 s cabem com folga; até WAV 16 kHz mono dá ~1,9 MB) |
| **duração real** | worker de moderação, com `ffprobe`, **antes de transcrever** |

A duração que chega em `publish-echo` é **declarada pelo cliente**. Um cliente
modificado enviava 30 minutos dizendo 30 segundos: o arquivo passava e o whisper
em CPU ficava meia hora mastigando — negação de serviço barata. Por isso o
worker mede o áudio publicado antes de gastar transcrição; acima do limite, o
Echo vai para `review_required` com a duração real registrada em
`moderation_note`, sem consumir CPU, e o dono é avisado no Telegram.

Regressão coberta por `scripts/deploy/05-verificacao-funcional.sh`: arquivo
acima do teto recusado, durações declaradas inválidas recusadas (0, 4, 61, 3600,
texto) e áudio de 30 min resolvido pelo worker em ~1 s, fora do Discovery.

Para mudar os limites: `DISCOVERY_DURATION` em
`src/features/echoes/services/discoveryPolicy.ts` (front, incluindo o corte da
gravação), as constantes no topo de `supabase/functions/publish-echo/index.ts`
e `SHHHH_MAX_DURATION_SECONDS` no worker — os três precisam concordar.

## 5.1.3 O que é público e o que exige conta

| | Sem conta | Com conta |
| --- | --- | --- |
| Echo por link (`/e/:id`) | ✅ ouve inteiro | ✅ |
| Prévia (`/ouvir`) | ✅ até 3 Echoes | — (redireciona ao Discovery) |
| Página da Voice (`/v/:handle`) | ✅ ouve | ✅ |
| Discovery infinito | ❌ `get_discovery_feed` negado ao `anon` | ✅ |
| Reagir, responder, denunciar, seguir, publicar | ❌ vira convite de cadastro | ✅ |

A decisão de produto é **provar o valor antes de pedir compromisso**: o Echo
compartilhado é o principal canal de aquisição, e um muro de cadastro na frente
dele faz a pessoa fechar a aba.

O gate está no **servidor**, não na tela. Isso importa porque a chave `anon` vai
dentro do bundle: até 2026-08-24 o `anon` tinha EXECUTE em `get_discovery_feed`,
e o 401 da Edge Function não impedia nada — bastava chamar a RPC direto no
PostgREST para ter o feed inteiro sem conta.

A prévia (`get_public_preview_feed`) é deliberadamente pequena: no máximo 3 por
chamada, sem ranking personalizado, servida só a partir dos 30 Echoes mais
recentes, para não virar porta de varredura do catálogo. O contador de 3 vive no
`localStorage` e é funil, não fronteira — o bucket `echo-audio` é público por
decisão de produto, então quem insistir ouve mais. Trancar exigiria bucket
privado com URL assinada, o que quebraria justamente o compartilhamento.

**Público ≠ indexado.** O nginx serve `X-Robots-Tag` pela URL pedida (um `map`,
porque numa SPA o `try_files` manda tudo para `index.html` e um `add_header` em
location específica se perderia no caminho):

| Rota | Cabeçalho |
| --- | --- |
| `/e/:id` | `noindex, noarchive, nosnippet` — desabafo não fica arquivado em buscador |
| `/app/`, `/admin`, `/auth` | `noindex, nofollow` |
| `/`, `/ouvir`, `/v/:handle` | nenhum (indexável) |

A página da Voice é pseudônima e indexável só se o dono ligar
`voices.indexable` (Configurações → "Aparecer fora do shhhh"); o padrão é
desligado, e a meta tag da SPA reflete a escolha.

## 5.1.4 Card social por Echo

O compartilhamento é o canal de aquisição, e todo link colado no WhatsApp
mostrava o card genérico do site. Agora o nginx desvia **apenas rastreadores**
(WhatsApp, Telegram, Twitter/X, Facebook, Discord, Slack, LinkedIn e outros)
para a Edge Function `echo-share`, que devolve HTML só com Open Graph; pessoas
continuam recebendo a SPA na mesma URL.

O card leva **somente o título aprovado pela moderação**, a categoria e a
duração — nunca a transcrição nem a descrição livre. Um card vaza para grupos
inteiros e fica em cache de terceiros.

Detalhe de nginx que custou um 502: com variável no `proxy_pass` o nome é
resolvido a cada requisição, e sem `resolver 127.0.0.11` o nginx recusa antes de
tentar. Se o Kong estiver fora, `proxy_intercept_errors` devolve a SPA em vez de
um erro.

```bash
curl -A "WhatsApp/2.23" https://shhhh.me/e/<id> | grep og:title
```

## 5.1.5 Vigilância dos workers

Cada worker registra batimento em `public.worker_heartbeats` e **confere o do
outro**: moderação roda a cada 2 min, limpeza a cada 15, e a morte de um é
percebida pelo outro, com aviso no Telegram. O painel `/admin` mostra o estado
dos dois. Sem isso, worker morto = todo Echo novo invisível para sempre, em
silêncio.

```sql
select * from public.worker_heartbeats;
select * from public.stale_workers();   -- vazio = tudo vivo
```

## 5.1.6 Direitos do titular e mídia órfã

`Configurações → Baixar meus dados` (RPC `export_my_data`) e
`Configurações → Excluir minha conta` (Edge Function `delete-account`, com
reconfirmação de senha). Verificação: `scripts/deploy/09-verificacao-direitos.sh`.

**Armadilha que isso revelou:** `audio_posts.owner_user_id` referencia
`auth.users` com `ON DELETE CASCADE`. Apagar a conta pelo painel do GoTrue ou
pela API de admin faz as linhas sumirem levando junto o `storage_path` — e os
arquivos ficam no bucket para sempre, sem registro que os encontre e com a URL
pública respondendo. Auditoria em 2026-08-24 encontrou **34 objetos** assim.

Duas defesas: `delete-account` apaga a mídia **antes** da conta, e o cron de
limpeza faz uma segunda passada removendo órfãos com mais de 1 hora (a folga
evita apagar um upload que ainda está entre o arquivo e a linha).

```sql
select count(*) from public.list_orphan_media(60);
```

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
