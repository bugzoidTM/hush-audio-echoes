#!/usr/bin/env bash
# Verificação funcional ponta a ponta dos fluxos do PRD §8 que dá para automatizar:
# publicação anônima, publicação com Voice, anonimato do payload público e
# expiração real da mídia. Cria uma conta descartável e remove tudo ao final.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

command -v jq >/dev/null || die "jq é necessário"
command -v ffmpeg >/dev/null || die "ffmpeg é necessário para gerar o áudio de teste"

ANON_KEY="$(service_env functions SUPABASE_ANON_KEY)"
SERVICE_KEY="$(service_env functions SUPABASE_SERVICE_ROLE_KEY)"
[ -n "$ANON_KEY" ] && [ -n "$SERVICE_KEY" ] || die "chaves do Supabase não encontradas no serviço functions"

WORK="$(mktemp -d)"
STAMP="$(date -u +%Y%m%d%H%M%S)"
EMAIL="shhhh-smoke-$STAMP@example.invalid"
PASSWORD="$(head -c 18 /dev/urandom | base64 | tr -d '/+=')Aa1!"
HANDLE="@smoke$STAMP"
USER_ID=""
failures=0

cleanup() {
  if [ -n "$USER_ID" ]; then
    log "removendo dados de teste"
    db_psql -q -v ON_ERROR_STOP=1 -c \
      "delete from public.audio_posts where owner_user_id = '$USER_ID';" >/dev/null 2>&1 || true
    curl -s -o /dev/null -X DELETE "$PUBLIC_SUPABASE_URL/auth/v1/admin/users/$USER_ID" \
      -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

pass() { printf 'ok    %s\n' "$1"; }
fail() { printf 'FALHA %s\n' "$1"; failures=$((failures+1)); }

log "gerando áudio de teste (8s)"
ffmpeg -loglevel error -f lavfi -i "sine=frequency=440:duration=8" \
  -c:a libopus -b:a 24k "$WORK/echo.webm"

log "criando conta descartável $EMAIL"
USER_ID="$(curl -s -X POST "$PUBLIC_SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e,password:$p,email_confirm:true}')" \
  | jq -r '.id // empty')"
[ -n "$USER_ID" ] || die "não foi possível criar a conta de teste"

TOKEN="$(curl -s -X POST "$PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e,password:$p}')" \
  | jq -r '.access_token // empty')"
[ -n "$TOKEN" ] || die "não foi possível autenticar a conta de teste"

api() { curl -s -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" "$@"; }

CATEGORY_ID="$(api "$PUBLIC_SUPABASE_URL/rest/v1/categories?select=id&limit=1" | jq -r '.[0].id')"
[ "$CATEGORY_ID" != "null" ] || die "nenhuma categoria disponível"

log "publicando Echo anônimo"
ANON_ECHO="$(api -X POST "$PUBLIC_SUPABASE_URL/functions/v1/publish-echo" \
  -F "audio=@$WORK/echo.webm;type=audio/webm" -F 'duration=8' \
  -F 'identity_mode=anonymous' -F "category_id=$CATEGORY_ID" -F 'expiration=1h' \
  -F 'voice_protection_enabled=false' -F 'title=Echo de verificação')"
ANON_ID="$(jq -r '.id // empty' <<<"$ANON_ECHO")"
[ -n "$ANON_ID" ] && pass "publish-echo anônimo (201)" || { fail "publish-echo anônimo: $ANON_ECHO"; exit 1; }

FEED="$(api "$PUBLIC_SUPABASE_URL/functions/v1/discovery-feed?limit=15")"
jq -e --arg id "$ANON_ID" '.items | any(.id == $id)' >/dev/null <<<"$FEED" \
  && pass "Echo aparece no discovery-feed" || fail "Echo ausente do discovery-feed"

ITEM="$(jq -c --arg id "$ANON_ID" '.items[] | select(.id == $id)' <<<"$FEED")"
if jq -e '.public_identity == "Anônimo" and .voice_handle == null and .voice_display_name == null and .avatar_seed == null' >/dev/null <<<"$ITEM"; then
  pass "payload anônimo não expõe Voice"
else
  fail "payload anônimo expôs identidade: $ITEM"
fi
if grep -qE '"(owner_user_id|user_id|profile_id|username)"' <<<"$ITEM"; then
  fail "payload público contém identificador de conta"
else
  pass "payload público sem identificador de conta"
fi

PUBLIC_ECHO="$(api -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/get_public_echo" \
  -H 'Content-Type: application/json' -d "$(jq -nc --arg id "$ANON_ID" '{p_echo_id:$id}')")"
jq -e --arg id "$ANON_ID" '.[0].id == $id and .[0].public_identity == "Anônimo"' >/dev/null <<<"$PUBLIC_ECHO" \
  && pass "get_public_echo (rota /e/:id)" || fail "get_public_echo: $PUBLIC_ECHO"

log "criando Voice e publicando com identidade"
api -X POST "$PUBLIC_SUPABASE_URL/rest/v1/voices" -H 'Content-Type: application/json' \
  -H 'Prefer: return=minimal' \
  -d "$(jq -nc --arg u "$USER_ID" --arg h "$HANDLE" '{owner_user_id:$u,handle:$h,display_name:"Voz de verificação"}')" >/dev/null
VOICE_ID="$(api "$PUBLIC_SUPABASE_URL/rest/v1/voices?select=id&owner_user_id=eq.$USER_ID" | jq -r '.[0].id // empty')"
[ -n "$VOICE_ID" ] && pass "criação de Voice" || fail "não foi possível criar a Voice"

if [ -n "$VOICE_ID" ]; then
  VOICE_ECHO="$(api -X POST "$PUBLIC_SUPABASE_URL/functions/v1/publish-echo" \
    -F "audio=@$WORK/echo.webm;type=audio/webm" -F 'duration=8' \
    -F 'identity_mode=voice' -F "voice_id=$VOICE_ID" -F "category_id=$CATEGORY_ID" \
    -F 'expiration=1h' -F 'voice_protection_enabled=false' -F 'title=Echo com Voice')"
  jq -e '.id' >/dev/null <<<"$VOICE_ECHO" && pass "publish-echo com Voice" || fail "publish-echo com Voice: $VOICE_ECHO"

  VOICE_PROFILE="$(api -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/get_public_voice" \
    -H 'Content-Type: application/json' -d "$(jq -nc --arg h "$HANDLE" '{p_handle:$h}')")"
  jq -e --arg h "$HANDLE" '.[0].handle == $h' >/dev/null <<<"$VOICE_PROFILE" \
    && pass "perfil público /v/:handle" || fail "get_public_voice: $VOICE_PROFILE"
fi

log "forçando expiração do Echo anônimo e rodando o cleanup"
STORAGE_PATH="$(db_psql -tAq -c "select storage_path from public.audio_posts where id = '$ANON_ID';")"
db_psql -q -c "update public.audio_posts set expires_at = now() - interval '1 hour' where id = '$ANON_ID';" >/dev/null
"$(dirname "${BASH_SOURCE[0]}")/cleanup-expired-audios.sh" >/dev/null

STATUS_AFTER="$(db_psql -tAq -c "select status from public.audio_posts where id = '$ANON_ID';" | tr -d ' ')"
[ "$STATUS_AFTER" = "expired" ] && pass "Echo marcado como expired" || fail "status após cleanup: $STATUS_AFTER"

MEDIA_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
  "$PUBLIC_SUPABASE_URL/storage/v1/object/public/echo-audio/$STORAGE_PATH")"
[ "$MEDIA_CODE" = "400" ] || [ "$MEDIA_CODE" = "404" ] \
  && pass "mídia removida do Storage (HTTP $MEDIA_CODE)" \
  || fail "mídia ainda acessível após expiração (HTTP $MEDIA_CODE)"

[ "$failures" -eq 0 ] || die "$failures verificação(ões) funcionais falharam"
log "verificação funcional aprovada"
