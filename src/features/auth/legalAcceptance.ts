import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from '@/integrations/supabase/client'

/**
 * Versões dos documentos aceitos no cadastro.
 *
 * A caixa "declaro que tenho 18 anos e aceito os Termos" era validação de HTML
 * e nada mais — nada ficava registrado. Como os próprios Termos prometem avisar
 * sobre mudanças relevantes, sem versão guardada não haveria como saber quem
 * precisa aceitar de novo. Ao publicar uma alteração relevante, suba o número
 * correspondente aqui e na data do documento.
 */
export const DOCUMENT_VERSIONS = {
  terms: '1.0',
  privacy: '1.0',
  guidelines: '1.0',
} as const

/** Aceite a partir da sessão atual — usado pelo gate dentro do produto. */
export async function acceptCurrentDocuments(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada. Entre novamente para aceitar.')
  await recordLegalAcceptance(token)
}

export async function recordLegalAcceptance(accessToken: string): Promise<void> {
  // `fetch` só rejeita em falha de rede: um 400 ou 500 resolvia normalmente, o
  // `.catch` de quem chama nunca rodava e o app seguia achando que o aceite
  // tinha sido registrado. Uma falha dessas só apareceria num pedido judicial.
  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_legal_acceptance`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_terms_version: DOCUMENT_VERSIONS.terms,
      p_privacy_version: DOCUMENT_VERSIONS.privacy,
      p_guidelines_version: DOCUMENT_VERSIONS.guidelines,
      p_adult_declared: true,
    }),
  })

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '')
    throw new Error(`aceite não registrado (HTTP ${resposta.status}) ${detalhe}`.trim())
  }
}

/**
 * A conta está em dia com as três versões vigentes?
 *
 * As três, e não só os Termos: publicar uma Privacidade 2.0 mantendo os Termos
 * em 1.0 continuaria respondendo "em dia" — exatamente o caso em que é preciso
 * pedir aceite de novo.
 */
export async function hasCurrentLegalAcceptance(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  // Sem sessão não há o que verificar: a função é `authenticated` e responde
  // 403 ao anon. Quem não entrou não vê o gate — ele só existe dentro do app.
  if (!token) return false

  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/has_current_legal_acceptance`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_terms_version: DOCUMENT_VERSIONS.terms,
      p_privacy_version: DOCUMENT_VERSIONS.privacy,
      p_guidelines_version: DOCUMENT_VERSIONS.guidelines,
    }),
  })
  if (!resposta.ok) return false
  return (await resposta.json()) === true
}
