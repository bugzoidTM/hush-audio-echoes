import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const validDecisions = new Set(['approved', 'limited', 'rejected', 'review_required'])

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Configuração do servidor indisponível.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const body = await request.json().catch(() => null) as { echo_id?: string; decision?: string; note?: string } | null
  if (!body?.echo_id || !body.decision || !validDecisions.has(body.decision)) {
    return new Response(JSON.stringify({ error: 'Dados de moderação inválidos.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const authorization = request.headers.get('Authorization') ?? ''
  const authenticated = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData } = await authenticated.auth.getUser()
  if (!authData.user) {
    return new Response(JSON.stringify({ error: 'Autenticação obrigatória.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: role } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', authData.user.id)
    .in('role', ['admin', 'moderator'])
    .maybeSingle()

  if (!role) {
    return new Response(JSON.stringify({ error: 'Permissão de moderação obrigatória.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Decisão humana também deixa rastro: sem moderation_source/moderated_at não
  // dá para distinguir depois o que foi analisado por gente do que passou pelo
  // worker automático — e a fila da revisão humana some sem registro.
  const update = {
    moderation_status: body.decision,
    moderation_source: 'human',
    moderated_at: new Date().toISOString(),
    moderation_note: body.note ? body.note.slice(0, 500) : null,
    ...(body.decision === 'rejected' ? { status: 'deleted', expires_at: new Date().toISOString() } : {}),
  }
  const { error } = await admin.from('audio_posts').update(update).eq('id', body.echo_id)
  if (error) {
    console.error('moderate-echo failed', error.message)
    return new Response(JSON.stringify({ error: 'Não foi possível atualizar a moderação.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
