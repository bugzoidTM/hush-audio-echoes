import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

/**
 * Card social por Echo.
 *
 * O compartilhamento é o canal de aquisição do shhhh, e até aqui todo link
 * colado no WhatsApp mostrava o mesmo card genérico do site — "shhhh — Ouça o
 * que ninguém conta" — em vez da chamada daquele Echo. A diferença entre um
 * card genérico e "Descobri uma traição e ninguém sabe que eu sei · 37s" é a
 * diferença entre alguém tocar no link ou passar direto.
 *
 * O nginx manda para cá apenas os rastreadores (WhatsApp, Telegram, Twitter,
 * Facebook, Discord, Slack, LinkedIn); gente continua recebendo a SPA na mesma
 * URL. Aqui não há sessão nem cookie: só o que já é público.
 *
 * O que NUNCA entra no card: transcrição, descrição livre ou qualquer texto que
 * a pessoa tenha escrito fora do título. Um card vaza para grupos inteiros e
 * fica em cache de terceiros — só o título, que passou pela moderação, sai.
 */

const siteUrl = 'https://shhhh.me'
const defaultImage = `${siteUrl}/lovable-uploads/a384c699-fcd9-4ac6-bcf9-612e01bab15d.png`
const genericTitle = 'shhhh — Ouça o que ninguém conta.'
const genericDescription = 'Histórias, segredos e desabafos contados pela própria voz.'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  if (total < 60) return `${total}s`
  return `${Math.floor(total / 60)}min${total % 60 ? ` ${total % 60}s` : ''}`
}

function page({ title, description, url }: { title: string; description: string; url: string }): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="robots" content="noindex, noarchive, nosnippet" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="shhhh" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta property="og:image" content="${defaultImage}" />
<meta property="og:image:alt" content="shhhh" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${defaultImage}" />
<link rel="canonical" href="${escapeHtml(url)}" />
<meta http-equiv="refresh" content="0; url=${escapeHtml(url)}" />
</head>
<body>
<p>Ouça este Echo em <a href="${escapeHtml(url)}">${escapeHtml(url)}</a>.</p>
</body>
</html>`
}

serve(async (request) => {
  const requestUrl = new URL(request.url)
  const echoId = requestUrl.searchParams.get('id') ?? ''
  const canonical = /^[0-9a-f-]{36}$/i.test(echoId) ? `${siteUrl}/e/${echoId}` : siteUrl

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  const generic = () =>
    new Response(page({ title: genericTitle, description: genericDescription, url: canonical }), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    })

  if (!supabaseUrl || !anonKey || !/^[0-9a-f-]{36}$/i.test(echoId)) return generic()

  try {
    // A mesma RPC pública que a página usa: Echo não aprovado, expirado ou
    // inexistente simplesmente não volta, e o card cai no genérico. Assim o
    // card nunca revela que um Echo removido existiu.
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_echo`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_echo_id: echoId }),
    })
    if (!response.ok) return generic()

    const rows = await response.json() as Array<{ title: string | null; category_name: string | null; duration: number; public_identity: string }>
    const echo = rows[0]
    if (!echo) return generic()

    const title = (echo.title ?? '').trim() || 'Uma história para ouvir.'
    const partes = [echo.public_identity, echo.category_name, formatDuration(echo.duration)].filter(Boolean)
    return new Response(page({
      title,
      description: `${partes.join(' · ')} — ouça no shhhh.`,
      url: canonical,
    }), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    })
  } catch (erro) {
    console.error('echo-share falhou', erro instanceof Error ? erro.message : erro)
    return generic()
  }
})
