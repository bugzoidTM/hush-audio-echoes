import { ArrowLeft, Clock3, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EchoCard } from '@/features/echoes/components/EchoCard'
import { getEchoReplies, getMyEchoStatus, getPublicEcho } from '@/features/echoes/services/hushApi'
import type { HushOutletContext } from '@/components/hush/HushLayout'

const statusCopy: Record<string, { title: string; description: string }> = {
  pending: {
    title: 'Seu Echo está em análise',
    description: 'A moderação transcreve o áudio publicado antes de liberar o Echo no Discovery. Costuma levar poucos minutos — esta página se atualiza sozinha.',
  },
  review_required: {
    title: 'Seu Echo foi para revisão humana',
    description: 'A análise automática encontrou algo que precisa de olhar humano (dado pessoal, risco à vida ou ameaça). Ele fica invisível até essa revisão.',
  },
  rejected: {
    title: 'Seu Echo não foi aprovado',
    description: 'O conteúdo transcrito viola as regras da comunidade. Ele não será publicado no Discovery.',
  },
  limited: {
    title: 'Seu Echo está com alcance limitado',
    description: 'Ele continua acessível por link direto, mas não aparece no Discovery.',
  },
}

export default function EchoDetailPage() {
  const { echoId = '' } = useParams()
  const navigate = useNavigate()
  const outlet = useOutletContext<HushOutletContext | null>()
  const [active, setActive] = useState(true)
  const query = useQuery({ queryKey: ['public-echo', echoId], queryFn: () => getPublicEcho(echoId) })

  // Publicar deixou de significar "no ar": o Echo nasce em análise. Sem esta
  // consulta, quem acabou de publicar cai direto em "Echo não disponível".
  const statusQuery = useQuery({
    queryKey: ['my-echo-status', echoId],
    queryFn: () => getMyEchoStatus(echoId),
    enabled: query.isSuccess && !query.data,
    refetchInterval: (result) => (result.state.data?.moderation_status === 'pending' ? 15_000 : false),
  })

  const repliesQuery = useQuery({
    queryKey: ['echo-replies', echoId],
    queryFn: () => getEchoReplies(echoId),
    enabled: Boolean(query.data),
  })

  if (query.isPending) return <div className="grid min-h-[60dvh] place-items-center"><div className="size-7 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>

  if (!query.data) {
    if (statusQuery.isPending) return <div className="grid min-h-[60dvh] place-items-center"><div className="size-7 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>
    const status = statusQuery.data?.moderation_status
    const copy = status ? statusCopy[status] : undefined
    if (copy) {
      const waiting = status === 'pending'
      return (
        <main className="grid min-h-[60dvh] place-items-center px-6 text-center">
          <div className="max-w-md">
            {waiting ? <Clock3 className="mx-auto size-10 text-indigo-500" /> : <ShieldAlert className="mx-auto size-10 text-amber-500" />}
            <h1 className="mt-4 text-xl font-bold">{copy.title}</h1>
            <p className="mt-2 text-sm text-slate-500">{copy.description}</p>
            <Button asChild className="mt-5"><Link to="/app/echoes">Voltar aos Echoes</Link></Button>
          </div>
        </main>
      )
    }
    return <main className="grid min-h-[60dvh] place-items-center px-6 text-center"><div><h1 className="text-xl font-bold">Este Echo não está disponível</h1><p className="mt-2 text-sm text-slate-500">Ele pode ter expirado, sido removido ou não existir.</p><Button asChild className="mt-5"><Link to="/app/echoes">Voltar aos Echoes</Link></Button></div></main>
  }

  const replies = repliesQuery.data ?? []

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 sm:px-6">
      <Link to="/app/echoes" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft className="size-4" /> Echoes</Link>
      <EchoCard
        echo={query.data}
        active={active}
        onAudioStarted={() => setActive(true)}
        onReply={(echo) => outlet?.openCreate(echo.id) ?? navigate('/app/echoes')}
        onFollow={(echo) => echo.voice_handle && navigate(`/v/${echo.voice_handle.replace('@', '')}`)}
      />

      {/* Responder já existia; ver a conversa, não. Sem a thread, cada resposta
          virava um Echo solto no Discovery e o diálogo se perdia. */}
      <section className="mt-8" aria-label="Respostas">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          {replies.length ? `Respostas (${replies.length})` : 'Respostas'}
        </h2>
        {repliesQuery.isPending ? (
          <div className="grid place-items-center py-8"><div className="size-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>
        ) : replies.length ? (
          <div className="space-y-4">
            {replies.map((reply) => (
              <EchoCard
                key={reply.id}
                echo={reply}
                active={false}
                onAudioStarted={() => setActive(false)}
                onReply={(echo) => outlet?.openCreate(echo.id) ?? navigate('/app/echoes')}
                onFollow={(echo) => echo.voice_handle && navigate(`/v/${echo.voice_handle.replace('@', '')}`)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
            <p>Ainda não há respostas. Responder com a sua voz costuma dizer mais que um comentário.</p>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={() => outlet?.openCreate(query.data.id) ?? navigate('/app/echoes')}>Responder com áudio</Button>
          </div>
        )}
      </section>
    </main>
  )
}
