#!/usr/bin/env bash
# Verificação dos direitos do titular (LGPD art. 18): exportação e exclusão de
# conta. Cria uma conta descartável, publica, exporta, exclui e confere o que
# sobrou — inclusive se a mídia saiu do armazenamento.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

command -v jq >/dev/null || die "jq é necessário"
command -v ffmpeg >/dev/null || die "ffmpeg é necessário"

ANON_KEY="$(service_env functions SUPABASE_ANON_KEY)"
SERVICE_KEY="$(service_env functions SUPABASE_SERVICE_ROLE_KEY)"
WORK="$(mktemp -d)"; STAMP="$(date -u +%Y%m%d%H%M%S)"; USER_ID=""; failures=0

cleanup() {
  if [ -n "$USER_ID" ]; then
    db_psql -q -c "delete from public.audio_posts where owner_user_id = '$USER_ID';" >/dev/null 2>&1 || true
    curl -s -o /dev/null -X DELETE "$PUBLIC_SUPABASE_URL/auth/v1/admin/users/$USER_ID" \
      -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT
pass() { printf 'ok    %s\n' "$1"; }
fail() { printf 'FALHA %s\n' "$1"; failures=$((failures+1)); }
sql() { db_psql -tAq -v ON_ERROR_STOP=1 -c "$1" | tr -d '\r\n'; }

PASSWORD="$(head -c 18 /dev/urandom | base64 | tr -d '/+=')Aa1!"
EMAIL="shhhh-direitos-$STAMP@example.invalid"
USER_ID="$(curl -s -X POST "$PUBLIC_SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e,password:$p,email_confirm:true}')" | jq -r '.id')"
TOKEN="$(mint_user_token "$USER_ID")"
[ -n "$TOKEN" ] || die "não foi possível autenticar a conta de teste"
api() { curl -s -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" "$@"; }

log "publicando um Echo e criando uma Voice"
ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=440:duration=8" -c:a libopus -b:a 24k "$WORK/e.webm"
CATEGORY_ID="$(api "$PUBLIC_SUPABASE_URL/rest/v1/categories?select=id&limit=1" | jq -r '.[0].id')"
api -X POST "$PUBLIC_SUPABASE_URL/rest/v1/voices" -H 'Content-Type: application/json' -H 'Prefer: return=minimal' \
  -d "$(jq -nc --arg u "$USER_ID" --arg h "@dir$STAMP" '{owner_user_id:$u,handle:$h,display_name:"Voz de direitos"}')" >/dev/null
ECHO_ID="$(api -X POST "$PUBLIC_SUPABASE_URL/functions/v1/publish-echo" \
  -F "audio=@$WORK/e.webm;type=audio/webm" -F 'duration=8' -F 'identity_mode=anonymous' \
  -F "category_id=$CATEGORY_ID" -F 'expiration=permanent' -F 'voice_protection_enabled=false' \
  -F 'title=Echo dos direitos' | jq -r '.id')"
sql "select public.apply_server_moderation('$ECHO_ID'::uuid,'texto de servidor para o teste','server_stt');" >/dev/null
STORAGE_PATH="$(sql "select storage_path from public.audio_posts where id = '$ECHO_ID';")"

# ---------------------------------------------------------------------------
# 1. Portabilidade
# ---------------------------------------------------------------------------
EXPORT="$(api -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/export_my_data" -H 'Content-Type: application/json' -d '{}')"
jq -e --arg e "$EMAIL" '.conta.email == $e' >/dev/null <<<"$EXPORT" \
  && pass "exportação traz a conta do titular" || fail "exportação sem conta: $(head -c 200 <<<"$EXPORT")"
jq -e --arg id "$ECHO_ID" '.echoes | any(.id == $id and .transcricao != null)' >/dev/null <<<"$EXPORT" \
  && pass "exportação traz o Echo com a transcrição" || fail "Echo ausente da exportação"
jq -e '.voices | length >= 1' >/dev/null <<<"$EXPORT" \
  && pass "exportação traz as Voices" || fail "Voices ausentes da exportação"

OUTRO="$(curl -s -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/export_my_data" -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" -H 'Content-Type: application/json' -d '{}')"
jq -e '.code == "42501" or (.message // "" | test("Autentica"))' >/dev/null <<<"$OUTRO" \
  && pass "exportação exige sessão" || fail "visitante exportou dados: $OUTRO"

# ---------------------------------------------------------------------------
# 2. Exclusão
# ---------------------------------------------------------------------------
SENHA_ERRADA="$(api -X POST "$PUBLIC_SUPABASE_URL/functions/v1/delete-account" -H 'Content-Type: application/json' \
  -d '{"password":"senha-errada-de-proposito"}')"
jq -e '.error != null' >/dev/null <<<"$SENHA_ERRADA" \
  && pass "exclusão recusada com senha errada" || fail "exclusão aceitou senha errada"

# Sessão roubada não pode virar oráculo de senha: a reconfirmação é limitada.
LIMITE_SENHA=""
for tentativa in 2 3 4 5 6; do
  LIMITE_SENHA="$(api -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/verify_my_password" -H 'Content-Type: application/json' \
    -d '{"p_password":"chute-de-forca-bruta"}')"
done
jq -e '(.code // "") == "PT429" or ((.message // "") | test("Limite"))' >/dev/null <<<"$LIMITE_SENHA" \
  && pass "tentativas de senha são limitadas (força bruta barrada)" \
  || fail "verify_my_password aceitou tentativas sem limite: $(head -c 120 <<<"$LIMITE_SENHA")"

# O limite não pode trancar o titular fora da própria exclusão logo em seguida.
db_psql -q -c "delete from public.rate_limit_hits where user_id = '$USER_ID' and action = 'password_check';" >/dev/null

# Telemetria de funil vinculada à conta, para conferir a anonimização depois.
api -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/record_acquisition_event" -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg s "sessao-teste-$STAMP" '{p_session_id:$s,p_event_type:"signup_completed"}')" >/dev/null
EVENTOS_ANTES="$(sql "select count(*) from public.acquisition_events where user_id = '$USER_ID';")"
[ "$EVENTOS_ANTES" -ge 1 ] && pass "evento de aquisição gravado com a conta" || fail "evento de aquisição não foi gravado"
AINDA_EXISTE="$(sql "select count(*) from public.audio_posts where owner_user_id = '$USER_ID' and status <> 'deleted';")"
[ "$AINDA_EXISTE" = "1" ] && pass "nada foi apagado na tentativa recusada" || fail "tentativa recusada apagou dados"

EXCLUSAO="$(api -X POST "$PUBLIC_SUPABASE_URL/functions/v1/delete-account" -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg p "$PASSWORD" '{password:$p}')")"
jq -e '.ok == true' >/dev/null <<<"$EXCLUSAO" && pass "exclusão confirmada com a senha correta" || fail "exclusão: $EXCLUSAO"

RESTOU="$(sql "select
  (select count(*) from public.audio_posts where owner_user_id = '$USER_ID' and status <> 'deleted')::text || '|' ||
  (select count(*) from public.voices where owner_user_id = '$USER_ID' and status <> 'deleted')::text || '|' ||
  (select count(*) from public.echo_reactions where user_id = '$USER_ID')::text || '|' ||
  (select count(*) from auth.users where id = '$USER_ID')::text;")"
[ "$RESTOU" = "0|0|0|0" ] && pass "Echoes, Voices, reações e conta de acesso removidos" \
  || fail "sobrou algo após a exclusão (echoes|voices|reacoes|conta): $RESTOU"

# Anonimizar, não apagar: "uma sessão chegou ao cadastro" continua verdade sem
# guardar de quem era a conta.
FUNIL_DEPOIS="$(sql "select
  (select count(*) from public.acquisition_events where user_id = '$USER_ID')::text || '|' ||
  (select count(*) from public.acquisition_events where session_id = 'sessao-teste-$STAMP')::text;")"
[ "$FUNIL_DEPOIS" = "0|1" ] && pass "telemetria de funil anonimizada, sem perder a métrica" \
  || fail "telemetria após exclusão (com conta|total da sessão): $FUNIL_DEPOIS"

# O login por senha exige captcha desde que o Turnstile foi ligado, então a
# prova aqui é outra: o token que a conta tinha deixa de valer, porque o usuário
# não existe mais para o GoTrue.
SESSAO_DEPOIS="$(curl -s -o /dev/null -w '%{http_code}' "$PUBLIC_SUPABASE_URL/auth/v1/user" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN")"
[ "$SESSAO_DEPOIS" != "200" ] && pass "a sessão da conta excluída deixou de valer (HTTP $SESSAO_DEPOIS)" \
  || fail "sessão da conta excluída continua válida"

# A mídia sai na passada seguinte do cron — é o mesmo caminho já testado da
# expiração, e não um segundo caminho de exclusão de arquivo.
"$(dirname "${BASH_SOURCE[0]}")/cleanup-expired-audios.sh" >/dev/null 2>&1 || true
MEDIA="$(curl -s -o /dev/null -w '%{http_code}' "$PUBLIC_SUPABASE_URL/storage/v1/object/public/echo-audio/$STORAGE_PATH")"
{ [ "$MEDIA" = "400" ] || [ "$MEDIA" = "404" ]; } && pass "áudio removido do armazenamento (HTTP $MEDIA)" \
  || fail "áudio ainda acessível após a exclusão (HTTP $MEDIA)"

USER_ID=""  # já removido; evita erro no cleanup
[ "$failures" -eq 0 ] || die "$failures verificação(ões) de direitos falharam"
log "verificação de direitos do titular aprovada"
