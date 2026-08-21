import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function createHook(transcription: string): string {
  const normalized = transcription.replace(/\s+/g, ' ').trim()
  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] ?? normalized
  const clean = firstSentence.replace(/^["'“”]+|["'“”]+$/g, '').trim()
  if (clean.length <= 140) return clean
  return `${clean.slice(0, 137).trimEnd()}…`
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

  return new Response(JSON.stringify({ hook: createHook(transcription) }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
