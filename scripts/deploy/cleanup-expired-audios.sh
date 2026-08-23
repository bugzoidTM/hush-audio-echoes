#!/usr/bin/env bash
# Passo 6 do runbook: expiração periódica de mídia (rodar a cada 15 minutos).
#
# A chave server-side é lida em memória a partir do serviço do Swarm; ela não
# é gravada no crontab, no log nem em nenhum arquivo deste repositório.
set -euo pipefail

SUPABASE_STACK="${SUPABASE_STACK:-supabase}"
PUBLIC_SUPABASE_URL="${PUBLIC_SUPABASE_URL:-https://supabase.nutef.com}"

SERVICE_ROLE_KEY="$(docker service inspect "${SUPABASE_STACK}_functions" \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' \
  | sed -n 's/^SUPABASE_SERVICE_ROLE_KEY=//p' | head -n1)"

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "SUPABASE_SERVICE_ROLE_KEY não encontrada no serviço ${SUPABASE_STACK}_functions" >&2
  exit 1
fi

TELEGRAM_TOKEN_FILE="${SHHHH_TELEGRAM_TOKEN_FILE:-/root/.shhhh-telegram-token}"
TELEGRAM_CHAT_ID="${SHHHH_TELEGRAM_CHAT_ID:-1610680538}"

notify() {
  local mensagem="$1" token
  [ -f "$TELEGRAM_TOKEN_FILE" ] || return 0
  token="$(tr -d '\r\n' < "$TELEGRAM_TOKEN_FILE")"
  [ -n "$token" ] || return 0
  curl -s -X POST "https://api.telegram.org/bot${token}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" --data-urlencode "text=${mensagem}" >/dev/null || true
}

db_psql() {
  docker exec -i "$(docker ps -q --filter "name=^/${SUPABASE_STACK}_db\." | head -n1)" \
    psql -h 127.0.0.1 -U "${SUPABASE_DB_ADMIN:-supabase_admin}" -d postgres -tAq "$@"
}

curl --fail --silent --show-error --retry 2 \
  -X POST "${PUBLIC_SUPABASE_URL}/functions/v1/cleanup-expired-audios" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H 'Content-Type: application/json'
echo

# Vigilância cruzada: este job (15 min) é quem percebe se o worker de moderação
# (2 min) morreu. Sem isso, a morte dele seria silenciosa e todo Echo novo
# ficaria invisível para sempre — o pior modo de falha deste sistema.
db_psql -c "SELECT public.record_worker_heartbeat('limpeza');" >/dev/null

parados="$(db_psql -F' ' -c "SELECT name, minutos_parado FROM public.stale_workers() WHERE name <> 'limpeza';")"
if [ -n "$parados" ]; then
  echo "ALERTA: worker parado -> ${parados}" >&2
  notify "shhhh: worker de moderação parado (${parados} min). Nenhum Echo novo sai de 'pending' até voltar. Conferir /usr/local/lib/shhhh e /var/log/shhhh-moderation.log."
fi
