#!/usr/bin/env bash
# Corrige o host do banco no serviço supabase_storage.
#
# Na rede overlay Nutef o alias `db` é ambíguo (cortex_db usa o mesmo alias),
# então o storage tentava autenticar no banco errado e todo upload respondia
# 500 com: password authentication failed for user "supabase_storage_admin".
# A correção troca apenas o host do DATABASE_URL para supabase_db, preservando
# usuário, senha e banco. Nenhum valor sensível é impresso.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

CURRENT="$(service_env storage DATABASE_URL)"
[ -n "$CURRENT" ] || die "DATABASE_URL não encontrada no serviço ${SUPABASE_STACK}_storage"

FIXED="${CURRENT/@db:5432/@supabase_db:5432}"
if [ "$FIXED" = "$CURRENT" ]; then
  log "DATABASE_URL já não usa o alias ambíguo; nada a fazer"
  exit 0
fi

log "apontando ${SUPABASE_STACK}_storage para supabase_db"
docker service update --quiet --env-add "DATABASE_URL=$FIXED" "${SUPABASE_STACK}_storage" >/dev/null
unset CURRENT FIXED

for _ in $(seq 1 30); do
  docker ps -q --filter "name=^/${SUPABASE_STACK}_storage\." | grep -q . && break
  sleep 2
done
docker service ps "${SUPABASE_STACK}_storage" --filter desired-state=running --format '{{.Name}} {{.CurrentState}}'
log "storage recriado"
