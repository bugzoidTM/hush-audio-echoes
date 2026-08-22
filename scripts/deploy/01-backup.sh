#!/usr/bin/env bash
# Passo 3 do runbook: backup verificável do banco e das Edge Functions.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

DUMP="$BACKUP_DIR/shhhh-pre-hush2-$STAMP.dump"
TGZ="$BACKUP_DIR/functions-pre-hush2-$STAMP.tgz"

log "dump do postgres -> $DUMP"
docker exec -i "$(service_container db)" pg_dump -U postgres -d postgres -Fc > "$DUMP"

log "arquivo das functions -> $TGZ"
tar -C "$SUPABASE_VOLUMES_DIR" -czf "$TGZ" functions

log "verificando integridade dos artefatos"
pg_restore --list "$DUMP" >/dev/null 2>&1 \
  || docker exec -i "$(service_container db)" pg_restore --list /dev/stdin < "$DUMP" >/dev/null
tar -tzf "$TGZ" >/dev/null

ls -lh "$DUMP" "$TGZ"
log "backup concluído"
