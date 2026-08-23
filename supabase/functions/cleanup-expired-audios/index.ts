import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface ExpiredEcho {
  id: string
  storage_path: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Configuração do servidor indisponível.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Esta Function executa remoção de Storage e atualização administrativa. Um JWT de usuário
  // não é suficiente: somente a chave server-side pode disparar o job agendado.
  if (request.headers.get('authorization') !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const now = new Date().toISOString()
    const { data: expired, error: fetchError } = await admin
      .from('audio_posts')
      .select('id, storage_path')
      .lt('expires_at', now)
      .neq('status', 'expired')
      .not('expires_at', 'is', null)

    if (fetchError) {
      throw fetchError
    }

    const echoes = (expired ?? []) as ExpiredEcho[]
    let mediaRemoved = 0
    const failures: string[] = []

    for (const echo of echoes) {
      // storage_path é a única fonte de verdade. Nunca tentar inferir um caminho por URL.
      if (echo.storage_path) {
        const { error: storageError } = await admin.storage
          .from('echo-audio')
          .remove([echo.storage_path])

        if (storageError) {
          failures.push(echo.id)
          continue
        }
        mediaRemoved += 1
      }

      const { error: updateError } = await admin
        .from('audio_posts')
        .update({ status: 'expired' })
        .eq('id', echo.id)

      if (updateError) {
        failures.push(echo.id)
      }
    }

    // Segunda passada: áudio sem linha no banco.
    //
    // audio_posts.owner_user_id referencia auth.users com ON DELETE CASCADE.
    // Qualquer remoção de conta pelo painel do GoTrue ou pela API de admin faz
    // as linhas sumirem levando junto o storage_path — e o arquivo fica no
    // bucket para sempre, sem registro que o encontre e com a URL respondendo.
    // A exclusão de conta pelo produto já apaga a mídia antes; isto cobre todo
    // o resto.
    //
    // Só objetos com mais de uma hora: um upload recém-feito pelo publish-echo
    // ainda pode estar entre o arquivo e a linha, e apagá-lo destruiria um Echo
    // legítimo no meio da publicação.
    let orphansRemoved = 0
    const { data: orphans, error: orphanError } = await admin.rpc('list_orphan_media', { p_older_than_minutes: 60 })
    if (orphanError) {
      console.error('cleanup: busca de órfãos falhou', orphanError.message)
    } else {
      const paths = ((orphans ?? []) as Array<{ name: string }>).map((item) => item.name)
      for (let index = 0; index < paths.length; index += 100) {
        const lote = paths.slice(index, index + 100)
        const { error: removeError } = await admin.storage.from('echo-audio').remove(lote)
        if (removeError) {
          console.error('cleanup: remoção de órfãos falhou', removeError.message)
          break
        }
        orphansRemoved += lote.length
      }
    }

    return new Response(JSON.stringify({
      found_expired: echoes.length,
      media_removed: mediaRemoved,
      marked_expired: echoes.length - failures.length,
      failures: failures.length,
      orphans_removed: orphansRemoved,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('cleanup-expired-audios failed', error)
    return new Response(JSON.stringify({ error: 'Não foi possível executar a limpeza de Echoes.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
