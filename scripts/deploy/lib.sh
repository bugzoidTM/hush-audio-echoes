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
db_psql() {
  docker exec -i "$(service_container db)" psql -U postgres -d postgres "$@"
}

# Reinicia um serviço do stack. Em Swarm, --force recria a tarefa e recarrega
# o código montado por bind; mudanças de variável exigem --env-add antes.
restart_service() {
  local service="$1"
  log "recriando ${SUPABASE_STACK}_${service}"
  docker service update --force --quiet "${SUPABASE_STACK}_${service}" >/dev/null
}

# Lê uma variável de ambiente já configurada em um serviço do stack.
service_env() {
  local service="$1" key="$2"
  docker service inspect "${SUPABASE_STACK}_${service}" \
    --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' \
    | sed -n "s/^${key}=//p" | head -n1
}
