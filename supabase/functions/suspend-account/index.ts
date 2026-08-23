import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 100 anos: o GoTrue não tem "banimento permanente", só duração. 'none' desfaz.
const permanentBan = '876000h'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Configuração do servidor indisponível.' }, 500)

  const body = await request.json().catch(() => null) as { user_id?: string; suspended?: boolean; note?: string } | null
  if (!body?.user_id || typeof body.suspended !== 'boolean') return json({ error: 'Dados de suspensão inválidos.' }, 400)

  const authorization = request.headers.get('Authorization') ?? ''
  const authenticated = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData } = await authenticated.auth.getUser()
  if (!authData.user) return json({ error: 'Autenticação obrigatória.' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: role } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', authData.user.id)
    .in('role', ['admin', 'moderator'])
    .maybeSingle()
  if (!role) return json({ error: 'Permissão de moderação obrigatória.' }, 403)

  // Duas travas que já custaram caro em outros painéis: ninguém se suspende
  // sozinho (perde o próprio acesso) e moderação não derruba moderação.
  if (body.user_id === authData.user.id) return json({ error: 'Você não pode suspender a própria conta.' }, 400)
  const { data: targetRole } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', body.user_id)
    .in('role', ['admin', 'moderator'])
    .maybeSingle()
  if (targetRole) return json({ error: 'Esta conta tem papel de moderação e não pode ser suspensa pelo painel.' }, 403)

  // Bloqueio de login: só o GoTrue faz, e só com a service_role — por isso esta
  // ação vive numa Edge Function e não numa RPC chamada pelo navegador.
  const banResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${body.user_id}`, {
    method: 'PUT',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ban_duration: body.suspended ? permanentBan : 'none' }),
  })
  if (!banResponse.ok) {
    console.error('suspend-account: gotrue respondeu', banResponse.status)
    return json({ error: 'Não foi possível alterar o acesso desta conta.' }, 502)
  }

  const { data: applied, error } = await admin.rpc('apply_account_suspension', {
    p_user_id: body.user_id,
    p_suspended: body.suspended,
    p_note: body.note ?? null,
  })
  if (error) {
    console.error('suspend-account: apply_account_suspension falhou', error.message)
    return json({ error: 'Acesso alterado, mas o conteúdo não foi atualizado. Refaça a ação.' }, 500)
  }

  const result = Array.isArray(applied) ? applied[0] : applied
  return json({
    ok: true,
    suspended: body.suspended,
    voices_afetadas: result?.voices_afetadas ?? 0,
    echoes_afetados: result?.echoes_afetados ?? 0,
  })
})
