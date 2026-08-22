#!/usr/bin/env bash
# Passo 4 do runbook: aplica a migração do núcleo Echoes/Voices/Communities.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

MIGRATION="${1:-$APP_DIR/supabase/migrations/20260821190000_shhhh_echoes_voices_communities.sql}"
[ -f "$MIGRATION" ] || die "migração não encontrada: $MIGRATION"

log "alvo da conexão:"
db_psql -c "select current_database(), current_user, now();"

# O PRD afirma que a migração traz BEGIN/COMMIT próprios, mas o arquivo não os
# tem: sem --single-transaction o psql confirma statement a statement e uma
# falha no meio deixaria o esquema pela metade. A migração não usa comandos
# proibidos em transação (CREATE INDEX CONCURRENTLY, VACUUM), então envolvê-la
# é seguro e é o que garante a atomicidade prometida.
log "aplicando $(basename "$MIGRATION") com ON_ERROR_STOP=1 --single-transaction"
db_psql -v ON_ERROR_STOP=1 --single-transaction < "$MIGRATION"

log "verificando objetos essenciais"
db_psql <<'SQL'
select to_regclass('public.voices') as voices,
       to_regclass('public.communities') as communities,
       to_regclass('public.echo_reactions') as echo_reactions,
       -- O PRD chama esta tabela de analytics_events; o nome real na migração
       -- é echo_events (eventos de impressão/play/skip usados pelo ranking).
       to_regclass('public.echo_events') as echo_events;
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('get_discovery_feed', 'get_public_echo', 'get_public_voice', 'get_my_voices_feed')
order by proname;
select count(*) as categories from public.categories;
select id, public from storage.buckets where id = 'echo-audio';
SQL
# O PostgREST mantém um cache do esquema: sem recarregá-lo as novas funções RPC
# respondem PGRST202 ("could not find the function ... in the schema cache").
# Nesta instalação o NOTIFY sozinho não basta (o canal de escuta não recarrega),
# então o serviço é recriado em seguida.
log "recarregando o cache de esquema do PostgREST"
db_psql -c "NOTIFY pgrst, 'reload schema';" >/dev/null
restart_service rest
for _ in $(seq 1 30); do
  docker ps -q --filter "name=^/${SUPABASE_STACK}_rest\." | grep -q . && break
  sleep 2
done
sleep 5

log "migração aplicada"
