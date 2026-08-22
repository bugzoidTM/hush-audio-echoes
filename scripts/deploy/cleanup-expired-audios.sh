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

curl --fail --silent --show-error --retry 2 \
  -X POST "${PUBLIC_SUPABASE_URL}/functions/v1/cleanup-expired-audios" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H 'Content-Type: application/json'
echo
