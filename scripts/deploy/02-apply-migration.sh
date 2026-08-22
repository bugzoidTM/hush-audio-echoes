#!/usr/bin/env bash
# Passo 4 do runbook: aplica a migração do núcleo Echoes/Voices/Communities.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

MIGRATION="${1:-$APP_DIR/supabase/migrations/20260821190000_shhhh_echoes_voices_communities.sql}"
[ -f "$MIGRATION" ] || die "migração não encontrada: $MIGRATION"

log "alvo da conexão:"
db_psql -c "select current_database(), current_user, now();"

log "aplicando $(basename "$MIGRATION") com ON_ERROR_STOP=1"
db_psql -v ON_ERROR_STOP=1 < "$MIGRATION"

log "verificando objetos essenciais"
db_psql <<'SQL'
select to_regclass('public.voices') as voices,
       to_regclass('public.communities') as communities,
       to_regclass('public.echo_reactions') as echo_reactions,
       to_regclass('public.analytics_events') as analytics_events;
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('get_discovery_feed', 'get_public_echo', 'get_public_voice', 'get_my_voices_feed')
order by proname;
select count(*) as categories from public.categories;
select id, public from storage.buckets where id = 'echo-audio';
SQL
log "migração aplicada"
