import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// LLM gratuito hospedado na própria VPS, com API compatível com a da OpenAI.
// Se estiver fora do ar ou demorar, cai no resumo local — a sugestão de chamada
// é opcional na interface e nunca deve impedir a publicação.
const HOOK_API_URL = Deno.env.get('HOOK_API_URL') ?? 'http://chatgptproxy:3000/v1/chat/completions'
const HOOK_API_KEY = Deno.env.get('HOOK_API_KEY') ?? ''
const HOOK_MODEL = Deno.env.get('HOOK_MODEL') ?? 'gpt-5'
// O Kong corta a requisição em 60 s. O teto abaixo garante que a Function
// devolva o resumo local antes disso, em vez de o usuário receber um erro.
const HOOK_TIMEOUT_MS = Number(Deno.env.get('HOOK_TIMEOUT_MS') ?? '50000')

const PROMPT = [
  'Você escreve a chamada de um áudio anônimo em português do Brasil.',
  'Responda com UMA frase de no máximo 100 caracteres, sem aspas, sem emoji e sem hashtag.',
  'A frase desperta curiosidade sem entregar o desfecho e não inventa nada que não esteja na transcrição.',
  'Não use nomes próprios, telefones, endereços nem qualquer dado que identifique alguém.',
].join(' ')

function trimHook(value: string): string {
  const clean = value.replace(/\s+/g, ' ').replace(/^["'“”]+|["'“”]+$/g, '').trim()
  if (clean.length <= 140) return clean
  return `${clean.slice(0, 137).trimEnd()}…`
}

/** Resumo local: primeira frase da transcrição. Sempre disponível. */
function createHook(transcription: string): string {
  const normalized = transcription.replace(/\s+/g, ' ').trim()
  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] ?? normalized
  return trimHook(firstSentence)
}

async function createHookWithLlm(transcription: string): Promise<string | null> {
  try {
    const response = await fetch(HOOK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(HOOK_API_KEY ? { Authorization: `Bearer ${HOOK_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: HOOK_MODEL,
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: transcription.slice(0, 4000) },
        ],
      }),
      signal: AbortSignal.timeout(HOOK_TIMEOUT_MS),
    })
    if (!response.ok) {
      console.error('generate-echo-hook: LLM respondeu', response.status)
      return null
    }
    const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = result.choices?.[0]?.message?.content?.trim()
    if (!content) return null
    // Modelos com "pensamento" às vezes devolvem várias linhas: fica a primeira.
    const hook = trimHook(content.split('\n').map((line) => line.trim()).filter(Boolean)[0] ?? content)
    return hook.length >= 8 ? hook : null
  } catch (error) {
    console.error('generate-echo-hook: LLM indisponível', error instanceof Error ? error.name : 'erro')
    return null
  }
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const body = await request.json().catch(() => null) as { transcription?: string } | null
  const transcription = body?.transcription?.trim()
  if (!transcription) {
    return new Response(JSON.stringify({ error: 'Transcrição obrigatória.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // `source` diz ao cliente se vale substituir a chamada que ele já mostrou:
  // o resumo local ele mesmo calcula, na hora.
  const generated = await createHookWithLlm(transcription)
  const hook = generated ?? createHook(transcription)
  return new Response(JSON.stringify({ hook, source: generated ? 'llm' : 'local' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
