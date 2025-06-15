
import { Button } from '@/components/ui/button';
import { 
  Home, 
  Search, 
  Compass, 
  Heart, 
  PlusSquare, 
  User
} from 'lucide-react';

interface SidebarNavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onCreateClick: () => void;
}

const SidebarNavigation = ({ activeSection, onSectionChange, onCreateClick }: SidebarNavigationProps) => {
  return (
    <nav className="space-y-4">
      <Button 
        variant="ghost" 
        className={`w-full justify-start ${activeSection === 'home' ? 'font-semibold' : ''}`}
        onClick={() => onSectionChange('home')}
      >
        <Home className="w-6 h-6 mr-3" />
        Página inicial
      </Button>
      
      <Button 
        variant="ghost" 
        className={`w-full justify-start ${activeSection === 'search' ? 'font-semibold' : ''}`}
        onClick={() => onSectionChange('search')}
      >
        <Search className="w-6 h-6 mr-3" />
        Pesquisa
      </Button>
      
      <Button 
        variant="ghost" 
        className={`w-full justify-start ${activeSection === 'explore' ? 'font-semibold' : ''}`}
        onClick={() => onSectionChange('explore')}
      >
        <Compass className="w-6 h-6 mr-3" />
        Explorar
      </Button>
      
      <Button 
        variant="ghost" 
        className={`w-full justify-start ${activeSection === 'notifications' ? 'font-semibold' : ''}`}
        onClick={() => onSectionChange('notifications')}
      >
        <Heart className="w-6 h-6 mr-3" />
        Notificações
      </Button>
      
      <Button 
        variant="ghost" 
        className="w-full justify-start"
        onClick={onCreateClick}
      >
        <PlusSquare className="w-6 h-6 mr-3" />
        Criar
      </Button>
      
      <Button 
        variant="ghost" 
        className={`w-full justify-start ${activeSection === 'profile' ? 'font-semibold' : ''}`}
        onClick={() => onSectionChange('profile')}
      >
        <User className="w-6 h-6 mr-3" />
        Perfil
      </Button>
    </nav>
  );
};

export default SidebarNavigation;
