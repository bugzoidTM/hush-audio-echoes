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
# pg_restore pode não existir no host; nesse caso valida-se dentro do container.
# O formato custom não é legível por stream, então o arquivo é copiado para /tmp.
if command -v pg_restore >/dev/null 2>&1; then
  pg_restore --list "$DUMP" >/dev/null
else
  docker exec -i "$(service_container db)" sh -c \
    'cat > /tmp/verify.dump && pg_restore --list /tmp/verify.dump >/dev/null; rc=$?; rm -f /tmp/verify.dump; exit $rc' \
    < "$DUMP"
fi
tar -tzf "$TGZ" >/dev/null

ls -lh "$DUMP" "$TGZ"
log "backup concluído"
