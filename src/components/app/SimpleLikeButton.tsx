
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
  onLikeChange?: (liked: boolean, newCount: number) => void;
}

const SimpleLikeButton = ({ postId, initialLikesCount, userLikes, onLikeChange }: SimpleLikeButtonProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(initialLikesCount || 0);
  const [isLoading, setIsLoading] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Sync state with props when they change
  useEffect(() => {
    console.log(`🔄 [SimpleLikeButton] Sincronizando estado para post ${postId}:`, {
      initialLikesCount,
      userLikes: userLikes?.length || 0,
      userId: user?.id
    });

    if (user && userLikes) {
      const userHasLiked = userLikes.some(like => like.user_id === user.id);
      setIsLiked(userHasLiked);
    } else {
      setIsLiked(false);
    }
    
    // Sempre usar a contagem inicial fornecida
    setLikesCount(initialLikesCount || 0);
  }, [user, userLikes, initialLikesCount, postId]);

  const toggleLike = async () => {
    if (!user || isLoading) {
      console.log('❌ [SimpleLikeButton] Usuário não logado ou carregando');
      return;
    }

    setIsLoading(true);
    
    // Backup do estado atual
    const previousIsLiked = isLiked;
    const previousCount = likesCount;
    
    try {
      if (isLiked) {
        // Atualização otimista - remover like
        console.log(`👎 [SimpleLikeButton] Removendo like do post ${postId}`);
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
        
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('audio_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Notificar componente pai da mudança
        if (onLikeChange) {
          onLikeChange(false, Math.max(0, previousCount - 1));
        }

      } else {
        // Atualização otimista - adicionar like
        console.log(`👍 [SimpleLikeButton] Adicionando like ao post ${postId}`);
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
        
        const { error } = await supabase
          .from('likes')
          .insert({
            audio_id: postId,
            user_id: user.id
          });

        if (error) throw error;

        // Notificar componente pai da mudança
        if (onLikeChange) {
          onLikeChange(true, previousCount + 1);
        }
      }

      console.log(`✅ [SimpleLikeButton] Like processado com sucesso para post ${postId}`);

      // Invalidar queries relacionadas após operação bem-sucedida
      await queryClient.invalidateQueries({ 
        queryKey: ['audio-posts'],
        exact: false 
      });

    } catch (error) {
      console.error('❌ [SimpleLikeButton] Erro ao processar like:', error);
      
      // Rollback em caso de erro
      setIsLiked(previousIsLiked);
      setLikesCount(previousCount);
      
      if (onLikeChange) {
        onLikeChange(previousIsLiked, previousCount);
      }
      
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
