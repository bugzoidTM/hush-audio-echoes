import { Loader2, Mic, SearchX, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { trackEchoEvent } from '@/features/analytics/services/analytics'
import { getCategories, getDiscoveryFeed } from '@/features/echoes/services/hushApi'
import { EchoCard } from './EchoCard'

interface EchoDiscoveryFeedProps {
  onCreate: (replyToId?: string) => void
}

export function EchoDiscoveryFeed({ onCreate }: EchoDiscoveryFeedProps) {
  const navigate = useNavigate()
  const [category, setCategory] = useState<string | null>(null)
  const [activeEchoId, setActiveEchoId] = useState<string | null>(null)
  const viewedEchoes = useRef(new Set<string>())
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const categoriesQuery = useQuery({ queryKey: ['echo-categories'], queryFn: getCategories, staleTime: 60 * 60 * 1000 })

  // Paginação pelo conjunto já servido: cada página manda os ids que o usuário
  // já recebeu, e o servidor devolve o topo do ranking do que sobrou. Com
  // cursor por published_at o feed pulava e repetia Echoes, porque o score muda
  // entre requisições.
  const feedQuery = useInfiniteQuery({
    queryKey: ['discovery-feed', category],
    initialPageParam: [] as string[],
    queryFn: ({ pageParam }) => getDiscoveryFeed(category, pageParam),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.has_more ? allPages.flatMap((page) => page.items.map((item) => item.id)) : undefined,
    staleTime: 30_000,
  })

  const echoes = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [feedQuery.data],
  )

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = feedQuery
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  useEffect(() => {
    if (!echoes.length) return
    setActiveEchoId((current) => (current && echoes.some((echo) => echo.id === current) ? current : echoes[0].id))
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

  // Sentinela do fim da lista: busca a próxima página um Echo antes do fim,
  // para o scroll não travar esperando a resposta.
  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && loadMore(),
      { rootMargin: '600px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, echoes.length])

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
        <>
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
          <div ref={loadMoreRef} className="grid place-items-center py-8 text-sm text-slate-500">
            {isFetchingNextPage ? (
              <Loader2 className="size-5 animate-spin text-indigo-500" />
            ) : hasNextPage ? (
              <Button variant="outline" className="rounded-xl" onClick={loadMore}>Carregar mais</Button>
            ) : (
              <p>Você chegou ao fim por enquanto. Volte mais tarde para ouvir novidades.</p>
            )}
          </div>
        </>
      ) : (
        <section className="grid min-h-[65dvh] place-items-center px-6 text-center"><div><Mic className="mx-auto size-10 text-indigo-500" /><h1 className="mt-4 text-xl font-bold">Seja o primeiro a contar</h1><p className="mt-2 text-sm text-slate-500">Ainda não há Echoes nesta categoria. Sua história pode abrir a conversa.</p><Button className="mt-5 rounded-xl" onClick={() => onCreate()}>Criar Echo</Button></div></section>
      )}
    </main>
  )
}

function FeedLoading() {
  return <main className="space-y-5 px-1 py-6"><Skeleton className="h-16 rounded-2xl" />{Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-[60dvh] rounded-[2rem]" />)}<div className="flex justify-center"><Loader2 className="size-5 animate-spin text-indigo-500" /></div></main>
}
