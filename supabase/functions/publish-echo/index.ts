import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

type IdentityMode = 'voice' | 'anonymous'
type ProtectionPreset = 'natural' | 'shadow' | 'deep' | 'soft'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const allowedExpirations = new Set(['1h', '6h', '24h', '7d', 'permanent'])
const allowedMimeTypes = new Set(['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg'])

// Limites do Echo. A duração declarada aqui é do cliente e vale como triagem;
// a conferência que vale está no worker (scripts/deploy/moderate-pending-echoes.sh),
// que mede o áudio publicado com ffprobe antes de gastar CPU com transcrição.
const minDurationSeconds = 5
const maxDurationSeconds = 60
const maxAudioBytes = 3 * 1024 * 1024

function toOptionalText(value: FormDataEntryValue | null, maximum: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maximum)
}

function expirationFromChoice(choice: string): string | null {
  const now = Date.now()
  const durationByChoice: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  }
  return choice === 'permanent' ? null : new Date(now + durationByChoice[choice]).toISOString()
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === 'audio/ogg') return 'ogg'
  if (mimeType === 'audio/wav') return 'wav'
  if (mimeType === 'audio/mpeg') return 'mp3'
  return 'webm'
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Configuração do servidor indisponível.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authorization = request.headers.get('Authorization') ?? ''
  const authenticated = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await authenticated.auth.getUser()
  const user = authData.user
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Autenticação obrigatória para publicar.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return new Response(JSON.stringify({ error: 'Envie um formulário de publicação válido.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const audio = form.get('audio')
  const identityMode = form.get('identity_mode')
  const categoryId = form.get('category_id')
  const duration = Number(form.get('duration'))
  const expirationChoice = form.get('expiration') || '24h'
  const protectionEnabled = form.get('voice_protection_enabled') === 'true'
  const protectionPreset = form.get('voice_protection_preset')
  const protectionVerified = form.get('voice_protection_verified') === 'true'
  const voiceId = form.get('voice_id')
  const parentEchoId = form.get('parent_echo_id')
  const title = toOptionalText(form.get('title'), 140)
  const description = toOptionalText(form.get('description'), 500)
  // Texto vindo do navegador: serve de rascunho/UX, jamais de fonte de confiança.
  const transcription = toOptionalText(form.get('transcription'), 10000)

  if (!(audio instanceof File) || audio.size === 0 || !allowedMimeTypes.has(audio.type)) {
    return new Response(JSON.stringify({ error: 'Envie um áudio WebM, OGG, WAV ou MP3 válido.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  // Teto de bytes coerente com 60 s de fala: mesmo em WAV descomprimido
  // (16 kHz mono, 16 bits) 60 s dão ~1,9 MB. Os 10 MB de antes davam espaço
  // para ~55 minutos de opus a 24 kbps — foi assim que um áudio de 30 minutos
  // passou declarando 30 segundos. O teto sozinho não resolve (dá para
  // encodar horas em poucos KB): quem fecha o buraco é a conferência da
  // duração real no worker de moderação, antes de qualquer transcrição.
  if (audio.size > maxAudioBytes) {
    return new Response(JSON.stringify({ error: `O Echo excede o limite de ${Math.round(maxAudioBytes / 1024 / 1024)} MB.` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!Number.isFinite(duration) || duration < minDurationSeconds || duration > maxDurationSeconds) {
    return new Response(JSON.stringify({ error: `No Discovery, um Echo deve ter entre ${minDurationSeconds} e ${maxDurationSeconds} segundos.` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (identityMode !== 'voice' && identityMode !== 'anonymous') {
    return new Response(JSON.stringify({ error: 'Escolha publicar como Voice ou Anônimo.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (typeof categoryId !== 'string' || !categoryId) {
    return new Response(JSON.stringify({ error: 'Selecione uma categoria.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (typeof expirationChoice !== 'string' || !allowedExpirations.has(expirationChoice)) {
    return new Response(JSON.stringify({ error: 'Escolha uma expiração válida.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (protectionEnabled && (!protectionVerified || !['natural', 'shadow', 'deep', 'soft'].includes(String(protectionPreset)))) {
    // Fail closed: um áudio marcado como protegido nunca usa fallback para a gravação original.
    return new Response(JSON.stringify({ error: 'Não foi possível proteger sua voz. O áudio original não foi enviado.' }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  if (parentEchoId !== null) {
    if (typeof parentEchoId !== 'string' || !parentEchoId) {
      return new Response(JSON.stringify({ error: 'Resposta inválida.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: parent } = await admin
      .from('audio_posts')
      .select('id')
      .eq('id', parentEchoId)
      .eq('status', 'active')
      .maybeSingle()
    if (!parent) {
      return new Response(JSON.stringify({ error: 'O Echo original não está disponível para resposta.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  const { data: category } = await admin.from('categories').select('id').eq('id', categoryId).maybeSingle()
  if (!category) {
    return new Response(JSON.stringify({ error: 'Categoria não encontrada.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let validatedVoiceId: string | null = null
  if (identityMode === 'voice') {
    if (typeof voiceId !== 'string' || !voiceId) {
      return new Response(JSON.stringify({ error: 'Crie ou escolha sua Voice antes de publicar.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: voice } = await admin
      .from('voices')
      .select('id')
      .eq('id', voiceId)
      .eq('owner_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!voice) {
      return new Response(JSON.stringify({ error: 'A Voice informada não pertence à sua conta.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    validatedVoiceId = voice.id
  }

  const storagePath = `published/${crypto.randomUUID()}.${extensionFromMimeType(audio.type)}`
  const { error: uploadError } = await admin.storage
    .from('echo-audio')
    .upload(storagePath, audio, { contentType: audio.type, upsert: false })

  if (uploadError) {
    console.error('publish-echo upload failed', uploadError.message)
    return new Response(JSON.stringify({ error: 'Não foi possível enviar o Echo. Nenhum áudio foi publicado.' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // getPublicUrl monta a URL a partir de SUPABASE_URL, que dentro da stack é o
  // endereço interno do Kong (http://kong:8000) e não resolve no navegador.
  // O endereço público vem de SUPABASE_PUBLIC_URL.
  const publicBase = (Deno.env.get('SUPABASE_PUBLIC_URL') ?? supabaseUrl).replace(/\/+$/, '')
  const audioUrl = `${publicBase}/storage/v1/object/public/echo-audio/${storagePath}`
  // Moderação NUNCA depende do que o navegador manda. O Echo nasce 'pending' e
  // invisível no Discovery; quem aprova é o worker server-side, que transcreve o
  // áudio publicado (scripts/deploy/moderate-pending-echoes.sh). Cliente
  // modificado que omita ou falsifique a transcrição não muda nada disso.
  const { data: echo, error: insertError } = await admin
    .from('audio_posts')
    .insert({
      user_id: user.id,
      owner_user_id: user.id,
      voice_id: validatedVoiceId,
      identity_mode: identityMode as IdentityMode,
      category_id: categoryId,
      audio_url: audioUrl,
      storage_path: storagePath,
      parent_id: typeof parentEchoId === 'string' ? parentEchoId : null,
      duration: Math.round(duration),
      title,
      description,
      client_transcription: transcription,
      transcription: null,
      is_anonymous: identityMode === 'anonymous',
      voice_protection_enabled: protectionEnabled,
      voice_protection_preset: protectionEnabled ? protectionPreset as ProtectionPreset : null,
      expires_at: expirationFromChoice(expirationChoice as string),
      moderation_status: 'pending',
      moderation_source: null,
      moderation_attempts: 0,
      status: 'active',
      visibility: 'public',
      published_at: new Date().toISOString(),
    })
    .select('id, moderation_status, created_at')
    .single()

  if (insertError || !echo) {
    await admin.storage.from('echo-audio').remove([storagePath])
    console.error('publish-echo database insert failed', insertError?.message)
    return new Response(JSON.stringify({ error: 'Não foi possível publicar o Echo. O arquivo enviado foi removido.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (typeof parentEchoId === 'string') {
    const { error: replyError } = await admin.from('audio_replies').insert({
      parent_audio_id: parentEchoId,
      reply_audio_id: echo.id,
      user_id: user.id,
    })
    if (replyError) {
      await admin.from('audio_posts').delete().eq('id', echo.id)
      await admin.storage.from('echo-audio').remove([storagePath])
      return new Response(JSON.stringify({ error: 'Não foi possível criar a resposta. O áudio enviado foi removido.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response(JSON.stringify({
    id: echo.id,
    moderation_status: echo.moderation_status,
    created_at: echo.created_at,
    message: 'Seu Echo está em análise e aparecerá no Discovery assim que for aprovado.',
  }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
