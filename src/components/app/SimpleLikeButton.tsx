
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
  const [isLoading, setIsLoading] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Verificar se usuário curtiu baseado nos dados recebidos
  useEffect(() => {
    if (user && userLikes) {
      const userHasLiked = userLikes.some(like => like.user_id === user.id);
      setIsLiked(userHasLiked);
      console.log(`👤 [SimpleLikeButton] Post ${postId} - Usuário ${userHasLiked ? 'curtiu' : 'não curtiu'}`);
    } else {
      setIsLiked(false);
    }
  }, [user?.id, userLikes, postId]);

  const toggleLike = async () => {
    if (!user || isLoading) {
      console.log('❌ [SimpleLikeButton] Usuário não logado ou operação em andamento');
      return;
    }

    setIsLoading(true);
    
    try {
      if (isLiked) {
        console.log(`👎 [SimpleLikeButton] Removendo like do post ${postId}`);
        
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('audio_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;

      } else {
        console.log(`👍 [SimpleLikeButton] Adicionando like ao post ${postId}`);
        
        const { error } = await supabase
          .from('likes')
          .insert({
            audio_id: postId,
            user_id: user.id
          });

        if (error) throw error;
      }

      console.log(`✅ [SimpleLikeButton] Like processado com sucesso para post ${postId}`);

      // Invalidar cache para buscar dados atualizados
      queryClient.invalidateQueries({ 
        queryKey: ['audio-posts'],
        exact: false 
      });

    } catch (error) {
      console.error('❌ [SimpleLikeButton] Erro ao processar like:', error);
      
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
        className={`w-5 h-5 mr-1 ${
          isLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
        } ${isLoading ? 'opacity-50' : ''}`} 
      />
      <span className="text-sm">{initialLikesCount}</span>
    </Button>
  );
};

export default SimpleLikeButton;
