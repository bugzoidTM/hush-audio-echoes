import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

/**
 * Exclusão de conta pelo próprio titular (LGPD, art. 18, VI).
 *
 * Fica numa Edge Function porque remover a conta de autenticação exige
 * service_role, que nunca pode chegar ao navegador. A senha é reconfirmada
 * aqui: sessão roubada ou aparelho esquecido em mesa não deve conseguir apagar
 * a vida de alguém no produto com um clique.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

  const body = await request.json().catch(() => null) as { password?: string } | null
  if (!body?.password) return json({ error: 'Informe sua senha para confirmar a exclusão.' }, 400)

  const authenticated = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData } = await authenticated.auth.getUser()
  if (!authData.user?.email) return json({ error: 'Autenticação obrigatória.' }, 401)

  // Reconfirmação da senha contra o hash do GoTrue, e não por login.
  //
  // Com o Turnstile ligado, o GoTrue exige captcha também no login: usar
  // signInWithPassword aqui quebrava a exclusão de conta — um fluxo que é
  // obrigação legal — sem qualquer aviso. A RPC confere o bcrypt direto, não
  // depende de captcha e não cria uma sessão que ninguém pediu.
  const { data: senhaConfere, error: erroSenha } = await authenticated.rpc('verify_my_password', {
    p_password: body.password,
  })
  if (erroSenha) {
    // A RPC limita tentativas (5 por 15 min) e sinaliza com PT429: uma sessão
    // roubada não pode virar oráculo de senha.
    if (erroSenha.code === 'PT429') {
      return json({ error: 'Muitas tentativas de senha. Espere alguns minutos e tente de novo.' }, 429)
    }
    console.error('delete-account: verificação de senha falhou', erroSenha.message)
    return json({ error: 'Não foi possível confirmar sua senha. Tente novamente.' }, 500)
  }
  if (senhaConfere !== true) return json({ error: 'Senha incorreta.' }, 403)

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // Conta com papel de moderação não se apaga sozinha: sair levaria junto o
  // acesso à fila de revisão, e isso precisa ser uma decisão consciente.
  const { data: papel } = await admin
    .from('user_roles').select('role').eq('user_id', authData.user.id).in('role', ['admin', 'moderator']).maybeSingle()
  if (papel) return json({ error: 'Contas com papel de moderação precisam ser removidas pelo administrador.' }, 403)

  const { data: apagado, error: erroDados } = await admin.rpc('erase_account_data', { p_user_id: authData.user.id })
  if (erroDados) {
    console.error('delete-account: erase_account_data falhou', erroDados.message)
    return json({ error: 'Não foi possível apagar seus dados. Nada foi removido.' }, 500)
  }

  // A mídia sai ANTES da conta de acesso. `audio_posts.owner_user_id` tem
  // ON DELETE CASCADE para auth.users: apagar a conta primeiro faria as linhas
  // sumirem levando junto o storage_path, e os arquivos ficariam no bucket para
  // sempre — sem registro que os encontrasse e com a URL ainda respondendo.
  const caminhos = (apagado as { caminhos_de_midia?: string[] } | null)?.caminhos_de_midia ?? []
  if (caminhos.length > 0) {
    const { error: erroMidia } = await admin.storage.from('echo-audio').remove(caminhos)
    if (erroMidia) {
      console.error('delete-account: remoção de mídia falhou', erroMidia.message)
      return new Response(JSON.stringify({
        error: 'Seus dados foram apagados, mas os áudios não puderam ser removidos. Tente de novo em instantes.',
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  }

  // Só depois de os dados e a mídia saírem: se a conta de autenticação sumisse
  // primeiro e o resto falhasse, sobrariam dados sem dono e sem ninguém para
  // pedir de novo.
  const { error: erroConta } = await admin.auth.admin.deleteUser(authData.user.id)
  if (erroConta) {
    console.error('delete-account: deleteUser falhou', erroConta.message)
    return json({ error: 'Seus dados foram apagados, mas a conta de acesso permaneceu. Fale com o suporte.' }, 500)
  }

  return json({ ok: true, midias_removidas: caminhos.length, ...(apagado as Record<string, unknown> ?? {}) })
})
