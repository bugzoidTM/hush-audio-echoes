#!/usr/bin/env bash
# Verificação do gate de aceite. Registrar o aceite no cadastro não é o mesmo
# que exigi-lo depois: o que se prova aqui é que a conta sem aceite VIGENTE é
# reconhecida como tal, que as três versões contam (não só a dos Termos) e que
# ninguém responde "em dia" por engano — nem o visitante, nem quem chama a
# função pela metade.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

command -v jq >/dev/null || die "jq é necessário"

ANON_KEY="$(service_env functions SUPABASE_ANON_KEY)"
SERVICE_KEY="$(service_env functions SUPABASE_SERVICE_ROLE_KEY)"
STAMP="$(date -u +%Y%m%d%H%M%S)"; USER_ID=""; failures=0

cleanup() {
  if [ -n "$USER_ID" ]; then
    curl -s -o /dev/null -X DELETE "$PUBLIC_SUPABASE_URL/auth/v1/admin/users/$USER_ID" \
      -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" || true
  fi
}
trap cleanup EXIT
pass() { printf 'ok    %s\n' "$1"; }
fail() { printf 'FALHA %s\n' "$1"; failures=$((failures+1)); }

PASSWORD="$(head -c 18 /dev/urandom | base64 | tr -d '/+=')Aa1!"
EMAIL="shhhh-aceite-$STAMP@example.invalid"
USER_ID="$(curl -s -X POST "$PUBLIC_SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e,password:$p,email_confirm:true}')" | jq -r '.id')"
[ -n "$USER_ID" ] && [ "$USER_ID" != "null" ] || die "não foi possível criar a conta de teste"
TOKEN="$(mint_user_token "$USER_ID")"

# Chamada como a do app: sempre com as três versões.
verificar() {
  curl -s -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/has_current_legal_acceptance" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer ${2:-$TOKEN}" -H 'Content-Type: application/json' \
    -d "$1"
}
VIGENTES='{"p_terms_version":"1.0","p_privacy_version":"1.0","p_guidelines_version":"1.0"}'

# ---------------------------------------------------------------------------
# 1. Conta nova, sem aceite nenhum
# ---------------------------------------------------------------------------
[ "$(verificar "$VIGENTES")" = "false" ] \
  && pass "conta sem aceite é reconhecida como fora de dia" \
  || fail "conta recém-criada passou como em dia"

# ---------------------------------------------------------------------------
# 2. Aceite registrado
# ---------------------------------------------------------------------------
REGISTRO="$(curl -s -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/record_legal_acceptance" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"p_terms_version":"1.0","p_privacy_version":"1.0","p_guidelines_version":"1.0","p_adult_declared":true}')"
grep -q '"' <<<"$REGISTRO" && pass "aceite registrado ($REGISTRO)" || fail "registro do aceite: $REGISTRO"
[ "$(verificar "$VIGENTES")" = "true" ] \
  && pass "com as três versões aceitas, a conta está em dia" \
  || fail "aceite registrado e a conta continua fora de dia"

# ---------------------------------------------------------------------------
# 3. Documento novo, aceite velho — o caso que motivou o gate
# ---------------------------------------------------------------------------
for doc in privacy guidelines terms; do
  CORPO="$(jq -nc --arg d "$doc" '
    {p_terms_version:"1.0",p_privacy_version:"1.0",p_guidelines_version:"1.0"}
    | .["p_" + $d + "_version"] = "2.0"')"
  [ "$(verificar "$CORPO")" = "false" ] \
    && pass "publicar $doc 2.0 volta a pedir aceite" \
    || fail "$doc 2.0 continuou respondendo em dia — o gate não pegaria a mudança"
done

# ---------------------------------------------------------------------------
# 4. Quem não pode perguntar
# ---------------------------------------------------------------------------
VISITANTE="$(verificar "$VIGENTES" "$ANON_KEY")"
jq -e '(.code // "") == "42501" or ((.message // "") | test("permission denied"))' >/dev/null <<<"$VISITANTE" \
  && pass "visitante não executa a verificação" || fail "anon executou a verificação: $VISITANTE"

# Sem DEFAULT nos argumentos: a chamada pela metade não existe, em vez de ser
# comparada a uma versão velha embutida na função.
PELA_METADE="$(verificar '{"p_terms_version":"1.0"}')"
jq -e '(.code // "") == "PGRST202"' >/dev/null <<<"$PELA_METADE" \
  && pass "chamada sem as três versões falha fechado" || fail "chamada incompleta respondeu: $PELA_METADE"

# ---------------------------------------------------------------------------
# 5. Painel de moderação
# ---------------------------------------------------------------------------
CONTAGEM="$(curl -s -X POST "$PUBLIC_SUPABASE_URL/rest/v1/rpc/accounts_missing_acceptance" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$VIGENTES")"
jq -e '(.code // "") == "42501"' >/dev/null <<<"$CONTAGEM" \
  && pass "contagem de pendências exige moderação" || fail "conta comum leu a contagem: $CONTAGEM"

PENDENTES="$(db_psql -tAq -c "select count(*) from auth.users u where not exists (
  select 1 from public.legal_acceptances l where l.user_id = u.id
    and l.terms_version = '1.0' and l.privacy_version = '1.0'
    and l.guidelines_version = '1.0' and l.adult_declared);" | tr -d '\r\n')"
log "contas sem aceite vigente hoje: $PENDENTES (verão o modal na próxima visita)"

[ "$failures" -eq 0 ] || die "$failures verificação(ões) do gate de aceite falharam"
log "gate de aceite aprovado"
