#!/usr/bin/env bash
# Passo 8 do runbook: verificações de saúde que não exigem sessão de usuário.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

ANON_KEY="$(service_env functions SUPABASE_ANON_KEY)"
[ -n "$ANON_KEY" ] || die "SUPABASE_ANON_KEY não encontrada no serviço functions"

check() {
  local label="$1" expected="$2"; shift 2
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "$@")"
  if [ "$code" = "$expected" ]; then
    printf 'ok    %-42s HTTP %s\n' "$label" "$code"
  else
    printf 'FALHA %-42s HTTP %s (esperado %s)\n' "$label" "$code" "$expected"
    return 1
  fi
}

failures=0
check 'functions/hello (roteamento)' 200 \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  "$PUBLIC_SUPABASE_URL/functions/v1/hello" || failures=$((failures+1))

check 'rest/v1/categories (RLS pública)' 200 \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  "$PUBLIC_SUPABASE_URL/rest/v1/categories?select=slug&limit=1" || failures=$((failures+1))

# discovery-feed exige sessão de usuário: com anon deve recusar, não vazar feed.
check 'discovery-feed sem sessão (deve recusar)' 401 \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  "$PUBLIC_SUPABASE_URL/functions/v1/discovery-feed" || failures=$((failures+1))

# cleanup só aceita a chave server-side.
check 'cleanup com anon (deve recusar)' 401 \
  -X POST -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  "$PUBLIC_SUPABASE_URL/functions/v1/cleanup-expired-audios" || failures=$((failures+1))

check 'moderate-echo sem sessão (deve recusar)' 401 \
  -X POST -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H 'Content-Type: application/json' -d '{}' \
  "$PUBLIC_SUPABASE_URL/functions/v1/moderate-echo" || failures=$((failures+1))

log "verificando expiração pelo caminho administrativo"
"$(dirname "${BASH_SOURCE[0]}")/cleanup-expired-audios.sh" || failures=$((failures+1))

[ "$failures" -eq 0 ] || die "$failures verificação(ões) falharam"
log "smoke tests de infraestrutura aprovados"
