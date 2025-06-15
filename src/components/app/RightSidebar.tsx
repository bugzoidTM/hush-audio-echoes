
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import UserSuggestions from './UserSuggestions';
import UserProfileLink from './UserProfileLink';

interface RightSidebarProps {
  user: any;
  userProfile: any;
  displayName: string;
}

const RightSidebar = ({ user, userProfile, displayName }: RightSidebarProps) => {
  return (
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
            {user?.id ? (
              <UserProfileLink 
                userId={user.id} 
                username={userProfile?.username}
                className="font-semibold"
              >
                {displayName}
              </UserProfileLink>
            ) : (
              <p className="font-semibold">{displayName}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {userProfile?.bio || 'Compartilhando áudios temporários'}
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
  );
};

export default RightSidebar;
