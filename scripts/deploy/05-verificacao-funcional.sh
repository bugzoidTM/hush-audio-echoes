#!/usr/bin/env bash
# Verificação funcional ponta a ponta dos fluxos do PRD §8 que dá para automatizar:
# publicação anônima, moderação server-side, autorização de escrita, anonimato do
# payload público, paginação estável do Discovery e expiração real da mídia.
# Cria uma conta descartável e remove tudo ao final.
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
api_code() { curl -s -o /dev/null -w '%{http_code}' -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" "$@"; }
# -tAq já devolve o valor sem alinhamento nem cabeçalho; só o \n final sobra.
sql() { db_psql -tAq -v ON_ERROR_STOP=1 -c "$1" | tr -d '\r\n'; }

CATEGORY_ID="$(api "$PUBLIC_SUPABASE_URL/rest/v1/categories?select=id&limit=1" | jq -r '.[0].id')"
[ "$CATEGORY_ID" != "null" ] || die "nenhuma categoria disponível"

# ---------------------------------------------------------------------------
# 1. Publicação: nasce em análise, com a transcrição do cliente isolada.
# ---------------------------------------------------------------------------
CLIENT_TEXT="transcricao enviada pelo cliente $STAMP"
log "publicando Echo anônimo (com transcrição enviada pelo navegador)"
ANON_ECHO="$(api -X POST "$PUBLIC_SUPABASE_URL/functions/v1/publish-echo" \
  -F "audio=@$WORK/echo.webm;type=audio/webm" -F 'duration=8' \
  -F 'identity_mode=anonymous' -F "category_id=$CATEGORY_ID" -F 'expiration=1h' \
  -F 'voice_protection_enabled=false' -F 'title=Echo de verificação' \
  -F "transcription=$CLIENT_TEXT")"
ANON_ID="$(jq -r '.id // empty' <<<"$ANON_ECHO")"
[ -n "$ANON_ID" ] && pass "publish-echo anônimo (201)" || { fail "publish-echo anônimo: $ANON_ECHO"; exit 1; }

jq -e '.moderation_status == "pending"' >/dev/null <<<"$ANON_ECHO" \
  && pass "Echo nasce em 'pending' (nada é aprovado na publicação)" \
  || fail "publish-echo devolveu moderation_status=$(jq -r '.moderation_status' <<<"$ANON_ECHO")"

# O P0 desta rodada: a transcrição do navegador não decide moderação nem vira o
# texto público. Ela fica isolada em client_transcription.
STORED="$(sql "select coalesce(transcription,'<null>') || ' | ' || coalesce(client_transcription,'<null>') from public.audio_posts where id = '$ANON_ID';")"
case "$STORED" in
  "<null> | "*"$STAMP") pass "transcrição do cliente isolada em client_transcription" ;;
  *) fail "colunas de transcrição inesperadas: $STORED" ;;
esac

# ---------------------------------------------------------------------------
# 2. Enquanto pendente, o Echo é invisível — menos para o próprio autor.
# ---------------------------------------------------------------------------
FEED="$(api "$PUBLIC_SUPABASE_URL/functions/v1/discovery-feed?limit=15")"
jq -e --arg id "$ANON_ID" '.items | any(.id == $id) | not' >/dev/null <<<"$FEED" \
  && pass "Echo pendente não aparece no discovery-feed" || fail "Echo pendente vazou para o discovery-feed"

PUBLIC_PENDING="$(api -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/get_public_echo" \
  -H 'Content-Type: application/json' -d "$(jq -nc --arg id "$ANON_ID" '{p_echo_id:$id}')")"
jq -e 'length == 0' >/dev/null <<<"$PUBLIC_PENDING" \
  && pass "get_public_echo não devolve Echo pendente" || fail "get_public_echo devolveu Echo pendente"

MY_STATUS="$(api -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/get_my_echo_status" \
  -H 'Content-Type: application/json' -d "$(jq -nc --arg id "$ANON_ID" '{p_echo_id:$id}')")"
jq -e '.[0].moderation_status == "pending"' >/dev/null <<<"$MY_STATUS" \
  && pass "autor consulta o próprio estado (get_my_echo_status)" || fail "get_my_echo_status: $MY_STATUS"

# ---------------------------------------------------------------------------
# 3. Escrita direta na tabela: fechada. Só as RPCs do dono passam.
# ---------------------------------------------------------------------------
PATCH_CODE="$(api_code -X PATCH "$PUBLIC_SUPABASE_URL/rest/v1/audio_posts?id=eq.$ANON_ID" \
  -H 'Content-Type: application/json' -d '{"moderation_status":"approved","visibility":"public"}')"
[ "$PATCH_CODE" = "401" ] || [ "$PATCH_CODE" = "403" ] || [ "$PATCH_CODE" = "404" ] \
  && pass "PATCH direto em audio_posts recusado (HTTP $PATCH_CODE)" \
  || fail "PATCH direto em audio_posts aceito (HTTP $PATCH_CODE)"

STILL_PENDING="$(sql "select moderation_status from public.audio_posts where id = '$ANON_ID';")"
[ "$STILL_PENDING" = "pending" ] && pass "moderation_status intacto após o PATCH" \
  || fail "moderation_status virou '$STILL_PENDING' por escrita direta"

DELETE_CODE="$(api_code -X DELETE "$PUBLIC_SUPABASE_URL/rest/v1/audio_posts?id=eq.$ANON_ID")"
[ "$DELETE_CODE" = "401" ] || [ "$DELETE_CODE" = "403" ] || [ "$DELETE_CODE" = "404" ] \
  && pass "DELETE direto em audio_posts recusado (HTTP $DELETE_CODE)" \
  || fail "DELETE direto em audio_posts aceito (HTTP $DELETE_CODE)"

META="$(api -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/update_echo_metadata" \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg id "$ANON_ID" '{p_echo_id:$id,p_title:"Título editado pelo dono"}')")"
NEW_TITLE="$(sql "select title from public.audio_posts where id = '$ANON_ID';")"
[ "$NEW_TITLE" = "Título editado pelo dono" ] && pass "update_echo_metadata edita o que é do dono" \
  || fail "update_echo_metadata não aplicou o título: $META / '$NEW_TITLE'"

# ---------------------------------------------------------------------------
# 4. Communities congeladas + fim do escalonamento de papel.
# ---------------------------------------------------------------------------
ROLE_CODE="$(api_code -X POST "$PUBLIC_SUPABASE_URL/rest/v1/community_members" \
  -H 'Content-Type: application/json' -H 'Prefer: return=minimal' \
  -d "$(jq -nc --arg u "$USER_ID" '{community_id:"00000000-0000-0000-0000-000000000000",user_id:$u,role:"creator",status:"active"}')")"
[ "$ROLE_CODE" != "201" ] && [ "$ROLE_CODE" != "200" ] \
  && pass "INSERT de community_members com role 'creator' recusado (HTTP $ROLE_CODE)" \
  || fail "escalonamento de papel em community_members ainda é possível (HTTP $ROLE_CODE)"

FLAG_OFF="$(sql "select public.feature_enabled('COMMUNITIES_ENABLED')::text;")"
[ "$FLAG_OFF" = "false" ] && pass "flag COMMUNITIES_ENABLED desligada no banco" \
  || fail "COMMUNITIES_ENABLED=$FLAG_OFF (a área foi congelada nesta rodada)"

# ---------------------------------------------------------------------------
# 5. Classificador de transcrição: severo rejeita, sensível vai para humano.
# ---------------------------------------------------------------------------
CLASSIFY="$(sql "select public.classify_transcription('hoje o dia foi difícil mas melhorou') || ',' ||
                        public.classify_transcription('meu cpf e 123.456.789-00, anota aí') || ',' ||
                        public.classify_transcription('vou te encontrar e te matar') || ',' ||
                        public.classify_transcription('');")"
[ "$CLASSIFY" = "approved,review_required,rejected,review_required" ] \
  && pass "classify_transcription: aprovado/humano/rejeitado/sem-texto" \
  || fail "classify_transcription devolveu: $CLASSIFY"

# ---------------------------------------------------------------------------
# 6. Worker de moderação: processa a fila e nunca aprova pelo texto do cliente.
# ---------------------------------------------------------------------------
log "rodando o worker de moderação (transcreve o áudio publicado)"
"$(dirname "${BASH_SOURCE[0]}")/moderate-pending-echoes.sh" >"$WORK/worker.log" 2>&1 || true

AFTER_WORKER="$(sql "select moderation_status || '|' || coalesce(moderation_source,'-') || '|' || coalesce(transcription,'<null>') from public.audio_posts where id = '$ANON_ID';")"
case "$AFTER_WORKER" in
  *"|$CLIENT_TEXT") fail "a transcrição do cliente virou a transcrição oficial: $AFTER_WORKER" ;;
  approved\|server_stt\|*|pending\|*|review_required\|server_stt\|*)
    pass "worker não usou o texto do cliente ($AFTER_WORKER)" ;;
  *) fail "estado inesperado após o worker: $AFTER_WORKER" ;;
esac

# Falha silenciosa do worker é o modo perigoso: sem ele, todo Echo novo fica
# invisível para sempre. Tem de haver marca da passagem — decisão tomada ou
# tentativa contabilizada (o tom de teste não tem fala, então falhar é normal).
TOUCHED="$(sql "select (moderation_attempts > 0 or moderation_source is not null)::text from public.audio_posts where id = '$ANON_ID';")"
if [ "$TOUCHED" = "true" ]; then
  pass "worker de moderação processou a fila"
else
  fail "worker não tocou no Echo pendente; saída: $(tr '\n' ' ' < "$WORK/worker.log" | tail -c 300)"
fi

# Caminho de aprovação, determinístico: é a mesma função que o worker chama
# quando o whisper devolve texto (o tom de teste não tem fala).
APPROVED="$(sql "select public.apply_server_moderation('$ANON_ID'::uuid, 'hoje eu só queria desabafar sobre o meu dia', 'server_stt');")"
[ "$APPROVED" = "approved" ] && pass "apply_server_moderation aprova com transcrição de servidor" \
  || fail "apply_server_moderation devolveu '$APPROVED'"

# ---------------------------------------------------------------------------
# 7. Payload público: anonimato, mídia acessível e transcrição do servidor.
# ---------------------------------------------------------------------------
FEED="$(api "$PUBLIC_SUPABASE_URL/functions/v1/discovery-feed?limit=15")"
jq -e --arg id "$ANON_ID" '.items | any(.id == $id)' >/dev/null <<<"$FEED" \
  && pass "Echo aprovado aparece no discovery-feed" || fail "Echo aprovado ausente do discovery-feed"

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
jq -e --arg t "$CLIENT_TEXT" '.transcription != $t' >/dev/null <<<"$ITEM" \
  && pass "transcrição pública é a do servidor" || fail "transcrição pública veio do cliente"

# A paginação por conjunto já servido substituiu o cursor por published_at, que
# pulava e repetia Echoes quando o ranking mudava entre requisições.
EXCLUDED="$(api "$PUBLIC_SUPABASE_URL/functions/v1/discovery-feed?limit=15&exclude=$ANON_ID")"
jq -e --arg id "$ANON_ID" '.items | any(.id == $id) | not' >/dev/null <<<"$EXCLUDED" \
  && pass "discovery-feed respeita exclude (paginação estável)" || fail "exclude ignorado pelo discovery-feed"
jq -e 'has("has_more")' >/dev/null <<<"$EXCLUDED" \
  && pass "discovery-feed informa has_more" || fail "resposta sem has_more"

# Regressão conhecida: publish-echo já gravou audio_url com o host interno
# (http://kong:8000), que não resolve no navegador — o play não fazia nada.
AUDIO_URL="$(jq -r '.audio_url // ""' <<<"$ITEM")"
case "$AUDIO_URL" in
  "$PUBLIC_SUPABASE_URL"/storage/v1/object/public/echo-audio/*)
    MEDIA_OK="$(curl -s -o /dev/null -w '%{http_code}' "$AUDIO_URL")"
    [ "$MEDIA_OK" = "200" ] && pass "áudio publicado acessível pela URL pública" \
      || fail "URL pública do áudio respondeu HTTP $MEDIA_OK"
    ;;
  *) fail "audio_url não é uma URL pública: $AUDIO_URL" ;;
esac

PUBLIC_ECHO="$(api -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/get_public_echo" \
  -H 'Content-Type: application/json' -d "$(jq -nc --arg id "$ANON_ID" '{p_echo_id:$id}')")"
jq -e --arg id "$ANON_ID" '.[0].id == $id and .[0].public_identity == "Anônimo"' >/dev/null <<<"$PUBLIC_ECHO" \
  && pass "get_public_echo (rota /e/:id)" || fail "get_public_echo: $PUBLIC_ECHO"

REPLIES="$(api -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/get_echo_replies" \
  -H 'Content-Type: application/json' -d "$(jq -nc --arg id "$ANON_ID" '{p_echo_id:$id,p_limit:50}')")"
jq -e 'type == "array"' >/dev/null <<<"$REPLIES" \
  && pass "get_echo_replies responde (thread da conversa)" || fail "get_echo_replies: $REPLIES"

# ---------------------------------------------------------------------------
# 8. Voice, apagar e expiração da mídia.
# ---------------------------------------------------------------------------
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
  VOICE_ECHO_ID="$(jq -r '.id // empty' <<<"$VOICE_ECHO")"
  [ -n "$VOICE_ECHO_ID" ] && pass "publish-echo com Voice" || fail "publish-echo com Voice: $VOICE_ECHO"

  VOICE_PROFILE="$(api -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/get_public_voice" \
    -H 'Content-Type: application/json' -d "$(jq -nc --arg h "$HANDLE" '{p_handle:$h}')")"
  jq -e --arg h "$HANDLE" '.[0].handle == $h' >/dev/null <<<"$VOICE_PROFILE" \
    && pass "perfil público /v/:handle" || fail "get_public_voice: $VOICE_PROFILE"

  if [ -n "$VOICE_ECHO_ID" ]; then
    api -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/delete_echo" -H 'Content-Type: application/json' \
      -d "$(jq -nc --arg id "$VOICE_ECHO_ID" '{p_echo_id:$id}')" >/dev/null
    DELETED="$(sql "select status || '|' || (expires_at <= now())::text from public.audio_posts where id = '$VOICE_ECHO_ID';")"
    [ "$DELETED" = "deleted|true" ] && pass "delete_echo marca como apagado e expira a mídia" \
      || fail "delete_echo deixou o Echo em '$DELETED'"
  fi
fi

log "forçando expiração do Echo anônimo e rodando o cleanup"
STORAGE_PATH="$(db_psql -tAq -c "select storage_path from public.audio_posts where id = '$ANON_ID';")"
db_psql -q -c "update public.audio_posts set expires_at = now() - interval '1 hour' where id = '$ANON_ID';" >/dev/null
"$(dirname "${BASH_SOURCE[0]}")/cleanup-expired-audios.sh" >/dev/null

STATUS_AFTER="$(sql "select status from public.audio_posts where id = '$ANON_ID';")"
[ "$STATUS_AFTER" = "expired" ] && pass "Echo marcado como expired" || fail "status após cleanup: $STATUS_AFTER"

MEDIA_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
  "$PUBLIC_SUPABASE_URL/storage/v1/object/public/echo-audio/$STORAGE_PATH")"
[ "$MEDIA_CODE" = "400" ] || [ "$MEDIA_CODE" = "404" ] \
  && pass "mídia removida do Storage (HTTP $MEDIA_CODE)" \
  || fail "mídia ainda acessível após expiração (HTTP $MEDIA_CODE)"

[ "$failures" -eq 0 ] || die "$failures verificação(ões) funcionais falharam"
log "verificação funcional aprovada"
