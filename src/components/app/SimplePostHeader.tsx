
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import UserProfileLink from './UserProfileLink';

interface SimplePostHeaderProps {
  username?: string;
  avatarUrl?: string;
  createdAt: string;
  userId?: string;
}

const SimplePostHeader = ({ username, avatarUrl, createdAt, userId }: SimplePostHeaderProps) => {
  return (
    <div className="flex items-center space-x-3">
      <Avatar className="w-8 h-8">
        <AvatarImage src={avatarUrl} />
        <AvatarFallback>
          {username?.[0]?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex items-center space-x-2">
        {userId ? (
          <UserProfileLink 
            userId={userId} 
            username={username}
            className="font-semibold text-sm"
          >
            {username || 'Usuário'}
          </UserProfileLink>
        ) : (
          <span className="font-semibold text-sm">{username || 'Usuário'}</span>
        )}
        
        <span className="text-muted-foreground">•</span>
        
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(createdAt), { 
            addSuffix: true, 
            locale: ptBR 
          })}
        </span>
      </div>
    </div>
  );
};

export default SimplePostHeader;
