import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Transcrição local (faster-whisper) rodando na própria VPS: nenhum áudio sai
// da infraestrutura e não há custo por minuto. O serviço aceita
// POST /transcribe {audio_base64, mimetype, filename, language} e devolve {text}.
const STT_URL = (Deno.env.get('STT_URL') ?? 'http://whisper-stt:8000').replace(/\/+$/, '')
const STT_TIMEOUT_MS = Number(Deno.env.get('STT_TIMEOUT_MS') ?? '180000')

/**
 * Confere a sessão pelo endpoint de usuário do GoTrue.
 * Um `fetch` evita carregar o supabase-js: só o import do SDK já consumia o
 * orçamento de CPU do worker e derrubava a requisição.
 */
async function getUserId(supabaseUrl: string, anonKey: string, authorization: string): Promise<string | null> {
  if (!authorization) return null
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authorization },
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return null
    const user = await response.json() as { id?: string }
    return user.id ?? null
  } catch {
    return null
  }
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) {
    return new Response(JSON.stringify({ error: 'Configuração do servidor indisponível.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Transcrever custa CPU da VPS: exigir sessão, como as demais Functions de usuário.
  const userId = await getUserId(supabaseUrl, anonKey, request.headers.get('Authorization') ?? '')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Autenticação obrigatória para transcrever.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const form = await request.formData()
    const audio = form.get('audio')
    if (!(audio instanceof File) || !audio.size) {
      return new Response(JSON.stringify({ error: 'Envie o áudio final para transcrição.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (audio.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'O áudio excede o limite de 10 MB.' }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const payload = {
      audio_base64: encodeBase64(await audio.arrayBuffer()),
      mimetype: audio.type || 'audio/webm',
      filename: audio.name || 'echo-audio.webm',
      language: 'pt',
    }

    // O modelo roda em CPU: um Echo de 60s leva dezenas de segundos.
    const abort = AbortSignal.timeout(STT_TIMEOUT_MS)
    const response = await fetch(`${STT_URL}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: abort,
    })
    if (!response.ok) {
      console.error('transcribe-audio: STT respondeu', response.status)
      throw new Error('Não foi possível transcrever este Echo.')
    }
    const result = await response.json() as { text?: string }
    return new Response(JSON.stringify({ text: (result.text ?? '').trim() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    // Não registrar áudio, texto integral ou identificadores privados em logs.
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    return new Response(
      JSON.stringify({ error: timedOut ? 'A transcrição demorou demais. Tente um Echo mais curto.' : 'Falha de transcrição.' }),
      { status: timedOut ? 504 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
