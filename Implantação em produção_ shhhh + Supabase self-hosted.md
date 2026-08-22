# Implantação em produção: shhhh + Supabase self-hosted

> **Nota de execução (2026-08-22):** a instalação de produção roda o Supabase como stack do
> **Docker Swarm**, não como projeto `docker compose`. Os comandos `docker compose …` e
> `sh run.sh …` deste documento não se aplicam como estão. A versão executável, com os
> comandos traduzidos e os scripts correspondentes, está em
> [`docs/RUNBOOK-PRODUCAO-SWARM.md`](docs/RUNBOOK-PRODUCAO-SWARM.md).

> **Escopo:** este procedimento aplica o commit `626bbd3` da branch `feat/hush-2-pivot` em uma instalação Supabase self-hosted acessível em `https://supabase.nutef.com`. Ele cria o núcleo de **Echoes, Voices e Communities**, publica as Edge Functions correspondentes e habilita a expiração segura de mídia.

A instalação Docker do Supabase carrega Edge Functions a partir de `volumes/functions/<nome>/index.ts`; mudanças de código exigem reinício do serviço `functions`, enquanto alterações de variáveis exigem recriação do container. O procedimento abaixo segue esse fluxo oficial. [1] [2]

## 1. Janela de implantação e pré-requisitos

Aplique em uma janela de baixa utilização. O processo contém mudanças aditivas de esquema, funções SQL e políticas RLS; embora a migração seja transacional quando executada com `ON_ERROR_STOP`, deve existir um backup restaurável antes de qualquer alteração.

| Item | Requisito |
|---|---|
| Servidor | Acesso SSH com `sudo`, Docker Engine e Docker Compose instalados. |
| Stack | Diretório do Supabase self-hosted com `docker-compose.yml`, `run.sh`, `.env` e `volumes/functions/`. |
| Código | Checkout da branch `feat/hush-2-pivot` do repositório `bugzoidTM/hush-audio-echoes`. |
| Banco | Acesso ao serviço/container `db` e permissão para executar `psql` como administrador. |
| Segredo externo | `OPENAI_API_KEY` válida para `transcribe-audio` e `generate-echo-hook`. Não a registre em Git, shell history ou tickets. |
| Front-end | Processo de build/deploy atual da aplicação web, com as variáveis Vite de produção apontando para `https://supabase.nutef.com`. |

> **Não use `sh reset.sh`, `docker compose down -v` ou qualquer comando que remova volumes.** Esses comandos podem destruir dados e não fazem parte deste runbook.

Defina os caminhos uma vez, substituindo somente os valores entre `<…>`:

```bash
export APP_DIR="/opt/shhhh/app"                 # checkout do repositório
export SUPABASE_DIR="/opt/shhhh/supabase"       # diretório com docker-compose.yml e run.sh
export BACKUP_DIR="/opt/shhhh/backups"
export PUBLIC_SUPABASE_URL="https://supabase.nutef.com"
mkdir -p "$BACKUP_DIR"
```

## 2. Atualizar o checkout e conferir o estado

No host da aplicação ou no host de administração, obtenha a branch publicada. Não use `main` para esta implantação.

```bash
cd "$APP_DIR"
git fetch origin
git checkout feat/hush-2-pivot
git pull --ff-only origin feat/hush-2-pivot
git rev-parse --short HEAD     # esperado: 626bbd3 ou commit posterior aprovado
git status --short
```

Confirme que a stack está saudável antes de seguir:

```bash
cd "$SUPABASE_DIR"
docker compose ps
sh run.sh logs functions
```

Todos os containers necessários devem estar `Up` e saudáveis. O Supabase recomenda iniciar e inspecionar a stack pelo wrapper `run.sh`/Docker Compose. [2]

## 3. Backup verificável do banco e das Functions

Crie um dump customizado do PostgreSQL e um arquivo das Functions atualmente instaladas. O nome de usuário e o banco podem diferir no seu compose; se necessário, confira `docker compose config --services` e os valores do `.env` antes de executar.

```bash
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
cd "$SUPABASE_DIR"

docker compose exec -T db pg_dump -U postgres -d postgres -Fc \
  > "$BACKUP_DIR/shhhh-pre-hush2-$STAMP.dump"
tar -C volumes -czf "$BACKUP_DIR/functions-pre-hush2-$STAMP.tgz" functions

pg_restore --list "$BACKUP_DIR/shhhh-pre-hush2-$STAMP.dump" >/dev/null
tar -tzf "$BACKUP_DIR/functions-pre-hush2-$STAMP.tgz" >/dev/null
ls -lh "$BACKUP_DIR"/*"$STAMP"*
```

Somente continue se `pg_restore --list` e `tar -tzf` retornarem sucesso. Mantenha ambos os arquivos fora do volume da aplicação ou copie-os para o armazenamento de backup habitual.

## 4. Aplicar a migração de banco

A migração é `supabase/migrations/20260821190000_shhhh_echoes_voices_communities.sql`. Ela cria tabelas e políticas para Voices, Communities, reações, follows, reports, bloqueios, analytics e onboarding; adiciona funções RPC públicas seguras; restringe `audio_posts`; e configura gatilhos de notificação.

Antes de aplicar, confira se a conexão está direcionada ao banco correto:

```bash
cd "$SUPABASE_DIR"
docker compose exec -T db psql -U postgres -d postgres -c "select current_database(), current_user, now();"
```

Aplique com parada imediata ao primeiro erro. O `BEGIN`/`COMMIT` existente na migração mantém a alteração atômica quando todos os comandos são aceitos pelo PostgreSQL 15.

```bash
cd "$SUPABASE_DIR"
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$APP_DIR/supabase/migrations/20260821190000_shhhh_echoes_voices_communities.sql"
```

Verifique os objetos essenciais após a conclusão:

```bash
docker compose exec -T db psql -U postgres -d postgres <<'SQL'
select to_regclass('public.voices') as voices,
       to_regclass('public.communities') as communities,
       to_regclass('public.echo_reactions') as echo_reactions,
       to_regclass('public.analytics_events') as analytics_events;
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('get_discovery_feed', 'get_public_echo', 'get_public_voice', 'get_my_voices_feed');
select count(*) as categories from public.categories;
SQL
```

O resultado deve mostrar as quatro tabelas, as quatro funções e pelo menos uma categoria. **Não prossiga para o front-end se essa verificação falhar.**

## 5. Instalar e configurar as Edge Functions

As Functions entregues são as seguintes:

| Function | Finalidade | Autorização esperada |
|---|---|---|
| `publish-echo` | Publicação validada, caminho opaco de Storage, rollback de mídia e moderação inicial. | Sessão de usuário. |
| `discovery-feed` | Feed paginado somente com payload público seguro. | Sessão de usuário. |
| `moderate-echo` | Revisão de moderação. | Usuário com papel administrativo. |
| `generate-echo-hook` | Sugestão opcional de chamada a partir da transcrição. | Sessão de usuário + `OPENAI_API_KEY`. |
| `transcribe-audio` | Transcrição do áudio final; com Protect My Voice ativo, a aplicação envia o áudio transformado. | Sessão de usuário + `OPENAI_API_KEY`. |
| `cleanup-expired-audios` | Expiração e remoção de Storage exclusivamente pelo `storage_path` opaco. | Chamada administrativa agendada. |

Copie apenas os diretórios de Functions do checkout para o volume montado pelo serviço. A documentação oficial para self-hosted orienta copiar os diretórios para `volumes/functions/` e reiniciar `functions`. [1]

```bash
cd "$SUPABASE_DIR"
for fn in publish-echo discovery-feed moderate-echo generate-echo-hook transcribe-audio cleanup-expired-audios; do
  install -d "volumes/functions/$fn"
  rsync -a --delete "$APP_DIR/supabase/functions/$fn/" "volumes/functions/$fn/"
done

find volumes/functions -maxdepth 2 -name index.ts -print | sort
```

### 5.1 Configurar `OPENAI_API_KEY` sem expor o valor

A documentação oficial recomenda um arquivo de ambiente separado para Functions e informa que ele não deve ser versionado. [1]

```bash
cd "$SUPABASE_DIR"
umask 077
cat > .env.functions <<'EOF'
OPENAI_API_KEY=<COLE_A_CHAVE_REAL_AQUI>
EOF
chmod 600 .env.functions
```

No `docker-compose.yml`, acrescente ao serviço `functions` — preserve as variáveis existentes:

```yaml
services:
  functions:
    env_file:
      - .env.functions
```

Não insira a chave no repositório, no `.env` do front-end, em comandos `curl` ou no cron. Após mudar `env_file`/segredos, recrie o container — reiniciar não basta para carregar novas variáveis. [1] [2]

```bash
cd "$SUPABASE_DIR"
sh run.sh recreate functions
sh run.sh logs functions
```

Se não houve alteração de segredo, use apenas `sh run.sh restart functions` após atualizar o código. [1]

### 5.2 Conferir configuração de JWT

Mantenha a verificação de JWT do serviço `functions` habilitada. As Functions de usuário exigem um `Authorization: Bearer <access_token>` válido e validam a sessão novamente. Para a rotina administrativa, use somente a chave secreta/service-role no servidor, nunca no navegador.

```bash
cd "$SUPABASE_DIR"
grep -E '^FUNCTIONS_VERIFY_JWT=' .env
sh run.sh printenv functions | grep -E 'SUPABASE_(URL|PUBLIC_URL)|FUNCTIONS_VERIFY_JWT'
```

## 6. Configurar a expiração periódica de mídia

`cleanup-expired-audios` remove arquivos pelo `storage_path` persistido e só então marca o Echo como expirado. Execute a cada 15 minutos como usuário administrativo. Crie um script protegido; ele lê a chave da stack apenas em memória e não a grava no crontab.

```bash
sudo install -d -m 700 /usr/local/lib/shhhh
sudo tee /usr/local/lib/shhhh/cleanup-expired-audios.sh >/dev/null <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

# Ajuste estes dois valores uma única vez para os caminhos reais da VPS.
SUPABASE_DIR="/opt/shhhh/supabase"
PUBLIC_SUPABASE_URL="https://supabase.nutef.com"

set -a
source "${SUPABASE_DIR}/.env"
set +a

: "${SERVICE_ROLE_KEY:?SERVICE_ROLE_KEY ausente no .env da stack}"
curl --fail --silent --show-error --retry 2 \
  -X POST "${PUBLIC_SUPABASE_URL}/functions/v1/cleanup-expired-audios" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H 'Content-Type: application/json'
SCRIPT
sudo chmod 700 /usr/local/lib/shhhh/cleanup-expired-audios.sh
sudo /usr/local/lib/shhhh/cleanup-expired-audios.sh
```

> Algumas instalações recentes usam uma chave secreta com outro nome. Se o `.env` não possuir `SERVICE_ROLE_KEY`, adapte o script para a variável server-side equivalente existente, por exemplo `SUPABASE_SECRET_KEY`. Nunca use uma chave publishable/anon para essa rotina.

Programe o cron como `root`; a linha não contém credenciais:

```bash
sudo crontab -e
# Adicione:
*/15 * * * * /usr/local/lib/shhhh/cleanup-expired-audios.sh >> /var/log/shhhh-cleanup.log 2>&1
```

## 7. Construir e publicar o front-end

No diretório da aplicação, ajuste o arquivo de ambiente de produção de acordo com o processo existente. A URL deve permanecer `https://supabase.nutef.com`; a chave client-side deve ser a **publishable/anon**, jamais service-role/secret.

```bash
cd "$APP_DIR"
# Confira sem imprimir valores sensíveis:
grep -E '^VITE_SUPABASE_URL=' .env.production
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Publique o conteúdo de `dist/` no mecanismo atual do site (Nginx, container, objeto estático ou CI/CD). O detalhe depende da arquitetura de front-end já em uso; não sobrescreva arquivos de configuração do reverse proxy sem backup.

## 8. Smoke tests pós-implantação

Execute os testes abaixo com uma conta de teste e uma Voice de teste; não use uma conta administrativa pessoal.

| Fluxo | Resultado esperado |
|---|---|
| Landing e login | A marca exibida é **shhhh** e o login leva a `/app/echoes`. |
| Onboarding | Primeira sessão recebe seleção de interesses e criação opcional de Voice. |
| Echo anônimo | Feed e URL `/e/:id` mostram somente `Anônimo`; não exibem handle, avatar, owner ou identificador de conta. |
| Echo com Voice | Perfil `/v/:handle`, follow e My Voices funcionam. |
| Protect My Voice | Preview é reproduzível; se a transformação falhar, publicar permanece bloqueado e o áudio original não é enviado. |
| Comunidade | Community gratuita pode ser criada/aberta e seu contexto de Voice aparece corretamente. |
| Segurança | Denúncia, bloqueio e moderação retornam resposta autorizada; usuário comum não acessa `moderate-echo`. |
| Expiração | A chamada manual do cleanup retorna sucesso; use um Echo de teste com expiração curta para validar remoção de mídia. |

Validação de saúde do serviço Functions:

```bash
curl --fail --silent --show-error \
  -H "apikey: <CHAVE_PUBLISHABLE>" \
  "$PUBLIC_SUPABASE_URL/functions/v1/hello"

cd "$SUPABASE_DIR"
sh run.sh logs functions
```

O exemplo `hello` vem pré-configurado no pacote self-hosted e é a forma mais simples de confirmar o roteamento de Functions antes dos fluxos autenticados. [1]

## 9. Recuperação e rollback

Se a migração falhar, o `psql -v ON_ERROR_STOP=1` deve interromper a operação e a transação não deve ser consolidada. Não execute uma segunda vez sem primeiro corrigir a causa e revisar os logs.

Se for necessário reverter após o `COMMIT`, coloque o front-end anterior no ar, restaure os diretórios de Functions a partir do `functions-pre-hush2-<timestamp>.tgz` e reinicie `functions`. A restauração integral do banco a partir do dump é uma operação destrutiva e deve ocorrer somente em manutenção aprovada, porque substitui modificações posteriores ao backup.

```bash
# Exemplo somente para manutenção aprovada: restaura as Functions anteriores.
cd "$SUPABASE_DIR"
tar -C volumes -xzf "$BACKUP_DIR/functions-pre-hush2-<timestamp>.tgz"
sh run.sh restart functions

# Restaurar banco deve ser realizado somente após validar impacto e indisponibilidade:
# docker compose exec -T db pg_restore -U postgres -d postgres --clean --if-exists < "$BACKUP_DIR/shhhh-pre-hush2-<timestamp>.dump"
```

## Referências

[1]: https://supabase.com/docs/guides/self-hosting/self-hosted-functions "Supabase Docs — Self-Hosted Functions"
[2]: https://supabase.com/docs/guides/self-hosting/docker "Supabase Docs — Self-Hosting with Docker"
[3]: https://supabase.com/docs/guides/functions/deploy "Supabase Docs — Deploy to Production"
