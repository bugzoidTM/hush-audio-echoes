#!/usr/bin/env bash
# Moderação server-side dos Echoes pendentes (rodar a cada 2 minutos).
#
# Por que no host e não em Edge Function: a transcrição roda no whisper local em
# CPU e leva de dezenas de segundos a minutos por Echo, enquanto o Kong corta
# qualquer requisição em 60 s. Aqui não há Kong no caminho — o script fala com o
# Postgres e com o whisper por dentro do Docker.
#
# Fail closed em todos os caminhos: um Echo só sai de 'pending' com transcrição
# feita a partir do áudio publicado; se a transcrição falhar três vezes, ele vai
# para 'review_required' (fila humana), nunca para 'approved'.
set -euo pipefail

SUPABASE_STACK="${SUPABASE_STACK:-supabase}"
PUBLIC_SUPABASE_URL="${PUBLIC_SUPABASE_URL:-https://supabase.nutef.com}"
BATCH="${SHHHH_MODERATION_BATCH:-5}"
# Limite real do Echo. A duração que chega no publish-echo é declarada pelo
# cliente: um cliente modificado manda 30 minutos dizendo 30 segundos, e o
# whisper em CPU passa meia hora mastigando o arquivo. Aqui o áudio publicado é
# medido antes de qualquer transcrição.
MAX_DURATION="${SHHHH_MAX_DURATION_SECONDS:-60}"
DURATION_TOLERANCE="${SHHHH_DURATION_TOLERANCE:-3}"
TELEGRAM_TOKEN_FILE="${SHHHH_TELEGRAM_TOKEN_FILE:-/root/.shhhh-telegram-token}"
TELEGRAM_CHAT_ID="${SHHHH_TELEGRAM_CHAT_ID:-1610680538}"

log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*"; }

container_of() {
  local pattern="$1" id
  id="$(docker ps -q --filter "name=${pattern}" | head -n1)"
  [ -n "$id" ] || { log "ERRO: container ${pattern} não encontrado"; exit 1; }
  printf '%s' "$id"
}

DB_CONTAINER="$(container_of "^/${SUPABASE_STACK}_db\.")"
WHISPER_CONTAINER="$(container_of "whisper-stt")"

db_psql() {
  # sem -i: dentro do laço o stdin pertence à fila lida por `read`.
  docker exec "$DB_CONTAINER" \
    psql -h 127.0.0.1 -U "${SUPABASE_DB_ADMIN:-supabase_admin}" -d postgres -v ON_ERROR_STOP=1 "$@"
}

# Consulta com variáveis (:'nome'). O SQL vai pelo stdin porque em `-c` o psql
# manda a string crua ao servidor, sem interpolar variável alguma — era isso que
# quebrava a moderação com "syntax error at or near \":\"". O here-string
# alimenta só este comando, então a fila lida pelo laço continua intacta.
db_psql_vars() {
  local sql="$1"; shift
  docker exec -i "$DB_CONTAINER" \
    psql -h 127.0.0.1 -U "${SUPABASE_DB_ADMIN:-supabase_admin}" -d postgres -v ON_ERROR_STOP=1 -At "$@" -f - <<<"$sql"
}

notify() {
  local message="$1" token
  [ -f "$TELEGRAM_TOKEN_FILE" ] || return 0
  token="$(tr -d '\r\n' < "$TELEGRAM_TOKEN_FILE")"
  [ -n "$token" ] || return 0
  curl -s -X POST "https://api.telegram.org/bot${token}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" --data-urlencode "text=${message}" >/dev/null || true
}

# Duração real do arquivo, em segundos inteiros (0 se não der para medir).
probe_duration() {
  local file="$1" seconds
  seconds="$(docker exec -i "$WHISPER_CONTAINER" ffprobe -v error -show_entries format=duration \
    -of default=noprint_wrappers=1:nokey=1 - < "$file" 2>/dev/null | head -n1)"
  printf '%.0f' "${seconds:-0}" 2>/dev/null || printf '0'
}

# Transcrição de um arquivo local usando o whisper da VPS.
# O áudio é normalizado antes: com pico baixo o VAD do faster-whisper não
# reconhece fala e devolve texto vazio — o que aqui significaria fila humana à toa.
transcribe() {
  local file="$1"
  docker cp "$file" "${WHISPER_CONTAINER}:/tmp/shhhh-moderation-input" >/dev/null
  docker exec -i "$WHISPER_CONTAINER" python3 - <<'PY'
import base64, json, subprocess, sys, tempfile, urllib.request

source = "/tmp/shhhh-moderation-input"
with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as handle:
    normalized = handle.name

result = subprocess.run(
    ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", source,
     "-vn", "-ac", "1", "-ar", "16000", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
     "-f", "wav", normalized],
    capture_output=True, text=True, timeout=180,
)
if result.returncode != 0:
    print("ERRO: ffmpeg falhou: " + result.stderr[-200:].replace("\n", " "), file=sys.stderr)
    sys.exit(2)

with open(normalized, "rb") as handle:
    payload = json.dumps({
        "audio_base64": base64.b64encode(handle.read()).decode("ascii"),
        "mimetype": "audio/wav",
        "filename": "echo-audio.wav",
        "language": "pt",
    }).encode("utf-8")

request = urllib.request.Request(
    "http://localhost:8000/transcribe", data=payload,
    headers={"Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(request, timeout=600) as response:
        body = json.loads(response.read().decode("utf-8"))
except Exception as error:  # noqa: BLE001 - qualquer falha vira nova tentativa
    print(f"ERRO: whisper indisponível: {error}", file=sys.stderr)
    sys.exit(3)

# Só o texto vai para stdout; nada de áudio ou identificadores em log.
sys.stdout.write((body.get("text") or "").strip())
PY
}

queue="$(db_psql -At -F'|' -c "SELECT id, storage_path FROM public.get_moderation_queue(${BATCH});")"

if [ -z "$queue" ]; then
  log "fila vazia"
else
  workdir="$(mktemp -d)"
  trap 'rm -rf "$workdir"' EXIT

  while IFS='|' read -r echo_id storage_path; do
    [ -n "$echo_id" ] || continue
    audio="$workdir/audio.bin"
    if ! curl --fail --silent --show-error --max-time 120 -o "$audio" \
        "${PUBLIC_SUPABASE_URL}/storage/v1/object/public/echo-audio/${storage_path}"; then
      log "echo ${echo_id}: download falhou"
      db_psql_vars "SELECT public.apply_server_moderation(:'echo_id'::uuid, NULL, 'server_stt', :'note');" \
        -v echo_id="$echo_id" -v note="download do áudio publicado falhou" >/dev/null
      continue
    fi

    # Antes de transcrever: o áudio publicado cabe no limite? Um arquivo mais
    # longo que o teto não é erro de transcrição — é conteúdo fora da regra, e
    # vai direto para revisão humana sem consumir o whisper.
    real_duration="$(probe_duration "$audio")"
    if [ "${real_duration:-0}" -gt "$((MAX_DURATION + DURATION_TOLERANCE))" ]; then
      log "echo ${echo_id}: ${real_duration}s excede o limite de ${MAX_DURATION}s — sem transcrição"
      db_psql_vars "SELECT public.flag_oversized_echo(:'echo_id'::uuid, :duration::integer, :maxdur::integer);" \
        -v echo_id="$echo_id" -v duration="$real_duration" -v maxdur="$MAX_DURATION" >/dev/null
      notify "shhhh: Echo enviado com ${real_duration}s (limite ${MAX_DURATION}s) foi barrado sem transcrever. Cliente modificado ou limite furado no app."
      continue
    fi

    if ! text="$(transcribe "$audio" 2>"$workdir/stderr")"; then
      reason="$(tr -d '\n' < "$workdir/stderr" | tail -c 300)"
      log "echo ${echo_id}: transcrição falhou (${reason:-sem detalhe})"
      db_psql_vars "SELECT public.apply_server_moderation(:'echo_id'::uuid, NULL, 'server_stt', :'note');" \
        -v echo_id="$echo_id" -v note="${reason:-falha de transcrição}" >/dev/null
      continue
    fi

    decision="$(db_psql_vars "SELECT public.apply_server_moderation(:'echo_id'::uuid, :'transcription', 'server_stt');" \
      -v echo_id="$echo_id" -v transcription="$text")"
    # O texto transcrito não vai para o log: é conteúdo de desabafo.
    log "echo ${echo_id}: ${decision} (${#text} caracteres transcritos)"
  done <<< "$queue"
fi

# Falha silenciosa é o modo de falha perigoso aqui: sem worker, todo Echo novo
# fica invisível para sempre. Se a fila envelhecer, o dono é avisado.
stuck="$(db_psql -At -c "
  SELECT count(*) FROM public.audio_posts
  WHERE moderation_status = 'pending' AND status = 'active'
    AND published_at < now() - interval '30 minutes';")"
if [ "${stuck:-0}" -gt 0 ]; then
  log "ALERTA: ${stuck} Echo(s) pendentes há mais de 30 minutos"
  notify "shhhh: ${stuck} Echo(s) presos em moderação pendente há mais de 30 min. Rodar /usr/local/lib/shhhh/moderate-pending-echoes.sh à mão e conferir o whisper-stt."
fi
