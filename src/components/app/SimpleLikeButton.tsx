
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

  // Inicializar estado baseado nos dados do servidor
  useEffect(() => {
    if (user && userLikes) {
      const userHasLiked = userLikes.some(like => like.user_id === user.id);
      setIsLiked(userHasLiked);
      console.log(`💖 Post ${postId}: User ${user.id} liked? ${userHasLiked}`);
    } else {
      setIsLiked(false);
    }
  }, [user, userLikes, postId]);

  // Atualizar likes count apenas quando os dados do servidor mudarem
  useEffect(() => {
    console.log(`📊 Post ${postId}: Atualizando likesCount de ${likesCount} para ${initialLikesCount}`);
    setLikesCount(initialLikesCount || 0);
  }, [initialLikesCount, postId]);

  const toggleLike = async () => {
    if (!user || isLoading) return;

    setIsLoading(true);
    
    // Guardar estado anterior para rollback
    const previousIsLiked = isLiked;
    const previousLikesCount = likesCount;

    try {
      if (isLiked) {
        // Update otimista primeiro
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));

        console.log(`👎 Removendo like do post ${postId}`);
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('audio_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Atualizar o cache do query client com novos dados
        queryClient.setQueryData(['audio-posts'], (oldData: any) => {
          if (!oldData) return oldData;
          
          return oldData.map((post: any) => {
            if (post.id === postId) {
              return {
                ...post,
                likes: post.likes.filter((like: any) => like.user_id !== user.id),
                likes_count: Math.max(0, post.likes_count - 1)
              };
            }
            return post;
          });
        });

      } else {
        // Update otimista primeiro
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

        // Atualizar o cache do query client com novos dados
        queryClient.setQueryData(['audio-posts'], (oldData: any) => {
          if (!oldData) return oldData;
          
          return oldData.map((post: any) => {
            if (post.id === postId) {
              return {
                ...post,
                likes: [...post.likes, { user_id: user.id }],
                likes_count: post.likes_count + 1
              };
            }
            return post;
          });
        });
      }

      console.log(`✅ Like processado com sucesso para post ${postId}. Novo estado: liked=${!previousIsLiked}, count=${!previousIsLiked ? previousLikesCount + 1 : previousLikesCount - 1}`);

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
