import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? '12')
  if (!Number.isInteger(parsed)) return 12
  return Math.min(Math.max(parsed, 1), 15)
}

// Paginação por conjunto já servido. O cursor por published_at era instável sob
// ORDER BY score: com o ranking mudando entre requisições, Echoes eram pulados
// ou repetidos. Aqui cada página é o topo do ranking do que ainda não foi
// entregue, então não há duplicata nem salto — e as janelas de diversidade
// passam a valer por página, em vez de travar o feed em ~12 Echoes.
function parseExcludedIds(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => uuidPattern.test(id))
    .slice(0, 300)
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

  // O feed é exclusivo de sessão autenticada: get_discovery_feed usa auth.uid()
  // para filtrar bloqueios e Echoes já ouvidos, e o PRD exige sessão de usuário.
  const { data: authData } = await client.auth.getUser()
  if (!authData.user) {
    return new Response(JSON.stringify({ error: 'Autenticação obrigatória para carregar o feed.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(request.url)
  const category = url.searchParams.get('category')
  const limit = parseLimit(url.searchParams.get('limit'))
  const excluded = parseExcludedIds(url.searchParams.get('exclude'))

  const { data, error } = await client.rpc('get_discovery_feed', {
    p_limit: limit,
    p_category_slug: category || null,
    p_exclude_ids: excluded.length ? excluded : null,
  })

  if (error) {
    console.error('discovery-feed failed', error)
    return new Response(JSON.stringify({ error: 'Não foi possível carregar Echoes.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const items = data ?? []
  // next_cursor sobrevive como chave de depuração/ordem da última linha; quem
  // pagina de fato é `exclude`. has_more evita a página vazia final.
  const finalCursor = items.length > 0 ? items[items.length - 1].next_cursor : null

  // O resultado de get_discovery_feed é intencionalmente uma whitelist sem owner_user_id.
  return new Response(JSON.stringify({ items, next_cursor: finalCursor, has_more: items.length >= limit }), {
    headers: {
      ...corsHeaders,
      'Cache-Control': 'private, max-age=30',
      'Content-Type': 'application/json',
    },
  })
})
