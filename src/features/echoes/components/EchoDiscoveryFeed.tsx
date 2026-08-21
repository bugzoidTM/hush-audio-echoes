import { Loader2, Mic, SearchX, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { trackEchoEvent } from '@/features/analytics/services/analytics'
import { getCategories, getDiscoveryFeed } from '@/features/echoes/services/hushApi'
import type { PublicEcho } from '@/features/echoes/types'
import { EchoCard } from './EchoCard'

interface EchoDiscoveryFeedProps {
  onCreate: (replyToId?: string) => void
}

export function EchoDiscoveryFeed({ onCreate }: EchoDiscoveryFeedProps) {
  const navigate = useNavigate()
  const [category, setCategory] = useState<string | null>(null)
  const [activeEchoId, setActiveEchoId] = useState<string | null>(null)
  const viewedEchoes = useRef(new Set<string>())
  const categoriesQuery = useQuery({ queryKey: ['echo-categories'], queryFn: getCategories, staleTime: 60 * 60 * 1000 })
  const feedQuery = useQuery({
    queryKey: ['discovery-feed', category],
    queryFn: () => getDiscoveryFeed(null, category),
    staleTime: 30_000,
  })
  const echoes = useMemo(() => feedQuery.data?.items ?? [], [feedQuery.data?.items])

  useEffect(() => {
    if (!echoes.length) return
    setActiveEchoId((current) => current && echoes.some((echo) => echo.id === current) ? current : echoes[0].id)
  }, [echoes])

  useEffect(() => {
    if (!activeEchoId || viewedEchoes.current.has(activeEchoId)) return
    viewedEchoes.current.add(activeEchoId)
    void trackEchoEvent(activeEchoId, 'impression')
  }, [activeEchoId])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const dominant = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]
        if (dominant?.target instanceof HTMLElement) setActiveEchoId(dominant.target.dataset.echoId ?? null)
      },
      { threshold: [0.45, 0.7] },
    )
    const cards = document.querySelectorAll<HTMLElement>('[data-echo-id]')
    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [echoes])

  if (feedQuery.isPending) {
    return <FeedLoading />
  }

  if (feedQuery.isError) {
    return (
      <main className="grid min-h-[70dvh] place-items-center px-4 text-center">
        <div><SearchX className="mx-auto size-10 text-slate-400" /><h1 className="mt-4 text-xl font-bold">Não foi possível carregar os Echoes</h1><p className="mt-2 text-sm text-slate-500">Verifique sua conexão e tente novamente.</p><Button className="mt-5" onClick={() => void feedQuery.refetch()}>Tentar novamente</Button></div>
      </main>
    )
  }

  return (
    <main className="pb-28">
      <header className="sticky top-0 z-20 -mx-4 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:-mx-6 sm:px-6">
        <div className="mb-3 flex items-center justify-between"><div><p className="text-lg font-black tracking-tight text-slate-950 dark:text-white">Echoes</p><p className="text-xs text-slate-500">Ouça o que ninguém conta.</p></div><Button size="icon" variant="ghost" className="rounded-xl" aria-label="Filtros"><SlidersHorizontal className="size-4" /></Button></div>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
          <Button size="sm" variant={!category ? 'default' : 'outline'} className="shrink-0 rounded-full" onClick={() => setCategory(null)}>Para você</Button>
          {(categoriesQuery.data ?? []).map((item) => <Button key={item.id} size="sm" variant={category === item.slug ? 'default' : 'outline'} className="shrink-0 rounded-full" onClick={() => setCategory(item.slug)}>{item.name}</Button>)}
        </div>
      </header>

      {echoes.length ? (
        <section className="snap-y snap-mandatory" aria-live="polite">
          {echoes.map((echo) => (
            <div key={echo.id} data-echo-id={echo.id}>
              <EchoCard
                echo={echo}
                active={activeEchoId === echo.id}
                onAudioStarted={() => setActiveEchoId(echo.id)}
                onReply={(current) => onCreate(current.id)}
                onFollow={(current) => current.voice_handle && navigate(`/v/${encodeURIComponent(current.voice_handle.replace('@', ''))}`)}
              />
            </div>
          ))}
        </section>
      ) : (
        <section className="grid min-h-[65dvh] place-items-center px-6 text-center"><div><Mic className="mx-auto size-10 text-indigo-500" /><h1 className="mt-4 text-xl font-bold">Seja o primeiro a contar</h1><p className="mt-2 text-sm text-slate-500">Ainda não há Echoes nesta categoria. Sua história pode abrir a conversa.</p><Button className="mt-5 rounded-xl" onClick={() => onCreate()}>Criar Echo</Button></div></section>
      )}
    </main>
  )
}

function FeedLoading() {
  return <main className="space-y-5 px-1 py-6"><Skeleton className="h-16 rounded-2xl" />{Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-[60dvh] rounded-[2rem]" />)}<div className="flex justify-center"><Loader2 className="size-5 animate-spin text-indigo-500" /></div></main>
}
