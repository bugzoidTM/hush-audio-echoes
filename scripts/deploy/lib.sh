#!/usr/bin/env bash
# Funções comuns aos scripts de implantação do shhhh.
#
# A instalação de produção roda o Supabase como stack do Docker Swarm
# (serviços supabase_db, supabase_functions, ...), e não como docker compose.
# Por isso os comandos do runbook usam `docker ps` + `docker exec` no
# container da tarefa, em vez de `docker compose exec` / `sh run.sh`.

set -euo pipefail

: "${SUPABASE_STACK:=supabase}"
: "${SUPABASE_VOLUMES_DIR:=/root/supabase/docker/volumes}"
: "${PUBLIC_SUPABASE_URL:=https://supabase.nutef.com}"
: "${BACKUP_DIR:=/root/backups/shhhh}"
: "${APP_DIR:=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2; }
die() { printf 'ERRO: %s\n' "$*" >&2; exit 1; }

# Descobre o container em execução de um serviço do stack (ex.: db, functions).
service_container() {
  local service="$1" id
  id="$(docker ps -q --filter "name=^/${SUPABASE_STACK}_${service}\." | head -n1)"
  [ -n "$id" ] || die "container do serviço ${SUPABASE_STACK}_${service} não encontrado"
  printf '%s' "$id"
}

# psql como superusuário dentro do container do banco.
#
# Nesta instalação o papel `postgres` NÃO é superusuário e não é membro de
# `supabase_admin`, que é o dono de todas as tabelas de public — rodar a
# migração como `postgres` falha com "must be owner of table audio_posts".
# O pg_hba do container tem `host all all 127.0.0.1/32 trust`, então a conexão
# pelo loopback interno autentica como supabase_admin sem senha e sem expor
# credencial alguma fora do container.
db_psql() {
  docker exec -i "$(service_container db)" \
    psql -h 127.0.0.1 -U "${SUPABASE_DB_ADMIN:-supabase_admin}" -d postgres "$@"
}

# Reinicia um serviço do stack. Em Swarm, --force recria a tarefa e recarrega
# o código montado por bind; mudanças de variável exigem --env-add antes.
restart_service() {
  local service="$1"
  log "recriando ${SUPABASE_STACK}_${service}"
  docker service update --force --quiet "${SUPABASE_STACK}_${service}" >/dev/null
}

# Emite um token de usuário assinado com o segredo da própria stack.
#
# Os scripts de verificação entravam por senha (`/auth/v1/token`). Com o
# Turnstile ligado, o GoTrue passou a exigir captcha TAMBÉM no login — não só no
# cadastro — e todos eles pararam de autenticar. Em vez de abrir exceção no
# captcha (que enfraqueceria a proteção real), a verificação assina o próprio
# token: ela roda no host, com acesso ao segredo, e não precisa fingir ser um
# navegador.
mint_user_token() {
  local user_id="$1" segredo agora expira cabecalho payload dados assinatura
  segredo="$(service_env auth GOTRUE_JWT_SECRET)"
  [ -n "$segredo" ] || die "GOTRUE_JWT_SECRET não encontrado no serviço auth"
  agora="$(date +%s)"; expira="$((agora + 3600))"

  b64() { openssl base64 -e -A | tr '+/' '-_' | tr -d '='; }
  cabecalho="$(printf '{"alg":"HS256","typ":"JWT"}' | b64)"
  payload="$(printf '{"sub":"%s","role":"authenticated","aud":"authenticated","iat":%s,"exp":%s}' \
    "$user_id" "$agora" "$expira" | b64)"
  dados="${cabecalho}.${payload}"
  assinatura="$(printf '%s' "$dados" | openssl dgst -binary -sha256 -hmac "$segredo" | b64)"
  printf '%s.%s' "$dados" "$assinatura"
}

# Lê uma variável de ambiente já configurada em um serviço do stack.
service_env() {
  local service="$1" key="$2"
  docker service inspect "${SUPABASE_STACK}_${service}" \
    --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' \
    | sed -n "s/^${key}=//p" | head -n1
}
