/**
 * Cloudflare Turnstile no cadastro.
 *
 * O rate limiting é por conta, e essa é a sua fronteira: um bot que cria uma
 * conta nova a cada 5 publicações troca de identidade e o limite não o alcança.
 * Como o cadastro está aberto e sem confirmação de e-mail (a instância não tem
 * SMTP), o custo de criar identidade é praticamente zero.
 *
 * Turnstile cobre essa camada sem pedir telefone e sem CAPTCHA de charadas.
 * Fica inerte enquanto VITE_TURNSTILE_SITE_KEY não existir: sem a chave o
 * cadastro funciona exatamente como hoje, em vez de quebrar.
 */
const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim()
export const turnstileEnabled = turnstileSiteKey.length > 0

interface TurnstileApi {
  render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void; 'error-callback'?: () => void; theme?: string; size?: string }) => string
  reset: (widgetId?: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let loader: Promise<TurnstileApi | null> | null = null

export function loadTurnstile(): Promise<TurnstileApi | null> {
  if (!turnstileEnabled) return Promise.resolve(null)
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loader) return loader

  loader = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = scriptUrl
    script.async = true
    script.defer = true
    // Falha de rede no script não pode trancar o cadastro: resolve nulo e o
    // formulário segue sem token. Quem decide recusar é o GoTrue, no servidor.
    script.onerror = () => resolve(null)
    script.onload = () => resolve(window.turnstile ?? null)
    document.head.appendChild(script)
  })
  return loader
}
