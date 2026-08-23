import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from '@/integrations/supabase/client'

/**
 * Telemetria do funil de aquisição.
 *
 * Separada de `trackEchoEvent` por dois motivos. O primeiro é de integridade:
 * `echo_events` alimenta o ranking do Discovery, e medição de marketing não
 * pode mexer no que as pessoas veem. O segundo é prático — `record_echo_event`
 * exige sessão, então todo o funil ANTES do cadastro, que é justamente o que
 * precisamos medir, caía num catch silencioso e nunca era registrado.
 */
export type AcquisitionEvent =
  | 'landing_view'
  | 'listen_without_account_click'
  | 'preview_view'
  | 'preview_play'
  | 'preview_complete'
  | 'preview_next'
  | 'preview_gate_reached'
  | 'shared_echo_view'
  | 'shared_echo_play'
  | 'signup_view'
  | 'signup_completed'
  | 'onboarding_completed'
  | 'first_discovery_play'
  | 'first_reaction'
  | 'first_follow'
  | 'first_publish'

const chaveDaSessao = 'shhhh:sessao-aquisicao'
const chaveDosMarcos = 'shhhh:marcos-aquisicao'

/**
 * Sessão do funil vive no localStorage, e não no sessionStorage: o caminho
 * "recebeu link hoje, criou conta amanhã" é exatamente o que queremos enxergar,
 * e ele atravessa fechamentos de aba.
 */
function idDaSessao(): string {
  try {
    const existente = localStorage.getItem(chaveDaSessao)
    if (existente) return existente
    const gerado = crypto.randomUUID()
    localStorage.setItem(chaveDaSessao, gerado)
    return gerado
  } catch {
    // Navegador com armazenamento bloqueado ainda envia eventos, só não os
    // costura numa jornada. Melhor medir mal do que impedir a pessoa de ouvir.
    return crypto.randomUUID()
  }
}

/**
 * Só o host de onde a pessoa veio, nunca a URL inteira.
 *
 * Um referrer completo carrega caminho, query string e às vezes identificador
 * de quem compartilhou — informação que não precisamos para saber que a visita
 * veio do WhatsApp. Guardar o mínimo que responde à pergunta.
 */
function origemAproximada(): string | null {
  if (typeof document === 'undefined' || !document.referrer) return null
  try {
    const url = new URL(document.referrer)
    if (url.host === window.location.host) return 'interno'
    return url.host.slice(0, 100)
  } catch {
    return null
  }
}

async function enviar(evento: AcquisitionEvent, echoId?: string | null, origem?: string | null) {
  const { data } = await supabase.auth.getSession()
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_acquisition_event`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${data.session?.access_token ?? SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_session_id: idDaSessao(),
      p_event_type: evento,
      p_echo_id: echoId ?? null,
      p_source: origem ?? origemAproximada(),
    }),
  })
}

export function trackAcquisition(evento: AcquisitionEvent, echoId?: string | null, origem?: string | null): void {
  void enviar(evento, echoId, origem).catch(() => {
    // Telemetria nunca pode impedir alguém de ouvir, publicar ou se cadastrar.
  })
}

/** Marcos que só valem a primeira vez ("primeira reação", "primeiro publish"). */
export function trackAcquisitionOnce(evento: AcquisitionEvent, echoId?: string | null): void {
  try {
    const brutos = localStorage.getItem(chaveDosMarcos)
    const marcos: string[] = brutos ? JSON.parse(brutos) : []
    if (marcos.includes(evento)) return
    localStorage.setItem(chaveDosMarcos, JSON.stringify([...marcos, evento]))
  } catch {
    // Sem armazenamento, o marco pode repetir. A consulta do funil conta
    // sessões distintas, então o efeito é pequeno.
  }
  trackAcquisition(evento, echoId)
}
