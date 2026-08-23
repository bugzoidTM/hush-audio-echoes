import { Toaster as Sonner } from '@/components/ui/sonner'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { HushLayout } from '@/components/hush/HushLayout'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import Auth from './pages/Auth'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'
import LandingPage from './pages/hush/LandingPage'
import PreviewPage from './pages/hush/PreviewPage'
import TermosPage from './pages/legal/TermosPage'
import PrivacidadePage from './pages/legal/PrivacidadePage'
import DiretrizesPage from './pages/legal/DiretrizesPage'
import ContatoPage from './pages/legal/ContatoPage'
import EchoesPage from './pages/hush/EchoesPage'
import MyVoicesPage from './pages/hush/MyVoicesPage'
import CommunitiesPage from './pages/hush/CommunitiesPage'
import CommunityPage from './pages/hush/CommunityPage'
import EchoDetailPage from './pages/hush/EchoDetailPage'
import OnboardingPage from './pages/hush/OnboardingPage'
import ProfilePage from './pages/hush/ProfilePage'
import VoiceProfilePage from './pages/hush/VoiceProfilePage'
import SearchPage from './pages/hush/SearchPage'
import NotificationsPage from './pages/hush/NotificationsPage'
import SettingsPage from './pages/hush/SettingsPage'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

/**
 * Rota atrás de feature flag. Communities está congelada até a publicação de
 * Echo dentro da Community existir e a RLS ser reavaliada em produção — o
 * roteador precisa respeitar isso, senão a flag é só decoração.
 */
function FeatureRoute({ flag, children }: { flag: 'COMMUNITIES_ENABLED' | 'MONETIZATION_ENABLED'; children: ReactNode }) {
  const { flags, loading } = useFeatureFlags()
  if (loading) return <div className="grid min-h-[60dvh] place-items-center"><div className="size-7 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>
  if (flags[flag] !== true) return <Navigate to="/app/echoes" replace />
  return <>{children}</>
}

export default function AppRouter() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <TooltipProvider>
          <AuthProvider>
            <Sonner />
            {/* 65 chamadas de useToast() no app dependem deste Toaster: sem ele
                nenhum aviso aparecia — nem o erro de login. */}
            <Toaster />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<Auth />} />
                {/* Prévia pública: ouvir antes de criar conta. Fica fora do
                    HushLayout de propósito — o layout exige sessão. */}
                <Route path="/ouvir" element={<PreviewPage />} />
                {/* Documentos públicos: ninguém deveria precisar de conta para
                    ler os termos aos quais será submetido. */}
                <Route path="/termos" element={<TermosPage />} />
                <Route path="/privacidade" element={<PrivacidadePage />} />
                <Route path="/diretrizes" element={<DiretrizesPage />} />
                <Route path="/contato" element={<ContatoPage />} />
                <Route path="/app" element={<HushLayout />}>
                  <Route index element={<Navigate to="echoes" replace />} />
                  <Route path="echoes" element={<EchoesPage />} />
                  <Route path="voices" element={<MyVoicesPage />} />
                  <Route path="communities" element={<FeatureRoute flag="COMMUNITIES_ENABLED"><CommunitiesPage /></FeatureRoute>} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="onboarding" element={<OnboardingPage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
                <Route path="/v/:handle" element={<VoiceProfilePage />} />
                <Route path="/e/:echoId" element={<EchoDetailPage />} />
                <Route path="/c/:slug" element={<FeatureRoute flag="COMMUNITIES_ENABLED"><CommunityPage /></FeatureRoute>} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/shhhh" element={<Navigate to="/app/echoes" replace />} />
                <Route path="/simple" element={<Navigate to="/app/echoes" replace />} />
                <Route path="/updated" element={<Navigate to="/app/echoes" replace />} />
                <Route path="/shhhhcoin-wallet" element={<Navigate to="/app/echoes" replace />} />
                <Route path="/shhhhcoin-shop" element={<Navigate to="/app/echoes" replace />} />
                <Route path="/user/:userId" element={<Navigate to="/app/profile" replace />} />
                <Route path="/hashtag/:hashtag" element={<Navigate to="/app/search" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
