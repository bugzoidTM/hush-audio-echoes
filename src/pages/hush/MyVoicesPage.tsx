import { Headphones, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EchoCard } from '@/features/echoes/components/EchoCard'
import { getMyVoicesFeed } from '@/features/echoes/services/hushApi'
import type { HushOutletContext } from '@/components/hush/HushLayout'

export default function MyVoicesPage() {
  const navigate = useNavigate()
  const { openCreate } = useOutletContext<HushOutletContext>()
  const [activeEchoId, setActiveEchoId] = useState<string | null>(null)
  const query = useQuery({ queryKey: ['my-voices-feed'], queryFn: () => getMyVoicesFeed(), staleTime: 30_000 })
  const echoes = useMemo(() => query.data ?? [], [query.data])

  useEffect(() => {
    if (echoes[0]) setActiveEchoId((current) => current ?? echoes[0].id)
  }, [echoes])

  if (query.isPending) return <div className="grid min-h-[60dvh] place-items-center"><Loader2 className="size-6 animate-spin text-indigo-600" /></div>
  if (query.isError) return <div className="grid min-h-[60dvh] place-items-center text-center"><div><p className="font-bold">Não foi possível carregar suas Voices.</p><Button className="mt-3" onClick={() => void query.refetch()}>Tentar novamente</Button></div></div>

  return (
    <main className="pb-28"><header className="py-6"><p className="text-2xl font-black tracking-tight">My Voices</p><p className="mt-1 text-sm text-slate-500">O que as Voices que você escolheu ouvir contaram hoje.</p></header>{echoes.length ? <section>{echoes.map((echo) => <EchoCard key={echo.id} echo={echo} active={echo.id === activeEchoId} onAudioStarted={() => setActiveEchoId(echo.id)} onReply={(current) => openCreate(current.id)} onFollow={(current) => current.voice_handle && navigate(`/v/${current.voice_handle.replace('@', '')}`)} />)}</section> : <EmptyMyVoices onDiscover={() => navigate('/app/echoes')} />}</main>
  )
}

function EmptyMyVoices({ onDiscover }: { onDiscover: () => void }) {
  return <section className="grid min-h-[55dvh] place-items-center rounded-3xl border border-dashed border-slate-300 px-6 text-center dark:border-slate-700"><div><Headphones className="mx-auto size-10 text-indigo-500" /><h1 className="mt-4 text-xl font-bold">Sua coleção de Voices começa aqui</h1><p className="mt-2 max-w-sm text-sm text-slate-500">Quando uma história mexer com você, visite a Voice e acompanhe para encontrar novos Echoes aqui.</p><Button className="mt-5 rounded-xl" onClick={onDiscover}>Descobrir Echoes</Button></div></section>
}

