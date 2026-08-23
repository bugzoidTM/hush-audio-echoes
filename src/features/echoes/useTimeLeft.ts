import { useEffect, useState } from 'react'
import { formatTimeLeft, refreshIntervalFor } from './expiration'

/**
 * Rótulo de expiração que anda sozinho. Sem isto o card mostrava o prazo do
 * momento em que foi renderizado e nunca mais mudava — quem deixasse o feed
 * aberto via "3h restantes" num Echo já expirado.
 */
export function useTimeLeft(expiresAt: string | null): string {
  const [label, setLabel] = useState(() => formatTimeLeft(expiresAt))

  useEffect(() => {
    setLabel(formatTimeLeft(expiresAt))
    const interval = refreshIntervalFor(expiresAt)
    if (!interval) return
    const timer = setInterval(() => setLabel(formatTimeLeft(expiresAt)), interval)
    return () => clearInterval(timer)
  }, [expiresAt])

  return label
}
