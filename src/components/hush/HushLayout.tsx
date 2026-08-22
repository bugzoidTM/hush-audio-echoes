import { Bell, Compass, Headphones, Plus, Search, UserRound, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CreateEchoModal } from '@/features/echoes/components/CreateEchoModal'
import { trackAppOpen } from '@/features/analytics/services/analytics'
import { isOnboardingComplete } from '@/features/echoes/services/hushApi'
import { useAuth } from '@/hooks/useAuth'

export interface HushOutletContext {
  openCreate: (replyToId?: string) => void
}

const navItems = [
  { to: '/app/echoes', label: 'Echoes', icon: Compass },
  { to: '/app/voices', label: 'My Voices', icon: Headphones },
  { to: '/app/communities', label: 'Communities', icon: UsersRound },
  { to: '/app/profile', label: 'Profile', icon: UserRound },
]

export function HushLayout() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [createOpen, setCreateOpen] = useState(false)
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [checkingOnboarding, setCheckingOnboarding] = useState(true)

  useEffect(() => {
    if (!loading && !user) navigate('/auth', { replace: true })
  }, [loading, navigate, user])

  useEffect(() => {
    trackAppOpen()
  }, [])

  useEffect(() => {
    if (!user) return
    let active = true
    void isOnboardingComplete()
      .then((completed) => {
        if (!active) return
        if (!completed && location.pathname !== '/app/onboarding') navigate('/app/onboarding', { replace: true })
      })
      .catch(() => {
        // Uma indisponibilidade transitória não deve impedir o acesso ao app.
      })
      .finally(() => { if (active) setCheckingOnboarding(false) })
    return () => { active = false }
  }, [location.pathname, navigate, user])

  const openCreate = (echoId?: string) => {
    setReplyToId(echoId ?? null)
    setCreateOpen(true)
  }

  if (loading || !user || checkingOnboarding) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 dark:bg-slate-950"><div className="size-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <NavLink to="/app/echoes" className="flex items-center gap-2 text-xl font-black tracking-[-0.08em] text-slate-950 dark:text-white" aria-label="shhhh, Echoes"><img src="/lovable-uploads/a384c699-fcd9-4ac6-bcf9-612e01bab15d.png" alt="" aria-hidden="true" width={32} height={32} className="size-8 rounded-lg" />shhhh<span className="text-indigo-600">.</span></NavLink>
          <div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="rounded-xl" aria-label="Buscar" onClick={() => navigate('/app/search')}><Search className="size-5" /></Button><Button variant="ghost" size="icon" className="rounded-xl" aria-label="Notificações" onClick={() => navigate('/app/notifications')}><Bell className="size-5" /></Button></div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <Outlet context={{ openCreate } satisfies HushOutletContext} />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95" aria-label="Navegação principal">
        <div className="mx-auto grid max-w-3xl grid-cols-5 items-end px-2">
          {navItems.slice(0, 2).map(({ to, label, icon: Icon }) => <NavItem key={to} to={to} label={label} icon={Icon} />)}
          <Button className="mx-auto -mt-7 grid size-14 place-items-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-950/30 transition-transform duration-150 hover:bg-indigo-500 active:scale-95" onClick={() => openCreate()} aria-label="Criar Echo"><Plus className="size-6" /></Button>
          {navItems.slice(2).map(({ to, label, icon: Icon }) => <NavItem key={to} to={to} label={label} icon={Icon} />)}
        </div>
      </nav>

      <CreateEchoModal open={createOpen} onOpenChange={setCreateOpen} replyToId={replyToId} />
      {location.pathname === '/app' && <NavigateToEchoes />}
    </div>
  )
}

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Compass }) {
  return <NavLink to={to} className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold ${isActive ? 'text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}><Icon className="size-5" /><span>{label}</span></NavLink>
}

function NavigateToEchoes() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/app/echoes', { replace: true }) }, [navigate])
  return null
}
