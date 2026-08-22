import { Toaster as Sonner } from '@/components/ui/sonner'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { HushLayout } from '@/components/hush/HushLayout'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import Auth from './pages/Auth'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'
import LandingPage from './pages/hush/LandingPage'
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
                <Route path="/app" element={<HushLayout />}>
                  <Route index element={<Navigate to="echoes" replace />} />
                  <Route path="echoes" element={<EchoesPage />} />
                  <Route path="voices" element={<MyVoicesPage />} />
                  <Route path="communities" element={<CommunitiesPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="onboarding" element={<OnboardingPage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
                <Route path="/v/:handle" element={<VoiceProfilePage />} />
                <Route path="/e/:echoId" element={<EchoDetailPage />} />
                <Route path="/c/:slug" element={<CommunityPage />} />
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
