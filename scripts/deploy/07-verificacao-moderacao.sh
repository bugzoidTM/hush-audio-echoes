#!/usr/bin/env bash
# Verificação do painel de Trust & Safety: fila, decisão humana, suspensão de
# Voice e suspensão de conta. Cria duas contas descartáveis (uma moderadora,
# uma autora) e remove tudo ao final.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

command -v jq >/dev/null || die "jq é necessário"
command -v ffmpeg >/dev/null || die "ffmpeg é necessário para gerar o áudio de teste"

ANON_KEY="$(service_env functions SUPABASE_ANON_KEY)"
SERVICE_KEY="$(service_env functions SUPABASE_SERVICE_ROLE_KEY)"
[ -n "$ANON_KEY" ] && [ -n "$SERVICE_KEY" ] || die "chaves do Supabase não encontradas no serviço functions"

WORK="$(mktemp -d)"
STAMP="$(date -u +%Y%m%d%H%M%S)"
MOD_ID=""; AUTHOR_ID=""
failures=0

cleanup() {
  for id in "$AUTHOR_ID" "$MOD_ID"; do
    [ -n "$id" ] || continue
    db_psql -q -c "delete from public.reports where reporter_id = '$id';" >/dev/null 2>&1 || true
    db_psql -q -c "delete from public.audio_posts where owner_user_id = '$id';" >/dev/null 2>&1 || true
    db_psql -q -c "delete from public.user_roles where user_id = '$id';" >/dev/null 2>&1 || true
    curl -s -o /dev/null -X DELETE "$PUBLIC_SUPABASE_URL/auth/v1/admin/users/$id" \
      -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" || true
  done
  rm -rf "$WORK"
}
trap cleanup EXIT

pass() { printf 'ok    %s\n' "$1"; }
fail() { printf 'FALHA %s\n' "$1"; failures=$((failures+1)); }
sql() { db_psql -tAq -v ON_ERROR_STOP=1 -c "$1" | tr -d '\r\n'; }

create_user() {
  curl -s -X POST "$PUBLIC_SUPABASE_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg e "$1" --arg p "$2" '{email:$e,password:$p,email_confirm:true}')" | jq -r '.id // empty'
}
login() {
  curl -s -X POST "$PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg e "$1" --arg p "$2" '{email:$e,password:$p}')"
}

PASSWORD="$(head -c 18 /dev/urandom | base64 | tr -d '/+=')Aa1!"
MOD_EMAIL="shhhh-mod-$STAMP@example.invalid"
AUTHOR_EMAIL="shhhh-autor-$STAMP@example.invalid"

log "criando contas descartáveis"
MOD_ID="$(create_user "$MOD_EMAIL" "$PASSWORD")"
AUTHOR_ID="$(create_user "$AUTHOR_EMAIL" "$PASSWORD")"
[ -n "$MOD_ID" ] && [ -n "$AUTHOR_ID" ] || die "não foi possível criar as contas de teste"

db_psql -q -c "insert into public.user_roles (user_id, role) values ('$MOD_ID', 'moderator') on conflict do nothing;" >/dev/null

MOD_TOKEN="$(login "$MOD_EMAIL" "$PASSWORD" | jq -r '.access_token // empty')"
AUTHOR_TOKEN="$(login "$AUTHOR_EMAIL" "$PASSWORD" | jq -r '.access_token // empty')"
[ -n "$MOD_TOKEN" ] && [ -n "$AUTHOR_TOKEN" ] || die "não foi possível autenticar as contas de teste"

as_mod() { curl -s -H "apikey: $ANON_KEY" -H "Authorization: Bearer $MOD_TOKEN" "$@"; }
as_author() { curl -s -H "apikey: $ANON_KEY" -H "Authorization: Bearer $AUTHOR_TOKEN" "$@"; }
rpc_mod() { as_mod -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/$1" -H 'Content-Type: application/json' -d "$2"; }
rpc_author() { as_author -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/$1" -H 'Content-Type: application/json' -d "$2"; }

# ---------------------------------------------------------------------------
# 1. Só moderador enxerga a fila.
# ---------------------------------------------------------------------------
[ "$(rpc_mod is_moderator '{}')" = "true" ] && pass "is_moderator verdadeiro para quem tem o papel" \
  || fail "is_moderator não reconheceu o moderador"
[ "$(rpc_author is_moderator '{}')" = "false" ] && pass "is_moderator falso para conta comum" \
  || fail "is_moderator devolveu verdadeiro para conta sem papel"

QUEUE_AUTHOR="$(rpc_author get_review_queue '{"p_scope":"all","p_limit":10}')"
jq -e '.code == "42501" or (.message // "" | test("moderação"))' >/dev/null <<<"$QUEUE_AUTHOR" \
  && pass "fila recusada para conta sem papel de moderação" || fail "conta comum leu a fila: $QUEUE_AUTHOR"

STATS_AUTHOR="$(rpc_author get_moderation_stats '{}')"
jq -e '.code == "42501" or (.message // "" | test("moderação"))' >/dev/null <<<"$STATS_AUTHOR" \
  && pass "estatísticas recusadas para conta sem papel" || fail "conta comum leu as estatísticas"

# ---------------------------------------------------------------------------
# 2. Echo publicado cai na fila com transcrição de servidor.
# ---------------------------------------------------------------------------
ffmpeg -loglevel error -f lavfi -i "sine=frequency=440:duration=6" -c:a libopus -b:a 24k "$WORK/echo.webm"
CATEGORY_ID="$(as_author "$PUBLIC_SUPABASE_URL/rest/v1/categories?select=id&limit=1" | jq -r '.[0].id')"

ECHO_JSON="$(as_author -X POST "$PUBLIC_SUPABASE_URL/functions/v1/publish-echo" \
  -F "audio=@$WORK/echo.webm;type=audio/webm" -F 'duration=6' -F 'identity_mode=anonymous' \
  -F "category_id=$CATEGORY_ID" -F 'expiration=1h' -F 'voice_protection_enabled=false' \
  -F 'title=Echo para moderar' -F 'transcription=texto que o cliente mandou')"
ECHO_ID="$(jq -r '.id // empty' <<<"$ECHO_JSON")"
[ -n "$ECHO_ID" ] || die "não foi possível publicar o Echo de teste: $ECHO_JSON"

# Simula o worker encontrando conteúdo sensível: é o caminho que enche a fila.
DECISION="$(sql "select public.apply_server_moderation('$ECHO_ID'::uuid, 'meu cpf e 123.456.789-00, anota ai', 'server_stt');")"
[ "$DECISION" = "review_required" ] && pass "classificador mandou dado pessoal para revisão humana" \
  || fail "classificador devolveu '$DECISION'"

QUEUE="$(rpc_mod get_review_queue '{"p_scope":"moderation","p_limit":50}')"
ITEM="$(jq -c --arg id "$ECHO_ID" '.[] | select(.id == $id)' <<<"$QUEUE")"
[ -n "$ITEM" ] && pass "Echo aparece na fila de moderação" || fail "Echo ausente da fila: $QUEUE"

jq -e '.transcription != null and .client_transcription == "texto que o cliente mandou" and .owner_user_id != null' >/dev/null <<<"$ITEM" \
  && pass "fila mostra transcrição do servidor, texto do cliente e autor" \
  || fail "payload da fila incompleto: $ITEM"

# ---------------------------------------------------------------------------
# 3. Decisão humana.
# ---------------------------------------------------------------------------
DENY="$(rpc_author review_echo "$(jq -nc --arg id "$ECHO_ID" '{p_echo_id:$id,p_decision:"approved"}')")"
jq -e '.code == "42501" or (.message // "" | test("moderação"))' >/dev/null <<<"$DENY" \
  && pass "conta comum não decide moderação" || fail "conta comum aprovou um Echo: $DENY"

rpc_mod review_echo "$(jq -nc --arg id "$ECHO_ID" '{p_echo_id:$id,p_decision:"approved",p_note:"revisado no teste"}')" >/dev/null
STATE="$(sql "select moderation_status||'|'||moderation_source||'|'||visibility from public.audio_posts where id = '$ECHO_ID';")"
[ "$STATE" = "approved|human|public" ] && pass "aprovar grava decisão humana com rastro" || fail "estado após aprovar: $STATE"

FEED="$(as_author "$PUBLIC_SUPABASE_URL/functions/v1/discovery-feed?limit=15")"
jq -e --arg id "$ECHO_ID" '.items | any(.id == $id)' >/dev/null <<<"$FEED" \
  && pass "Echo aprovado volta ao Discovery" || fail "Echo aprovado não voltou ao Discovery"

# Denúncia aberta pelo moderador (qualquer conta pode denunciar).
as_mod -X POST "$PUBLIC_SUPABASE_URL/rest/v1/reports" -H 'Content-Type: application/json' -H 'Prefer: return=minimal' \
  -d "$(jq -nc --arg a "$ECHO_ID" --arg r "$MOD_ID" '{audio_id:$a,reporter_id:$r,reason:"doxxing"}')" >/dev/null
REPORTED="$(rpc_mod get_review_queue '{"p_scope":"reports","p_limit":50}')"
jq -e --arg id "$ECHO_ID" '.[] | select(.id == $id) | .open_reports >= 1' >/dev/null <<<"$REPORTED" \
  && pass "Echo denunciado aparece na aba de denúncias" || fail "denúncia não chegou à fila"

rpc_mod review_echo "$(jq -nc --arg id "$ECHO_ID" '{p_echo_id:$id,p_decision:"limited",p_note:"alcance limitado no teste"}')" >/dev/null
REPORT_STATE="$(sql "select status::text from public.reports where audio_id = '$ECHO_ID' limit 1;")"
[ "$REPORT_STATE" = "resolved" ] && pass "decisão resolve a denúncia aberta" || fail "denúncia ficou em '$REPORT_STATE'"

FEED="$(as_author "$PUBLIC_SUPABASE_URL/functions/v1/discovery-feed?limit=15")"
jq -e --arg id "$ECHO_ID" '.items | any(.id == $id) | not' >/dev/null <<<"$FEED" \
  && pass "Echo limitado sai do Discovery" || fail "Echo limitado continua no Discovery"

LINKED="$(rpc_author get_public_echo "$(jq -nc --arg id "$ECHO_ID" '{p_echo_id:$id}')")"
jq -e --arg id "$ECHO_ID" '.[0].id == $id' >/dev/null <<<"$LINKED" \
  && pass "Echo limitado continua acessível por link direto" || fail "link direto do Echo limitado quebrou"

rpc_mod review_echo "$(jq -nc --arg id "$ECHO_ID" '{p_echo_id:$id,p_decision:"rejected",p_note:"rejeitado no teste"}')" >/dev/null
REJECTED="$(sql "select status||'|'||(expires_at <= now())::text from public.audio_posts where id = '$ECHO_ID';")"
[ "$REJECTED" = "deleted|true" ] && pass "rejeitar tira do ar e expira a mídia" || fail "estado após rejeitar: $REJECTED"

# ---------------------------------------------------------------------------
# 4. Suspender Voice tira os Echoes dela do Discovery.
# ---------------------------------------------------------------------------
HANDLE="@modtest$STAMP"
as_author -X POST "$PUBLIC_SUPABASE_URL/rest/v1/voices" -H 'Content-Type: application/json' -H 'Prefer: return=minimal' \
  -d "$(jq -nc --arg u "$AUTHOR_ID" --arg h "$HANDLE" '{owner_user_id:$u,handle:$h,display_name:"Voz do teste"}')" >/dev/null
VOICE_ID="$(as_author "$PUBLIC_SUPABASE_URL/rest/v1/voices?select=id&owner_user_id=eq.$AUTHOR_ID" | jq -r '.[0].id // empty')"

VOICE_ECHO="$(as_author -X POST "$PUBLIC_SUPABASE_URL/functions/v1/publish-echo" \
  -F "audio=@$WORK/echo.webm;type=audio/webm" -F 'duration=6' -F 'identity_mode=voice' -F "voice_id=$VOICE_ID" \
  -F "category_id=$CATEGORY_ID" -F 'expiration=1h' -F 'voice_protection_enabled=false' -F 'title=Echo com Voice')"
VOICE_ECHO_ID="$(jq -r '.id // empty' <<<"$VOICE_ECHO")"
sql "select public.apply_server_moderation('$VOICE_ECHO_ID'::uuid, 'hoje foi um dia tranquilo e eu queria contar', 'server_stt');" >/dev/null

FEED="$(as_author "$PUBLIC_SUPABASE_URL/functions/v1/discovery-feed?limit=15")"
jq -e --arg id "$VOICE_ECHO_ID" '.items | any(.id == $id)' >/dev/null <<<"$FEED" \
  && pass "Echo com Voice ativa está no Discovery" || fail "Echo com Voice não entrou no Discovery"

rpc_mod set_voice_status "$(jq -nc --arg id "$VOICE_ID" '{p_voice_id:$id,p_status:"suspended"}')" >/dev/null
FEED="$(as_author "$PUBLIC_SUPABASE_URL/functions/v1/discovery-feed?limit=15")"
jq -e --arg id "$VOICE_ECHO_ID" '.items | any(.id == $id) | not' >/dev/null <<<"$FEED" \
  && pass "suspender Voice tira os Echoes dela do Discovery" || fail "Echo de Voice suspensa continua no feed"

rpc_mod set_voice_status "$(jq -nc --arg id "$VOICE_ID" '{p_voice_id:$id,p_status:"active"}')" >/dev/null

# ---------------------------------------------------------------------------
# 5. Suspender conta bloqueia o login e tira o conteúdo do ar.
# ---------------------------------------------------------------------------
SUSPEND="$(as_mod -X POST "$PUBLIC_SUPABASE_URL/functions/v1/suspend-account" -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg u "$AUTHOR_ID" '{user_id:$u,suspended:true,note:"suspensão de teste"}')")"
jq -e '.ok == true' >/dev/null <<<"$SUSPEND" && pass "suspend-account respondeu ok" || fail "suspend-account: $SUSPEND"

RELOGIN="$(login "$AUTHOR_EMAIL" "$PASSWORD" | jq -r '.access_token // "bloqueado"')"
[ "$RELOGIN" = "bloqueado" ] && pass "conta suspensa não consegue mais entrar" || fail "conta suspensa ainda autentica"

SUSPENDED_STATE="$(sql "select (select status from public.voices where id = '$VOICE_ID')||'|'||(select moderation_status from public.audio_posts where id = '$VOICE_ECHO_ID');")"
[ "$SUSPENDED_STATE" = "suspended|review_required" ] \
  && pass "suspensão tira Voice e Echoes do ar (sem apagar)" || fail "estado após suspender: $SUSPENDED_STATE"

SELF="$(as_mod -X POST "$PUBLIC_SUPABASE_URL/functions/v1/suspend-account" -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg u "$MOD_ID" '{user_id:$u,suspended:true}')")"
jq -e '.error != null' >/dev/null <<<"$SELF" && pass "moderador não suspende a própria conta" || fail "moderador se autossuspendeu"

DENIED="$(as_author -X POST "$PUBLIC_SUPABASE_URL/functions/v1/suspend-account" -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg u "$MOD_ID" '{user_id:$u,suspended:true}')")"
jq -e '.error != null' >/dev/null <<<"$DENIED" && pass "conta comum não suspende ninguém" || fail "conta comum suspendeu uma conta: $DENIED"

REACTIVATE="$(as_mod -X POST "$PUBLIC_SUPABASE_URL/functions/v1/suspend-account" -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg u "$AUTHOR_ID" '{user_id:$u,suspended:false}')")"
jq -e '.ok == true' >/dev/null <<<"$REACTIVATE" && pass "reativação responde ok" || fail "reativação: $REACTIVATE"
BACK="$(login "$AUTHOR_EMAIL" "$PASSWORD" | jq -r '.access_token // "bloqueado"')"
[ "$BACK" != "bloqueado" ] && pass "conta reativada volta a entrar" || fail "conta reativada continua bloqueada"

[ "$failures" -eq 0 ] || die "$failures verificação(ões) de moderação falharam"
log "verificação do painel de moderação aprovada"
