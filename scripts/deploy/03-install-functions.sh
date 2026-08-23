#!/usr/bin/env bash
# Passo 5 do runbook: publica as Edge Functions no volume do edge-runtime.
#
# Para configurar a OPENAI_API_KEY sem deixá-la no Git nem no histórico do
# shell, grave-a em /root/.shhhh-openai-key (chmod 600) e rode:
#   OPENAI_KEY_FILE=/root/.shhhh-openai-key scripts/deploy/03-install-functions.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# `main` é o roteador do edge-runtime (vem no pacote self-hosted); a cópia
# versionada aqui sobe os limites de memória e de tempo do worker, que os
# padrões deixam baixos demais para a transcrição.
FUNCTIONS=(main publish-echo discovery-feed echo-share contato moderate-echo suspend-account delete-account generate-echo-hook transcribe-audio cleanup-expired-audios)
TARGET="$SUPABASE_VOLUMES_DIR/functions"
[ -d "$TARGET" ] || die "diretório de functions não encontrado: $TARGET"

for fn in "${FUNCTIONS[@]}"; do
  src="$APP_DIR/supabase/functions/$fn"
  [ -d "$src" ] || die "function ausente no checkout: $src"
  install -d "$TARGET/$fn"
  rsync -a --delete "$src/" "$TARGET/$fn/"
  log "instalada: $fn"
done

find "$TARGET" -maxdepth 2 -name index.ts -print | sort

if [ -n "${OPENAI_KEY_FILE:-}" ]; then
  [ -f "$OPENAI_KEY_FILE" ] || die "OPENAI_KEY_FILE inexistente: $OPENAI_KEY_FILE"
  key="$(tr -d '\r\n' < "$OPENAI_KEY_FILE")"
  [ -n "$key" ] || die "OPENAI_KEY_FILE vazio"
  log "aplicando OPENAI_API_KEY no serviço functions (o valor não é ecoado)"
  docker service update --quiet \
    --env-add "OPENAI_API_KEY=$key" \
    "${SUPABASE_STACK}_functions" >/dev/null
  unset key
else
  restart_service functions
fi

log "aguardando o serviço convergir"
for _ in $(seq 1 30); do
  if docker ps -q --filter "name=^/${SUPABASE_STACK}_functions\." | grep -q .; then break; fi
  sleep 2
done
docker service ps "${SUPABASE_STACK}_functions" --no-trunc --filter desired-state=running
log "functions publicadas"
