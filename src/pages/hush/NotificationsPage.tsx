import { Bell, Heart, Mic, UserPlus, UsersRound } from 'lucide-react'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getNotifications, markNotificationsRead } from '@/features/echoes/services/hushApi'

const notificationText = {
  reaction: 'alguém reagiu ao seu Echo',
  reply: 'alguém respondeu ao seu Echo',
  follow_voice: 'alguém começou a seguir sua Voice',
  voice_published: 'uma Voice que você segue publicou',
  community_invite: 'você recebeu um convite para Community',
} as const

const notificationIcon = { reaction: Heart, reply: Mic, follow_voice: UserPlus, voice_published: Bell, community_invite: UsersRound } as const

export default function NotificationsPage() {
  const query = useQuery({ queryKey: ['notifications'], queryFn: getNotifications, staleTime: 15_000 })
  useEffect(() => { if (query.data?.some((notification) => !notification.read_at)) void markNotificationsRead() }, [query.data])
  return <main className="pb-28"><header className="py-6"><p className="text-2xl font-black tracking-tight">Notificações</p><p className="mt-1 text-sm text-slate-500">Atualizações que ajudam você a voltar para o que importa.</p></header><section className="space-y-2">{(query.data ?? []).map((notification) => { const Icon = notificationIcon[notification.type]; const href = notification.echo_id ? `/e/${notification.echo_id}` : notification.community_id ? '/app/communities' : '/app/voices'; return <Link key={notification.id} to={href} className={`flex items-center gap-4 rounded-2xl border p-4 ${notification.read_at ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950' : 'border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/30'}`}><span className="grid size-10 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-slate-900"><Icon className="size-5" /></span><span className="text-sm font-semibold">{notificationText[notification.type]}</span></Link> })}{!query.isLoading && !query.data?.length && <div className="grid min-h-[45dvh] place-items-center text-center"><div><Bell className="mx-auto size-9 text-slate-400" /><p className="mt-4 font-bold">Nada por enquanto</p><p className="mt-2 text-sm text-slate-500">Quando alguém interagir com uma Voice ou Echo relevante, você verá aqui.</p></div></div>}</section></main>
}
