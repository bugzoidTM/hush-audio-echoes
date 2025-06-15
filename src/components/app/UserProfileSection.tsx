
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut } from 'lucide-react';

interface UserProfileSectionProps {
  userProfile: any;
  displayName: string;
  onSignOut: () => void;
}

const UserProfileSection = ({ userProfile, displayName, onSignOut }: UserProfileSectionProps) => {
  return (
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
          onClick={onSignOut}
          className="w-8 h-8"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default UserProfileSection;
