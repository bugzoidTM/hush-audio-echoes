
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
  const [likesCount, setLikesCount] = useState(initialLikesCount);
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

  // Sincronizar likes count com prop
  useEffect(() => {
    setLikesCount(initialLikesCount);
  }, [initialLikesCount]);

  const toggleLike = async () => {
    if (!user || isLoading) {
      console.log('❌ [SimpleLikeButton] Usuário não logado ou operação em andamento');
      toast({
        title: "Login necessário",
        description: "Faça login para curtir posts",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    // Optimistic update
    const wasLiked = isLiked;
    const previousCount = likesCount;
    
    setIsLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);
    
    try {
      if (wasLiked) {
        console.log(`👎 [SimpleLikeButton] Removendo like do post ${postId}`);
        
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('audio_id', postId)
          .eq('user_id', user.id);

        if (error) {
          console.error('❌ [SimpleLikeButton] Erro ao remover like:', error);
          throw error;
        }

      } else {
        console.log(`👍 [SimpleLikeButton] Adicionando like ao post ${postId}`);
        
        const { error } = await supabase
          .from('likes')
          .insert({
            audio_id: postId,
            user_id: user.id
          });

        if (error) {
          console.error('❌ [SimpleLikeButton] Erro ao adicionar like:', error);
          throw error;
        }
      }

      console.log(`✅ [SimpleLikeButton] Like processado com sucesso para post ${postId}`);

      // Invalidar cache para buscar dados atualizados
      queryClient.invalidateQueries({ 
        queryKey: ['audio-posts'],
        exact: false 
      });

    } catch (error: any) {
      console.error('❌ [SimpleLikeButton] Erro ao processar like:', error);
      
      // Rollback optimistic update
      setIsLiked(wasLiked);
      setLikesCount(previousCount);
      
      let errorMessage = "Não foi possível curtir o áudio";
      
      // Handle specific error types
      if (error.code === '23505') {
        errorMessage = "Você já curtiu este post";
      } else if (error.code === '42501') {
        errorMessage = "Acesso negado - verifique se está logado";
      } else if (error.message?.includes('RLS')) {
        errorMessage = "Erro de permissão - tente fazer login novamente";
      }
      
      toast({
        title: "Erro",
        description: errorMessage,
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
      disabled={isLoading || !user}
    >
      <Heart 
        className={`w-5 h-5 mr-1 ${
          isLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
        } ${isLoading ? 'opacity-50' : ''}`} 
      />
      <span className="text-sm">{likesCount}</span>
    </Button>
  );
};

export default SimpleLikeButton;
