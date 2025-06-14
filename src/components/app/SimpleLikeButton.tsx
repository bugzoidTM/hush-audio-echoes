
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface SimpleLikeButtonProps {
  postId: string;
  initialLikesCount: number;
  userLikes?: Array<{ user_id: string }>;
}

const SimpleLikeButton = ({ postId, initialLikesCount, userLikes }: SimpleLikeButtonProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(initialLikesCount || 0);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user && userLikes) {
      setIsLiked(userLikes.some(like => like.user_id === user.id));
    }
  }, [user, userLikes]);

  const toggleLike = async () => {
    if (!user) return;

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('audio_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;
        
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({
            audio_id: postId,
            user_id: user.id
          });

        if (error) throw error;
        
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Erro ao curtir:', error);
      toast({
        title: "Erro",
        description: "Não foi possível curtir o áudio",
        variant: "destructive"
      });
    }
  };

  return (
    <Button
      onClick={toggleLike}
      variant="ghost"
      size="sm"
      className="p-0 h-auto"
    >
      <Heart 
        className={`w-5 h-5 mr-1 ${isLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} 
      />
      <span className="text-sm">{likesCount}</span>
    </Button>
  );
};

export default SimpleLikeButton;
