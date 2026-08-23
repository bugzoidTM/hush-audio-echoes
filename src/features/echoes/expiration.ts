/**
 * Rótulo de expiração do Echo.
 *
 * O rótulo antigo era estático e arredondava para cima: um Echo a 2 minutos do
 * fim exibia "1h restantes". Num produto cujo valor é o áudio sumir, o prazo
 * precisa ser verdadeiro — e precisa andar na tela.
 */
export function formatTimeLeft(expiresAt: string | null, now: number = Date.now()): string {
  if (!expiresAt) return 'Permanente'
  const remaining = new Date(expiresAt).getTime() - now
  if (!Number.isFinite(remaining)) return 'Permanente'
  if (remaining <= 0) return 'Expirado'

  const seconds = Math.floor(remaining / 1000)
  if (seconds < 60) return `${seconds}s restantes`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}min restantes`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const restMinutes = minutes % 60
    return restMinutes ? `${hours}h ${restMinutes}min restantes` : `${hours}h restantes`
  }

  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours ? `${days}d ${restHours}h restantes` : `${days}d restantes`
}

/** Quanto esperar até o rótulo mudar: de segundo em segundo só no fim. */
export function refreshIntervalFor(expiresAt: string | null, now: number = Date.now()): number | null {
  if (!expiresAt) return null
  const remaining = new Date(expiresAt).getTime() - now
  if (remaining <= 0) return null
  if (remaining < 60_000) return 1_000
  if (remaining < 3_600_000) return 30_000
  return 60_000
}
