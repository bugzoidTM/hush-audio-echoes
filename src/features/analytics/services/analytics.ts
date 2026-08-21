import { recordEchoEvent } from '@/features/echoes/services/hushApi'
import type { EchoEventType } from '@/features/echoes/types'

const sessionStorageKey = 'shhhh:session-id'

export function getAnalyticsSessionId(): string {
  const existing = sessionStorage.getItem(sessionStorageKey)
  if (existing) return existing
  const generated = crypto.randomUUID()
  sessionStorage.setItem(sessionStorageKey, generated)
  return generated
}

export async function trackEchoEvent(echoId: string, eventType: EchoEventType, position?: number): Promise<void> {
  try {
    await recordEchoEvent(echoId, getAnalyticsSessionId(), eventType, position)
  } catch {
    // Analytics não pode impedir que alguém escute, reaja ou publique.
  }
}

export function trackAppOpen(): void {
  window.dispatchEvent(new CustomEvent('shhhh:analytics', { detail: { type: 'app_open' } }))
}
