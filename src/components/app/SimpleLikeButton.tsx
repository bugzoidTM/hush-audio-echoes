
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface SimpleLikeButtonProps {
  postId: string;
  initialLikesCount: number;
  userLikes?: Array<{ user_id: string }>;
}

const SimpleLikeButton = ({ postId, initialLikesCount, userLikes }: SimpleLikeButtonProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(initialLikesCount || 0);
  const [isLoading, setIsLoading] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Sync state with props when they change
  useEffect(() => {
    if (user && userLikes) {
      const userHasLiked = userLikes.some(like => like.user_id === user.id);
      setIsLiked(userHasLiked);
    } else {
      setIsLiked(false);
    }
    setLikesCount(initialLikesCount || 0);
  }, [user, userLikes, initialLikesCount]);

  const toggleLike = async () => {
    if (!user || isLoading) return;

    setIsLoading(true);
    
    try {
      if (isLiked) {
        // Remove like
        console.log(`👎 Removendo like do post ${postId}`);
        
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('audio_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Update local state after successful DB operation
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));

      } else {
        // Add like
        console.log(`👍 Adicionando like ao post ${postId}`);
        
        const { error } = await supabase
          .from('likes')
          .insert({
            audio_id: postId,
            user_id: user.id
          });

        if (error) throw error;

        // Update local state after successful DB operation
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }

      // Only invalidate queries after successful operation
      // Use a more specific query key to avoid unnecessary refetches
      queryClient.invalidateQueries({ 
        queryKey: ['audio-posts'], 
        exact: false,
        refetchType: 'active' 
      });

    } catch (error) {
      console.error('❌ Erro ao processar like:', error);
      
      toast({
        title: "Erro",
        description: "Não foi possível curtir o áudio",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={toggleLike}
      variant="ghost"
      size="sm"
      className="p-0 h-auto"
      disabled={isLoading}
    >
      <Heart 
        className={`w-5 h-5 mr-1 ${isLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'} ${isLoading ? 'opacity-50' : ''}`} 
      />
      <span className="text-sm">{likesCount}</span>
    </Button>
  );
};

export default SimpleLikeButton;
