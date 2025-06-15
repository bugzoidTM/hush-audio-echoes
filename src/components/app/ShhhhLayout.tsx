
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
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
  const [showRecordModal, setShowRecordModal] = useState(false);
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
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Esquerda */}
      <div className="w-64 border-r border-border fixed left-0 top-0 h-full bg-background z-10">
        <div className="p-6">
          {/* Logo */}
          <div className="mb-8 flex items-center justify-center">
            <img 
              src="/lovable-uploads/205b5735-3f33-453a-a025-eaffc0a2fba6.png" 
              alt="Logo SHHHH" 
              className="h-10 w-auto object-contain"
              data-testid="app-logo"
            />
          </div>
          
          {/* Menu de Navegação */}
          <SidebarNavigation 
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            onCreateClick={() => setShowRecordModal(true)}
          />

          {/* Usuário Logado */}
          <UserProfileSection 
            userProfile={userProfile}
            displayName={displayName}
            onSignOut={signOut}
          />
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 ml-64">
        <div className="max-w-6xl mx-auto flex">
          {/* Feed Central */}
          <div className="flex-1 max-w-xl mx-auto">
            {/* Stories dos usuários seguidos no topo */}
            <FollowersStories />
            {children}
          </div>

          {/* Sidebar Direita */}
          <RightSidebar 
            user={user}
            userProfile={userProfile}
            displayName={displayName}
          />
        </div>
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
