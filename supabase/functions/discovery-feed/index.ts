import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? '12')
  if (!Number.isInteger(parsed)) return 12
  return Math.min(Math.max(parsed, 1), 15)
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) {
    return new Response(JSON.stringify({ error: 'Configuração do servidor indisponível.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authorization = request.headers.get('Authorization') ?? ''
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: authorization ? { Authorization: authorization } : {} },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor')
  const category = url.searchParams.get('category')
  const parsedCursor = cursor && !Number.isNaN(Date.parse(cursor)) ? cursor : null

  const { data, error } = await client.rpc('get_discovery_feed', {
    p_cursor: parsedCursor,
    p_limit: parseLimit(url.searchParams.get('limit')),
    p_category_slug: category || null,
  })

  if (error) {
    console.error('discovery-feed failed', error)
    return new Response(JSON.stringify({ error: 'Não foi possível carregar Echoes.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const items = data ?? []
  const finalCursor = items.length > 0 ? items[items.length - 1].next_cursor : null

  // O resultado de get_discovery_feed é intencionalmente uma whitelist sem owner_user_id.
  return new Response(JSON.stringify({ items, next_cursor: finalCursor }), {
    headers: {
      ...corsHeaders,
      'Cache-Control': 'private, max-age=30',
      'Content-Type': 'application/json',
    },
  })
})
