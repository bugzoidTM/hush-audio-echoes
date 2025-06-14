
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Home, Search, Compass, Heart, PlusSquare, User, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SimpleRecordModal from './SimpleRecordModal';
import UserSuggestions from './UserSuggestions';

interface InstagramLayoutProps {
  children: React.ReactNode;
}

const InstagramLayout = ({ children }: InstagramLayoutProps) => {
  const { user, signOut } = useAuth();
  const [showRecordModal, setShowRecordModal] = useState(false);
  const location = useLocation();

  const menuItems = [
    { icon: Home, label: 'Página inicial', path: '/app', active: location.pathname === '/app' },
    { icon: Search, label: 'Pesquisa', path: '/search', active: false },
    { icon: Compass, label: 'Explorar', path: '/explore', active: false },
    { icon: Heart, label: 'Notificações', path: '/notifications', active: false },
    { icon: PlusSquare, label: 'Criar', path: '#', active: false, action: () => setShowRecordModal(true) },
    { icon: User, label: 'Perfil', path: '/profile', active: false },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Barra Lateral Esquerda */}
      <div className="w-64 border-r border-border bg-background fixed h-full left-0 top-0 z-10">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary mb-8">Shhhh</h1>
          
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <div key={item.label}>
                {item.action ? (
                  <Button
                    variant="ghost"
                    className={`w-full justify-start text-left px-3 py-3 h-auto ${
                      item.active ? 'font-bold' : 'font-normal'
                    }`}
                    onClick={item.action}
                  >
                    <item.icon className="w-6 h-6 mr-4" />
                    <span className="text-base">{item.label}</span>
                  </Button>
                ) : (
                  <Link to={item.path}>
                    <Button
                      variant="ghost"
                      className={`w-full justify-start text-left px-3 py-3 h-auto ${
                        item.active ? 'font-bold' : 'font-normal'
                      }`}
                    >
                      <item.icon className="w-6 h-6 mr-4" />
                      <span className="text-base">{item.label}</span>
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Perfil na parte inferior */}
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-border">
          <div className="flex items-center space-x-3 mb-4">
            <Avatar className="w-10 h-10">
              <AvatarImage src="" />
              <AvatarFallback>
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            onClick={signOut}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 ml-64">
        <div className="max-w-6xl mx-auto flex">
          {/* Feed Central */}
          <div className="flex-1 max-w-2xl mx-auto px-4 py-6">
            {children}
          </div>

          {/* Painel Direito */}
          <div className="w-80 p-6 border-l border-border">
            {/* Perfil Logado */}
            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-4">
                <Avatar className="w-14 h-14">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-lg">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">{user?.email}</p>
                  <p className="text-sm text-muted-foreground">Seu perfil</p>
                </div>
              </div>
            </div>

            {/* Sugestões */}
            <UserSuggestions />

            {/* Rodapé */}
            <div className="mt-8 pt-6 border-t border-border">
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-2">
                  <a href="#" className="hover:underline">Sobre</a>
                  <a href="#" className="hover:underline">Ajuda</a>
                  <a href="#" className="hover:underline">Imprensa</a>
                  <a href="#" className="hover:underline">API</a>
                  <a href="#" className="hover:underline">Carreiras</a>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href="#" className="hover:underline">Privacidade</a>
                  <a href="#" className="hover:underline">Termos</a>
                  <a href="#" className="hover:underline">Localizações</a>
                  <a href="#" className="hover:underline">Meta Verified</a>
                </div>
                <div className="pt-2">
                  <p>© 2025 SHHHH FROM NUTEF</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SimpleRecordModal 
        open={showRecordModal} 
        onClose={() => setShowRecordModal(false)} 
      />
    </div>
  );
};

export default InstagramLayout;
