import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EchoCard } from '@/features/echoes/components/EchoCard'
import { getPublicEcho } from '@/features/echoes/services/hushApi'
import type { HushOutletContext } from '@/components/hush/HushLayout'

export default function EchoDetailPage() {
  const { echoId = '' } = useParams()
  const navigate = useNavigate()
  const outlet = useOutletContext<HushOutletContext | null>()
  const [active, setActive] = useState(true)
  const query = useQuery({ queryKey: ['public-echo', echoId], queryFn: () => getPublicEcho(echoId) })
  if (query.isPending) return <div className="grid min-h-[60dvh] place-items-center"><div className="size-7 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>
  if (!query.data) return <main className="grid min-h-[60dvh] place-items-center px-6 text-center"><div><h1 className="text-xl font-bold">Este Echo não está disponível</h1><p className="mt-2 text-sm text-slate-500">Ele pode ter expirado, sido removido ou não existir.</p><Button asChild className="mt-5"><Link to="/app/echoes">Voltar aos Echoes</Link></Button></div></main>
  return <main className="mx-auto max-w-3xl px-4 pb-28 sm:px-6"><Link to="/app/echoes" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft className="size-4" /> Echoes</Link><EchoCard echo={query.data} active={active} onAudioStarted={() => setActive(true)} onReply={(echo) => outlet?.openCreate(echo.id) ?? navigate('/app/echoes')} onFollow={(echo) => echo.voice_handle && navigate(`/v/${echo.voice_handle.replace('@', '')}`)} /></main>
}
