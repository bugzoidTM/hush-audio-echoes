
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate } from '@/utils/audioUtils';

interface SimplePostHeaderProps {
  username?: string;
  avatarUrl?: string;
  createdAt: string;
}

const SimplePostHeader = ({ username, avatarUrl, createdAt }: SimplePostHeaderProps) => {
  return (
    <div className="flex items-center space-x-3">
      <Avatar className="w-8 h-8">
        <AvatarImage src={avatarUrl} />
        <AvatarFallback className="text-xs">
          {username?.[0]?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-sm">
            {username || 'Usuário'}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SimplePostHeader;
