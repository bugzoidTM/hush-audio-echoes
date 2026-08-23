#!/usr/bin/env bash
# Instala os dois jobs de manutenção do shhhh no host:
#   - expiração de mídia (a cada 15 min)
#   - moderação server-side dos Echoes pendentes (a cada 2 min)
#
# Ambos moram fora do checkout (/usr/local/lib/shhhh) para não dependerem de um
# diretório de trabalho que pode ser movido, e nenhum guarda credencial em disco.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

TARGET_DIR=/usr/local/lib/shhhh
install -d -m 700 "$TARGET_DIR"

for script in cleanup-expired-audios.sh moderate-pending-echoes.sh; do
  install -m 700 "$APP_DIR/scripts/deploy/$script" "$TARGET_DIR/$script"
  log "instalado: $TARGET_DIR/$script"
done

CLEANUP_LINE="*/15 * * * * $TARGET_DIR/cleanup-expired-audios.sh >> /var/log/shhhh-cleanup.log 2>&1"
# A cada 2 minutos: um Echo novo fica invisível até ser moderado, então a espera
# entre publicar e aparecer no Discovery é o intervalo deste job + a transcrição.
MODERATION_LINE="*/2 * * * * flock -n /run/shhhh-moderation.lock $TARGET_DIR/moderate-pending-echoes.sh >> /var/log/shhhh-moderation.log 2>&1"

current="$(crontab -l 2>/dev/null || true)"
updated="$(printf '%s\n' "$current" \
  | grep -v 'cleanup-expired-audios.sh' \
  | grep -v 'moderate-pending-echoes.sh' \
  | sed '/^$/d')"
printf '%s\n%s\n%s\n' "$updated" "$CLEANUP_LINE" "$MODERATION_LINE" | sed '/^$/d' | crontab -

log "crontab atual:"
crontab -l | grep shhhh

log "execução inicial da moderação (a fila pode levar alguns minutos por Echo)"
"$TARGET_DIR/moderate-pending-echoes.sh"
