import { ArrowLeft, Ban, Headphones, UsersRound } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { VoiceAvatar } from '@/components/hush/VoiceAvatar'
import { EchoPlayer } from '@/components/hush/EchoPlayer'
import { blockVoice, getPublicVoice, getPublicVoiceEchoes, isVoiceFollowing, setVoiceFollow } from '@/features/echoes/services/hushApi'
import { useAuth } from '@/hooks/useAuth'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useToast } from '@/hooks/use-toast'

export default function VoiceProfilePage() {
  const { handle = '' } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const voiceQuery = useQuery({ queryKey: ['public-voice', handle], queryFn: () => getPublicVoice(handle) })
  const echoesQuery = useQuery({ queryKey: ['public-voice-echoes', handle], queryFn: () => getPublicVoiceEchoes(handle), enabled: Boolean(voiceQuery.data) })
  const { user, loading: loadingUser } = useAuth()
  const visitante = !loadingUser && !user
  const followQuery = useQuery({
    queryKey: ['voice-follow', voiceQuery.data?.id],
    queryFn: () => isVoiceFollowing(voiceQuery.data!.id),
    enabled: Boolean(voiceQuery.data?.id) && Boolean(user),
  })

  // A página é pseudônima e pode ser compartilhada, mas não é indexada: durante
  // o beta o nginx manda noindex em toda /v/, porque confiar na meta tag da SPA
  // exige que o rastreador execute JavaScript antes de decidir. A escolha do
  // dono (voices.indexable) fica guardada para quando houver renderização no
  // servidor capaz de honrá-la por handle.
  usePageMeta({
    title: voiceQuery.data ? `${voiceQuery.data.display_name} (${voiceQuery.data.handle}) — shhhh` : 'Voice — shhhh',
    robots: 'noindex, noarchive',
  })

  if (voiceQuery.isPending) return <div className="grid min-h-[60dvh] place-items-center"><div className="size-7 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>
  if (!voiceQuery.data) return <main className="grid min-h-[60dvh] place-items-center text-center"><div><Headphones className="mx-auto size-10 text-slate-400" /><h1 className="mt-4 text-xl font-bold">Voice não encontrada</h1><Button asChild className="mt-4"><Link to={visitante ? '/ouvir' : '/app/echoes'}>Ouvir outros Echoes</Link></Button></div></main>

  const voice = voiceQuery.data
  const toggleFollow = async () => {
    try {
      await setVoiceFollow(voice.id, !followQuery.data)
      await queryClient.invalidateQueries({ queryKey: ['voice-follow', voice.id] })
      toast({ title: followQuery.data ? 'Você deixou de seguir esta Voice.' : 'Voice adicionada a My Voices.' })
    } catch (error) { toast({ title: 'Não foi possível atualizar', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' }) }
  }

  const block = async () => {
    try {
      await blockVoice(voice.id)
      toast({ title: 'Voice bloqueada', description: 'Os Echoes desta Voice foram removidos dos seus feeds.' })
      navigate('/app/echoes')
    } catch (error) { toast({ title: 'Não foi possível bloquear', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' }) }
  }

  return <main className="pb-28"><Link to={visitante ? '/ouvir' : '/app/echoes'} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"><ArrowLeft className="size-4" /> Echoes</Link><section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950"><div className="flex items-start justify-between gap-4"><VoiceAvatar seed={voice.avatar_seed} label={voice.display_name} className="size-16 rounded-3xl text-xl" /><div className="flex gap-2"><Button className="rounded-xl" variant={followQuery.data ? 'outline' : 'default'} onClick={() => (visitante ? navigate('/auth') : void toggleFollow())}>{followQuery.data ? 'Seguindo' : 'Seguir Voice'}</Button>{!visitante && <Button size="icon" variant="ghost" className="rounded-xl text-slate-500" onClick={() => void block()} aria-label="Bloquear Voice"><Ban className="size-4" /></Button>}</div></div><h1 className="mt-5 text-2xl font-black">{voice.display_name}</h1><p className="mt-1 text-sm font-semibold text-indigo-600">{voice.handle}</p>{voice.bio && <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">{voice.bio}</p>}<div className="mt-5 flex gap-3 text-sm text-slate-500"><span>{voice.active_echo_count} Echoes ativos</span><span>{voice.permanent_echo_count} permanentes</span></div>{voice.community_slug && <Link className="mt-5 flex items-center gap-3 rounded-2xl bg-indigo-50 p-4 text-sm font-semibold text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100" to={`/c/${voice.community_slug}`}><UsersRound className="size-5" /> Community: {voice.community_name}</Link>}</section><section className="mt-7"><h2 className="text-lg font-bold">Echoes desta Voice</h2><div className="mt-4 space-y-3">{(echoesQuery.data ?? []).map((echo) => <article key={echo.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{echo.category_name ?? 'Echo'}</p><h3 className="mt-1 font-bold">{echo.title ?? 'Uma história para ouvir.'}</h3>{echo.description && <p className="mt-2 text-sm text-slate-500">{echo.description}</p>}<div className="mt-4"><EchoPlayer echoId={echo.id} audioUrl={echo.audio_url} duration={echo.duration} /></div></article>)}{!echoesQuery.isLoading && !echoesQuery.data?.length && <p className="py-12 text-center text-sm text-slate-500">Esta Voice ainda não publicou Echoes visíveis.</p>}</div></section></main>
}
