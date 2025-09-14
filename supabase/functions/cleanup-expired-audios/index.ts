import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface AudioPost {
  id: string
  audio_url: string
  user_id: string
  expires_at: string
  status: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('🔄 Iniciando limpeza de áudios expirados...')

    // 1. Buscar áudios expirados (mais de 24 horas)
    const { data: expiredPosts, error: fetchError } = await supabaseAdmin
      .from('audio_posts')
      .select('id, audio_url, user_id, expires_at, status')
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'active')

    if (fetchError) {
      console.error('❌ Erro ao buscar posts expirados:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar posts expirados' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!expiredPosts || expiredPosts.length === 0) {
      console.log('✅ Nenhum áudio expirado encontrado')
      return new Response(
        JSON.stringify({ 
          message: 'Nenhum áudio expirado encontrado',
          deleted_count: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`📋 Encontrados ${expiredPosts.length} áudios expirados`)

    let deletedCount = 0
    let deletedFromStorage = 0

    // 2. Para cada áudio expirado, deletar do storage e do banco
    for (const post of expiredPosts as AudioPost[]) {
      try {
        // Extrair o caminho do arquivo no storage
        const audioPath = post.audio_url.split('/').pop()?.split('?')[0]
        
        if (audioPath) {
          // Tentar deletar do storage
          const { error: storageError } = await supabaseAdmin.storage
            .from('audio-files')
            .remove([audioPath])

          if (storageError) {
            console.warn(`⚠️ Erro ao deletar do storage: ${audioPath}`, storageError)
          } else {
            deletedFromStorage++
            console.log(`🗑️ Arquivo deletado do storage: ${audioPath}`)
          }
        }

        // Deletar do banco de dados
        const { error: dbError } = await supabaseAdmin
          .from('audio_posts')
          .delete()
          .eq('id', post.id)

        if (dbError) {
          console.error(`❌ Erro ao deletar post ${post.id} do banco:`, dbError)
        } else {
          deletedCount++
          console.log(`✅ Post ${post.id} deletado do banco`)
        }

      } catch (error) {
        console.error(`❌ Erro ao processar post ${post.id}:`, error)
      }
    }

    console.log(`🎉 Limpeza concluída: ${deletedCount} posts deletados, ${deletedFromStorage} arquivos removidos do storage`)

    return new Response(
      JSON.stringify({
        message: 'Limpeza de áudios expirados concluída',
        found_expired: expiredPosts.length,
        deleted_from_db: deletedCount,
        deleted_from_storage: deletedFromStorage,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Erro geral na função de limpeza:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno na função de limpeza',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})