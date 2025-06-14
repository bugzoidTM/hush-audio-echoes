
import { ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Home, 
  Search, 
  Compass, 
  Heart, 
  PlusSquare, 
  User,
  LogOut
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import UserSuggestions from './UserSuggestions';
import RecordAudioModal from './RecordAudioModal';

interface InstagramLayoutProps {
  children: ReactNode;
}

const InstagramLayout = ({ children }: InstagramLayoutProps) => {
  const { user, signOut } = useAuth();
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

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

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Esquerda */}
      <div className="w-64 border-r border-border fixed left-0 top-0 h-full bg-background z-10">
        <div className="p-6">
          {/* Logo */}
          <div className="mb-8">
            <img 
              src="/lovable-uploads/205b5735-3f33-453a-a025-eaffc0a2fba6.png" 
              alt="SHHHH Logo" 
              className="h-8 w-auto"
            />
          </div>

          {/* Menu de Navegação */}
          <nav className="space-y-4">
            <Button variant="ghost" className="w-full justify-start font-semibold">
              <Home className="w-6 h-6 mr-3" />
              Página inicial
            </Button>
            
            <Button variant="ghost" className="w-full justify-start">
              <Search className="w-6 h-6 mr-3" />
              Pesquisa
            </Button>
            
            <Button variant="ghost" className="w-full justify-start">
              <Compass className="w-6 h-6 mr-3" />
              Explorar
            </Button>
            
            <Button variant="ghost" className="w-full justify-start">
              <Heart className="w-6 h-6 mr-3" />
              Notificações
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => setShowRecordModal(true)}
            >
              <PlusSquare className="w-6 h-6 mr-3" />
              Criar
            </Button>
            
            <Button variant="ghost" className="w-full justify-start">
              <User className="w-6 h-6 mr-3" />
              Perfil
            </Button>
          </nav>

          {/* Usuário Logado */}
          <div className="absolute bottom-6 left-6 right-6">
            <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted cursor-pointer">
              <Avatar className="w-10 h-10">
                <AvatarImage src={userProfile?.avatar_url} />
                <AvatarFallback>
                  {displayName[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="w-8 h-8"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 ml-64">
        <div className="max-w-6xl mx-auto flex">
          {/* Feed Central */}
          <div className="flex-1 max-w-xl mx-auto">
            {children}
          </div>

          {/* Sidebar Direita */}
          <div className="w-80 p-6 sticky top-0 h-screen overflow-y-auto">
            <div className="space-y-6">
              {/* Perfil do Usuário */}
              <div className="flex items-center space-x-3">
                <Avatar className="w-14 h-14">
                  <AvatarImage src={userProfile?.avatar_url} />
                  <AvatarFallback>
                    {displayName[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {userProfile?.bio || 'Compartilhando áudios efêmeros'}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Sugestões */}
              <UserSuggestions />

              <Separator />

              {/* Rodapé */}
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <a href="#" className="hover:underline">Sobre</a>
                  <a href="#" className="hover:underline">Ajuda</a>
                  <a href="#" className="hover:underline">Imprensa</a>
                  <a href="#" className="hover:underline">API</a>
                  <a href="#" className="hover:underline">Privacidade</a>
                  <a href="#" className="hover:underline">Termos</a>
                </div>
                <p className="pt-2">© 2025 SHHHH FROM NUTEF</p>
              </div>
            </div>
          </div>
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

export default InstagramLayout;
