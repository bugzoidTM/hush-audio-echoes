import 'https://deno.land/x/xhr@0.1.0/mod.ts'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const form = await request.formData()
    const audio = form.get('audio')
    if (!(audio instanceof File) || !audio.size) {
      return new Response(JSON.stringify({ error: 'Envie o áudio final para transcrição.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) throw new Error('Serviço de transcrição indisponível.')

    const transcriptionForm = new FormData()
    transcriptionForm.append('file', audio, audio.name || 'echo-audio.webm')
    transcriptionForm.append('model', 'whisper-1')
    transcriptionForm.append('language', 'pt')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      body: transcriptionForm,
    })
    if (!response.ok) throw new Error('Não foi possível transcrever este Echo.')
    const result = await response.json() as { text?: string }
    return new Response(JSON.stringify({ text: result.text ?? '' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    // Não registrar áudio, texto integral ou identificadores privados em logs.
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Falha de transcrição.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
