
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ShhhhAudioPostHeaderProps {
  post: {
    id: string;
    user_id: string;
    created_at: string;
    profiles: {
      id: string;
      username?: string;
      display_name?: string;
      avatar_url?: string;
    } | null;
  };
  currentUserId?: string;
  onUserClick: () => void;
  onDelete?: () => void;
}

const ShhhhAudioPostHeader = ({ post, currentUserId, onUserClick, onDelete }: ShhhhAudioPostHeaderProps) => {
  const displayName = post.profiles?.display_name || post.profiles?.username || 'Usuário';
  const isOwnPost = currentUserId === post.user_id;

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
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isOwnPost && onDelete && (
            <DropdownMenuItem 
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir post
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ShhhhAudioPostHeader;
