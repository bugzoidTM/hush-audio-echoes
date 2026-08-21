import { ArrowLeft, LockKeyhole, UsersRound } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EchoPlayer } from '@/components/hush/EchoPlayer'
import { VoiceAvatar } from '@/components/hush/VoiceAvatar'
import { getCommunityBySlug, getCommunityFeed } from '@/features/echoes/services/hushApi'

export default function CommunityPage() {
  const { slug = '' } = useParams()
  const communityQuery = useQuery({ queryKey: ['community', slug], queryFn: () => getCommunityBySlug(slug) })
  const feedQuery = useQuery({ queryKey: ['community-feed', slug], queryFn: () => getCommunityFeed(slug), enabled: Boolean(communityQuery.data) })

  if (communityQuery.isPending) return <div className="grid min-h-[60dvh] place-items-center"><div className="size-7 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>
  if (!communityQuery.data) return <main className="grid min-h-[60dvh] place-items-center px-6 text-center"><div><LockKeyhole className="mx-auto size-10 text-slate-400" /><h1 className="mt-4 text-xl font-bold">Community indisponível</h1><p className="mt-2 text-sm text-slate-500">Ela pode ser privada, exigir convite ou não existir.</p><Button asChild className="mt-5"><Link to="/app/communities">Explorar Communities</Link></Button></div></main>
  const community = communityQuery.data

  return <main className="pb-28"><Link to="/app/communities" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft className="size-4" /> Communities</Link><header className="mt-5 rounded-[2rem] bg-slate-900 p-6 text-white"><div className="flex items-start justify-between"><div className="grid size-12 place-items-center rounded-2xl bg-white/15"><UsersRound className="size-6" /></div>{community.access_type === 'invite_only' && <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs"><LockKeyhole className="size-3" /> Por convite</span>}</div><h1 className="mt-6 text-2xl font-black">{community.name}</h1><p className="mt-2 text-sm text-slate-300">{community.description}</p><Link className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-200 hover:text-white" to={`/v/${community.owner_handle.replace('@', '')}`}><VoiceAvatar seed={community.owner_handle} label={community.owner_display_name} className="size-7 rounded-lg text-xs" /> Criada por {community.owner_display_name}</Link></header><section className="mt-7"><h2 className="text-lg font-bold">Echoes da Community</h2><div className="mt-4 space-y-3">{(feedQuery.data ?? []).map((echo) => <article key={echo.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center gap-2 text-sm font-semibold"><VoiceAvatar seed={echo.avatar_seed} label={echo.public_identity} className="size-7 rounded-lg text-xs" /><span>{echo.public_identity}</span></div><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-indigo-600">{echo.category_name ?? 'Echo'}</p><h3 className="mt-1 font-bold">{echo.title ?? 'Uma história para ouvir.'}</h3>{echo.description && <p className="mt-2 text-sm text-slate-500">{echo.description}</p>}<div className="mt-4"><EchoPlayer echoId={echo.id} audioUrl={echo.audio_url} duration={echo.duration} /></div></article>)}{!feedQuery.isLoading && !feedQuery.data?.length && <p className="py-12 text-center text-sm text-slate-500">Ainda não há Echoes nesta Community.</p>}</div></section></main>
}
