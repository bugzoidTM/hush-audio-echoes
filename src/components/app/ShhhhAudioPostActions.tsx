
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share } from 'lucide-react';

interface ShhhhAudioPostActionsProps {
  isLiked: boolean;
  onLike: () => void;
}

const ShhhhAudioPostActions = ({ isLiked, onLike }: ShhhhAudioPostActionsProps) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          className="p-0 h-auto"
          onClick={onLike}
        >
          <Heart 
            className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} 
          />
        </Button>
        
        <Button variant="ghost" size="sm" className="p-0 h-auto">
          <MessageCircle className="w-6 h-6" />
        </Button>
        
        <Button variant="ghost" size="sm" className="p-0 h-auto">
          <Share className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
};

export default ShhhhAudioPostActions;
