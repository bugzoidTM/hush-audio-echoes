
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import RecordAudioModal from './RecordAudioModal';
import FollowersStories from './FollowersStories';
import SidebarNavigation from './SidebarNavigation';
import UserProfileSection from './UserProfileSection';
import RightSidebar from './RightSidebar';

interface ShhhhLayoutProps {
  children: ReactNode;
  onSectionChange?: (section: string) => void;
}

const ShhhhLayout = ({ children, onSectionChange }: ShhhhLayoutProps) => {
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setUserProfile(data);
      };
      
      fetchProfile();
    }
  }, [user]);

  const displayName = userProfile?.display_name || userProfile?.username || 'Usuário';

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    onSectionChange?.(section);
    // Fechar sidebar mobile após seleção
    if (isMobile) {
      setShowMobileSidebar(false);
    }
  };

  // Componente Sidebar compartilhado
  const SidebarContent = () => (
    <div className="p-4 md:p-6 h-full flex flex-col">
      {/* Logo */}
      <div className="mb-6 md:mb-8 flex items-center justify-center">
        <img 
          src="/lovable-uploads/205b5735-3f33-453a-a025-eaffc0a2fba6.png" 
          alt="Logo SHHHH" 
          className="h-8 md:h-10 w-auto object-contain"
          data-testid="app-logo"
        />
      </div>
      
      {/* Menu de Navegação */}
      <div className="flex-1">
        <SidebarNavigation 
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          onCreateClick={() => {
            setShowRecordModal(true);
            if (isMobile) setShowMobileSidebar(false);
          }}
        />
      </div>

      {/* Usuário Logado */}
      <div className="mt-auto">
        <UserProfileSection 
          userProfile={userProfile}
          displayName={displayName}
          onSignOut={signOut}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      {isMobile && (
        <header className="lg:hidden bg-background border-b border-border sticky top-0 z-50">
          <div className="flex items-center justify-between p-4">
            <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Abrir menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            
            {/* Logo Central Mobile */}
            <img 
              src="/lovable-uploads/205b5735-3f33-453a-a025-eaffc0a2fba6.png" 
              alt="Logo SHHHH" 
              className="h-8 w-auto object-contain"
            />
            
            {/* Botão de Criar Mobile */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowRecordModal(true)}
              className="lg:hidden"
            >
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-white"></div>
              </div>
              <span className="sr-only">Gravar áudio</span>
            </Button>
          </div>
        </header>
      )}

      <div className="flex">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <aside className="hidden lg:block w-64 border-r border-border fixed left-0 top-0 h-full bg-background z-10">
            <SidebarContent />
          </aside>
        )}

        {/* Conteúdo Principal */}
        <main className={`flex-1 ${!isMobile ? 'lg:ml-64' : ''}`}>
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row">
            {/* Feed Central */}
            <div className="flex-1 lg:max-w-xl lg:mx-auto px-4 lg:px-0">
              {/* Stories dos usuários seguidos no topo - apenas desktop */}
              {!isMobile && <FollowersStories />}
              {children}
            </div>

            {/* Sidebar Direita - apenas desktop */}
            {!isMobile && (
              <aside className="hidden lg:block lg:w-80 lg:pl-6">
                <RightSidebar 
                  user={user}
                  userProfile={userProfile}
                  displayName={displayName}
                />
              </aside>
            )}
          </div>
        </main>
      </div>

      {/* Modal de Gravação */}
      <RecordAudioModal 
        open={showRecordModal} 
        onClose={() => setShowRecordModal(false)} 
      />
    </div>
  );
};

export default ShhhhLayout;
