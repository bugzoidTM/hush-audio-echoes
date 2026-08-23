import { useEffect, useRef } from 'react'
import { loadTurnstile, turnstileEnabled, turnstileSiteKey } from './turnstile'

/**
 * Widget do Turnstile. Não renderiza nada quando a chave não está configurada,
 * para que o cadastro continue funcionando em desenvolvimento e no E2E.
 */
export function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const container = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!turnstileEnabled) return
    let widgetId: string | undefined
    let cancelado = false

    void loadTurnstile().then((turnstile) => {
      if (!turnstile || cancelado || !container.current) return
      widgetId = turnstile.render(container.current, {
        sitekey: turnstileSiteKey,
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
        size: 'flexible',
      })
    })

    return () => {
      cancelado = true
      if (widgetId && window.turnstile) window.turnstile.reset(widgetId)
    }
  }, [onToken])

  if (!turnstileEnabled) return null
  return <div ref={container} className="flex justify-center" aria-label="Verificação de segurança" />
}
