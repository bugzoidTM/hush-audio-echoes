import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

/**
 * Formulário de contato — o canal de exercício de direitos do titular.
 *
 * Entrega no Telegram do responsável em vez de e-mail: publicar um endereço que
 * ninguém lê seria pior do que não publicar nada, e um pedido de exclusão de
 * dados que cai no vazio é um problema legal, não só de suporte.
 *
 * É um endpoint público que dispara mensagem para uma pessoa, então tem duas
 * travas: limite de 3 por hora por origem e verificação opcional do Turnstile.
 * A verificação é opcional de propósito — se o widget não carregar, a mensagem
 * ainda chega, marcada como não verificada. Bloquear um pedido legítimo de
 * exclusão de dados é pior do que receber spam limitado a 3 por hora.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const assuntos: Record<string, string> = {
  privacidade: 'Privacidade / dados pessoais',
  denuncia: 'Denúncia de conteúdo',
  conta: 'Problema com a conta',
  duvida: 'Dúvida ou sugestão',
  outro: 'Outro',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function texto(valor: unknown, limite: number): string {
  return typeof valor === 'string' ? valor.trim().slice(0, limite) : ''
}

async function turnstileValido(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret || !token) return false
  try {
    const resposta = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip || undefined }),
    })
    const dados = await resposta.json() as { success?: boolean }
    return dados.success === true
  } catch {
    return false
  }
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const telegramToken = Deno.env.get('SHHHH_TELEGRAM_TOKEN')
  const telegramChat = Deno.env.get('SHHHH_TELEGRAM_CHAT_ID') ?? '1610680538'
  if (!supabaseUrl || !serviceRoleKey || !telegramToken) {
    console.error('contato: configuração ausente')
    return json({ error: 'Canal de contato indisponível no momento.' }, 500)
  }

  const corpo = await request.json().catch(() => null) as Record<string, unknown> | null
  const assunto = texto(corpo?.assunto, 40)
  const mensagem = texto(corpo?.mensagem, 4000)
  const contato = texto(corpo?.contato, 200)
  const captchaToken = texto(corpo?.captchaToken, 4000)
  // Campo isca: gente não preenche o que não vê; robô que preenche tudo, sim.
  const armadilha = texto(corpo?.website, 100)

  if (!assuntos[assunto]) return json({ error: 'Escolha um assunto.' }, 400)
  if (mensagem.length < 20) return json({ error: 'Escreva um pouco mais para conseguirmos ajudar (mínimo de 20 caracteres).' }, 400)
  if (armadilha) return json({ ok: true })

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido'
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { error: limiteExcedido } = await admin.rpc('consume_rate_limit_by_key', { p_key: ip, p_action: 'contato' })
  if (limiteExcedido) {
    if (limiteExcedido.code === 'PT429') {
      return json({ error: 'Você já enviou algumas mensagens agora há pouco. Tente novamente daqui a pouco.' }, 429)
    }
    console.error('contato: limite falhou', limiteExcedido.message)
    return json({ error: 'Não foi possível enviar sua mensagem. Tente novamente.' }, 500)
  }

  const verificado = await turnstileValido(captchaToken, ip)

  // O IP não vai na mensagem: quem escreve pode estar pedindo justamente para
  // não ser rastreado. O que vai é o que a pessoa escolheu contar.
  const linhas = [
    `📬 shhhh — contato: ${assuntos[assunto]}`,
    verificado ? '' : '⚠️ enviado sem verificação anti-robô',
    contato ? `Responder para: ${contato}` : 'Sem contato informado (não dá para responder)',
    '',
    mensagem,
  ].filter(Boolean)

  const entrega = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: telegramChat, text: linhas.join('\n'), disable_web_page_preview: true }),
  })
  if (!entrega.ok) {
    console.error('contato: telegram respondeu', entrega.status)
    return json({ error: 'Não foi possível enviar sua mensagem agora. Tente novamente em alguns minutos.' }, 502)
  }

  return json({ ok: true })
})
