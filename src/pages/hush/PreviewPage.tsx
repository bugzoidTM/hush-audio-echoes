import { Headphones, Loader2, Lock, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EchoCard } from '@/features/echoes/components/EchoCard'
import { getPublicPreviewFeed } from '@/features/echoes/services/hushApi'
import { PREVIEW_LIMIT, heardEchoes, rememberHeard } from '@/features/echoes/previewGate'
import { useAuth } from '@/hooks/useAuth'
import { usePageMeta } from '@/hooks/usePageMeta'

/**
 * A prévia: um Echo de cada vez, para quem ainda não tem conta.
 *
 * A ordem importa. Pedir cadastro antes de a pessoa ouvir qualquer coisa é
 * pedir compromisso antes de mostrar valor — e a maioria fecha a aba. Aqui ela
 * ouve primeiro, e o convite aparece quando já sabe o que está deixando para
 * trás.
 */
export default function PreviewPage() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [ouvidos, setOuvidos] = useState<string[]>(() => heardEchoes())

  usePageMeta({
    title: 'Ouça alguns Echoes — shhhh',
    // Prévia é porta de entrada, não acervo: pode ser encontrada, mas os Echoes
    // em si não devem ficar arquivados em buscador (ver /e/:id).
    robots: 'index, follow',
  })

  const previa = useQuery({
    queryKey: ['previa-publica', ouvidos.length],
    queryFn: () => getPublicPreviewFeed(ouvidos),
    enabled: !user,
    staleTime: 60_000,
  })

  // Sempre o primeiro da lista: ela já vem sem o que a pessoa ouviu, então
  // avançar é marcar o atual como ouvido e deixar a consulta trazer o próximo.
  // Guardar um índice à parte dessava a lista e mostrava tela vazia.
  const echoes = useMemo(() => previa.data ?? [], [previa.data])
  const atual = echoes[0]
  const atingiuLimite = ouvidos.length >= PREVIEW_LIMIT

  if (loading) return <div className="grid min-h-dvh place-items-center"><Loader2 className="size-7 animate-spin text-indigo-600" /></div>

  // Quem já tem conta não fica na prévia: vai para o Discovery de verdade.
  if (user) {
    navigate('/app/echoes', { replace: true })
    return null
  }

  const ouvirProximo = () => {
    if (atual) setOuvidos(rememberHeard(atual.id))
  }

  if (atingiuLimite || (!previa.isPending && !atual)) {
    return <Convite ouvidos={ouvidos.length} />
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <Link to="/" className="text-lg font-black tracking-[-0.06em] text-slate-950 dark:text-white">shhhh<span className="text-indigo-500">.</span></Link>
        <Button asChild variant="ghost" className="rounded-xl"><Link to="/auth">Entrar</Link></Button>
      </header>

      <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200">
        <Headphones className="size-3.5" /> Prévia · {Math.min(ouvidos.length + 1, PREVIEW_LIMIT)} de {PREVIEW_LIMIT}
      </p>

      {previa.isPending ? (
        <div className="grid min-h-[50dvh] place-items-center"><Loader2 className="size-6 animate-spin text-indigo-600" /></div>
      ) : atual ? (
        <>
          <EchoCard
            echo={atual}
            active
            guest
            onAudioStarted={() => undefined}
            onReply={() => undefined}
            onFollow={() => undefined}
            onGuestAction={() => navigate('/auth')}
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button size="lg" className="rounded-2xl" onClick={ouvirProximo}>Ouvir outro Echo</Button>
            <Button asChild size="lg" variant="outline" className="rounded-2xl"><Link to="/auth">Criar conta grátis</Link></Button>
          </div>
        </>
      ) : null}
    </main>
  )
}

function Convite({ ouvidos }: { ouvidos: number }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-indigo-600 text-white"><Sparkles className="size-8" /></div>
        <h1 className="mt-7 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Você encontrou o shhhh.</h1>
        <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">
          {ouvidos > 0 ? `Você ouviu ${ouvidos} ${ouvidos === 1 ? 'história' : 'histórias'}. ` : ''}
          Há muitas outras esperando para serem ouvidas. Crie sua conta grátis para continuar.
        </p>
        <p className="mt-3 text-sm text-slate-500">E-mail e senha. Sem telefone, sem cartão.</p>
        <Button asChild size="lg" className="mt-7 w-full rounded-2xl"><Link to="/auth">Criar conta grátis</Link></Button>
        <Button asChild variant="ghost" className="mt-2 w-full rounded-2xl"><Link to="/auth">Já tenho conta</Link></Button>
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Lock className="size-3" /> Você pode publicar de forma anônima, sem vincular sua identidade.
        </p>
      </div>
    </main>
  )
}
