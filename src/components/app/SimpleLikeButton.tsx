
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
  const [isLoading, setIsLoading] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user && userLikes) {
      const userHasLiked = userLikes.some(like => like.user_id === user.id);
      setIsLiked(userHasLiked);
      console.log(`💖 Post ${postId}: User ${user.id} liked? ${userHasLiked}`);
    }
  }, [user, userLikes, postId]);

  useEffect(() => {
    setLikesCount(initialLikesCount || 0);
    console.log(`📊 Post ${postId}: Atualizando likesCount para ${initialLikesCount}`);
  }, [initialLikesCount, postId]);

  const toggleLike = async () => {
    if (!user || isLoading) return;

    setIsLoading(true);
    const previousIsLiked = isLiked;
    const previousLikesCount = likesCount;

    try {
      if (isLiked) {
        // Optimistic update
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));

        console.log(`👎 Removendo like do post ${postId}`);
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('audio_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Optimistic update
        setIsLiked(true);
        setLikesCount(prev => prev + 1);

        console.log(`👍 Adicionando like ao post ${postId}`);
        const { error } = await supabase
          .from('likes')
          .insert({
            audio_id: postId,
            user_id: user.id
          });

        if (error) throw error;
      }

      // Removido a invalidação das queries para evitar conflito com updates otimistas

    } catch (error) {
      console.error('❌ Erro ao curtir post:', error);
      
      // Rollback on error
      setIsLiked(previousIsLiked);
      setLikesCount(previousLikesCount);
      
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
