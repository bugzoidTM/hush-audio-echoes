
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ShhhhAudioPostHeaderProps {
  post: {
    created_at: string;
    profiles: {
      id: string;
      username?: string;
      display_name?: string;
      avatar_url?: string;
    } | null;
  };
  onUserClick: () => void;
}

const ShhhhAudioPostHeader = ({ post, onUserClick }: ShhhhAudioPostHeaderProps) => {
  const displayName = post.profiles?.display_name || post.profiles?.username || 'Usuário';

  return (
    <div className="flex items-center space-x-3 p-4 pb-3">
      <Avatar 
        className="w-8 h-8 cursor-pointer" 
        onClick={onUserClick}
      >
        <AvatarImage src={post.profiles?.avatar_url} />
        <AvatarFallback>
          {displayName[0]?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1">
        <p 
          className="text-sm font-semibold cursor-pointer hover:underline" 
          onClick={onUserClick}
        >
          {displayName}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(post.created_at), { 
            addSuffix: true, 
            locale: ptBR 
          })}
        </p>
      </div>
      
      <Button variant="ghost" size="icon" className="w-8 h-8">
        <MoreHorizontal className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default ShhhhAudioPostHeader;
