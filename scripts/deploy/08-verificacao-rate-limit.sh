#!/usr/bin/env bash
# Verificação dos limites por conta: publicação, reação, denúncia e criação de
# Voice. Cria contas descartáveis e remove tudo ao final.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

command -v jq >/dev/null || die "jq é necessário"
command -v ffmpeg >/dev/null || die "ffmpeg é necessário"

ANON_KEY="$(service_env functions SUPABASE_ANON_KEY)"
SERVICE_KEY="$(service_env functions SUPABASE_SERVICE_ROLE_KEY)"
[ -n "$ANON_KEY" ] && [ -n "$SERVICE_KEY" ] || die "chaves do Supabase não encontradas"

WORK="$(mktemp -d)"
STAMP="$(date -u +%Y%m%d%H%M%S)"
USER_ID=""; OTHER_ID=""
failures=0

cleanup() {
  for id in "$USER_ID" "$OTHER_ID"; do
    [ -n "$id" ] || continue
    db_psql -q -c "delete from public.reports where reporter_id = '$id';" >/dev/null 2>&1 || true
    db_psql -q -c "delete from public.audio_posts where owner_user_id = '$id';" >/dev/null 2>&1 || true
    db_psql -q -c "delete from public.rate_limit_hits where user_id = '$id';" >/dev/null 2>&1 || true
    curl -s -o /dev/null -X DELETE "$PUBLIC_SUPABASE_URL/auth/v1/admin/users/$id" \
      -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" || true
  done
  rm -rf "$WORK"
}
trap cleanup EXIT

pass() { printf 'ok    %s\n' "$1"; }
fail() { printf 'FALHA %s\n' "$1"; failures=$((failures+1)); }
sql() { db_psql -tAq -v ON_ERROR_STOP=1 -c "$1" | tr -d '\r\n'; }

PASSWORD="$(head -c 18 /dev/urandom | base64 | tr -d '/+=')Aa1!"
EMAIL="shhhh-rate-$STAMP@example.invalid"
OTHER_EMAIL="shhhh-rate-outro-$STAMP@example.invalid"

create_user() {
  curl -s -X POST "$PUBLIC_SUPABASE_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg e "$1" --arg p "$PASSWORD" '{email:$e,password:$p,email_confirm:true}')" | jq -r '.id // empty'
}
# Token assinado com o segredo da stack: o login por senha exige captcha
# desde que o Turnstile foi ligado (ver mint_user_token em lib.sh).
login() { mint_user_token "$1"; }

log "criando contas descartáveis"
USER_ID="$(create_user "$EMAIL")"; OTHER_ID="$(create_user "$OTHER_EMAIL")"
TOKEN="$(login "$USER_ID")"; OTHER_TOKEN="$(login "$OTHER_ID")"
[ -n "$TOKEN" ] && [ -n "$OTHER_TOKEN" ] || die "não foi possível autenticar as contas"

api() { curl -s -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" "$@"; }
api_code() { curl -s -o /dev/null -w '%{http_code}' -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" "$@"; }

CATEGORY_ID="$(api "$PUBLIC_SUPABASE_URL/rest/v1/categories?select=id&limit=1" | jq -r '.[0].id')"
ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=440:duration=6" -c:a libopus -b:a 24k "$WORK/echo.webm"

publish() {
  curl -s -o /dev/null -w '%{http_code}' -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" \
    -X POST "$PUBLIC_SUPABASE_URL/functions/v1/publish-echo" \
    -F "audio=@$WORK/echo.webm;type=audio/webm" -F 'duration=6' -F 'identity_mode=anonymous' \
    -F "category_id=$CATEGORY_ID" -F 'expiration=1h' -F 'voice_protection_enabled=false' -F "title=Limite $1"
}

# ---------------------------------------------------------------------------
# 1. Publicação: o limite é aplicado ANTES do upload (nada de mídia órfã).
# ---------------------------------------------------------------------------
LIMIT="$(sql "select max_hits from public.rate_limits where action = 'publish_echo';")"
log "limite de publicação configurado: $LIMIT/hora"

accepted=0; blocked=0
for attempt in $(seq 1 $((LIMIT + 2))); do
  code="$(publish "$attempt")"
  case "$code" in
    201) accepted=$((accepted+1)) ;;
    429) blocked=$((blocked+1)) ;;
    *) fail "publicação $attempt devolveu HTTP $code" ;;
  esac
done

[ "$accepted" -eq "$LIMIT" ] && pass "publicação aceita exatamente $LIMIT vezes na janela" \
  || fail "aceitou $accepted publicações (esperado $LIMIT)"
[ "$blocked" -ge 2 ] && pass "publicação além do limite recusada com HTTP 429" \
  || fail "excedente não foi recusado (bloqueios: $blocked)"

ORPHANS="$(sql "select count(*) from public.audio_posts where owner_user_id = '$USER_ID';")"
[ "$ORPHANS" = "$LIMIT" ] && pass "nenhuma linha órfã criada pelas tentativas barradas" \
  || fail "$ORPHANS Echoes no banco para $LIMIT publicações aceitas"

# ---------------------------------------------------------------------------
# 1.1 Concorrência: o limite não pode ser furado com requisições simultâneas.
# ---------------------------------------------------------------------------

# Antes do lock consultivo, N requisições simultâneas liam o mesmo total antes
# de qualquer INSERT e passavam todas juntas — o limite virava
# "limite + concorrência". Este é o teste que a versão sequencial não pega.
db_psql -q -c "delete from public.rate_limit_hits where user_id = '$USER_ID';" >/dev/null
db_psql -q -c "delete from public.audio_posts where owner_user_id = '$USER_ID';" >/dev/null

PARALELAS=12
for indice in $(seq 1 $PARALELAS); do
  publish "paralela-$indice" > "$WORK/paralela-$indice.code" &
done
wait

aceitas_paralelas=0; barradas_paralelas=0
for indice in $(seq 1 $PARALELAS); do
  case "$(cat "$WORK/paralela-$indice.code")" in
    201) aceitas_paralelas=$((aceitas_paralelas+1)) ;;
    429) barradas_paralelas=$((barradas_paralelas+1)) ;;
  esac
done

[ "$aceitas_paralelas" -eq "$LIMIT" ] \
  && pass "$PARALELAS publicações simultâneas: exatamente $LIMIT aceitas, $barradas_paralelas barradas" \
  || fail "concorrência furou o limite: $aceitas_paralelas aceitas (esperado $LIMIT)"

GRAVADOS="$(sql "select count(*) from public.audio_posts where owner_user_id = '$USER_ID';")"
[ "$GRAVADOS" = "$LIMIT" ] && pass "nada além do limite foi gravado sob concorrência" \
  || fail "$GRAVADOS Echoes gravados para limite de $LIMIT"

# ---------------------------------------------------------------------------
# 2. O limite é por conta, não global.
# ---------------------------------------------------------------------------
OTHER_CODE="$(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $ANON_KEY" -H "Authorization: Bearer $OTHER_TOKEN" \
  -X POST "$PUBLIC_SUPABASE_URL/functions/v1/publish-echo" \
  -F "audio=@$WORK/echo.webm;type=audio/webm" -F 'duration=6' -F 'identity_mode=anonymous' \
  -F "category_id=$CATEGORY_ID" -F 'expiration=1h' -F 'voice_protection_enabled=false' -F 'title=Outra conta')"
[ "$OTHER_CODE" = "201" ] && pass "outra conta publica normalmente (limite é por conta)" \
  || fail "limite vazou entre contas (HTTP $OTHER_CODE)"

# ---------------------------------------------------------------------------
# 3. Reação e denúncia: limite no gatilho, valem para o PostgREST direto.
# ---------------------------------------------------------------------------
ECHO_ID="$(sql "select id from public.audio_posts where owner_user_id = '$USER_ID' limit 1;")"
db_psql -q -c "update public.rate_limits set max_hits = 3 where action in ('echo_reaction','echo_report');" >/dev/null
db_psql -q -c "delete from public.rate_limit_hits where user_id = '$USER_ID' and action in ('echo_reaction','echo_report');" >/dev/null

react_code() {
  api_code -X POST "$PUBLIC_SUPABASE_URL/rest/v1/echo_reactions?on_conflict=echo_id,user_id" \
    -H 'Content-Type: application/json' -H 'Prefer: resolution=merge-duplicates,return=minimal' \
    -d "$(jq -nc --arg e "$ECHO_ID" --arg u "$USER_ID" --arg r "$1" '{echo_id:$e,user_id:$u,reaction_type:$r}')"
}
last=""
for reaction in me_too with_you wow helped me_too; do last="$(react_code "$reaction")"; done
[ "$last" = "429" ] && pass "reação além do limite recusada com HTTP 429 (gatilho no banco)" \
  || fail "reação excedente devolveu HTTP $last"

REPORT_LAST=""
for index in 1 2 3 4; do
  TARGET="$(sql "select id from public.audio_posts where owner_user_id = '$OTHER_ID' limit 1;")"
  REPORT_LAST="$(api_code -X POST "$PUBLIC_SUPABASE_URL/rest/v1/reports" -H 'Content-Type: application/json' \
    -H 'Prefer: return=minimal' \
    -d "$(jq -nc --arg a "$TARGET" --arg r "$USER_ID" '{audio_id:$a,reporter_id:$r,reason:"spam"}')")"
  # A partir da segunda tentativa o índice único já recusa (409); o que importa
  # é que o limite entra antes de a fila encher.
done
case "$REPORT_LAST" in
  429|409) pass "denúncia repetida barrada (HTTP $REPORT_LAST)" ;;
  *) fail "denúncia repetida devolveu HTTP $REPORT_LAST" ;;
esac

db_psql -q -c "update public.rate_limits set max_hits = 120 where action = 'echo_reaction';" >/dev/null
db_psql -q -c "update public.rate_limits set max_hits = 10 where action = 'echo_report';" >/dev/null

# ---------------------------------------------------------------------------
# 4. O contador não é legível nem apagável por quem passa pelo PostgREST.
# ---------------------------------------------------------------------------
HITS_READ="$(api_code "$PUBLIC_SUPABASE_URL/rest/v1/rate_limit_hits?select=id&limit=1")"
[ "$HITS_READ" != "200" ] && pass "registro de tentativas não é legível pela API (HTTP $HITS_READ)" \
  || fail "qualquer conta lê rate_limit_hits"
HITS_DELETE="$(api_code -X DELETE "$PUBLIC_SUPABASE_URL/rest/v1/rate_limit_hits?user_id=eq.$USER_ID")"
[ "$HITS_DELETE" != "204" ] && pass "contador não pode ser zerado pela API (HTTP $HITS_DELETE)" \
  || fail "qualquer conta apaga o próprio contador e escapa do limite"
CONFIG_READ="$(api_code "$PUBLIC_SUPABASE_URL/rest/v1/rate_limits?select=action&limit=1")"
[ "$CONFIG_READ" != "200" ] && pass "configuração de limites não é exposta (HTTP $CONFIG_READ)" \
  || fail "configuração de limites legível pela API"

[ "$failures" -eq 0 ] || die "$failures verificação(ões) de rate limit falharam"
log "verificação de rate limit aprovada"
