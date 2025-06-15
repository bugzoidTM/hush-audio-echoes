import { Card, CardContent } from '@/components/ui/card';
import { useSecureAuth } from '@/hooks/useSecureAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useRateLimiter } from '@/hooks/useRateLimiter';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import ShhhhAudioPostHeader from './ShhhhAudioPostHeader';
import ShhhhAudioPostContent from './ShhhhAudioPostContent';
import ShhhhAudioPlayer from './ShhhhAudioPlayer';
import ShhhhAudioPostActions from './ShhhhAudioPostActions';
import ShhhhAudioPostStats from './ShhhhAudioPostStats';

interface ShhhhAudioPostProps {
  post: {
    id: string;
    user_id: string;
    title?: string;
    description?: string;
    audio_url: string;
    duration: number;
    created_at: string;
    expires_at: string;
    voice_filter?: string;
    likes_count: number;
    replies_count: number;
    profiles: {
      id: string;
      username?: string;
      display_name?: string;
      avatar_url?: string;
    } | null;
    likes: Array<{ user_id: string }>;
  };
  onPostDeleted?: () => void;
}

const ShhhhAudioPost = ({ post, onPostDeleted }: ShhhhAudioPostProps) => {
  const { user, isAuthenticated } = useSecureAuth({ requireAuth: false });
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Local state for likes to ensure immediate UI updates
  const [localLikesCount, setLocalLikesCount] = useState(post.likes_count || 0);
  const [isLiked, setIsLiked] = useState(post.likes.some(like => like.user_id === user?.id));

  // Update local state when post data changes
  useEffect(() => {
    setLocalLikesCount(post.likes_count || 0);
    setIsLiked(post.likes.some(like => like.user_id === user?.id));
  }, [post.likes_count, post.likes, user?.id]);

  const likeRateLimiter = useRateLimiter('like_action', {
    maxAttempts: 10,
    windowMs: 60000, // 1 minute
  });

  const handleLike = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Login necessário",
        description: "Faça login para curtir posts",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    if (!likeRateLimiter.checkRateLimit()) {
      toast({
        title: "Muitas curtidas",
        description: "Aguarde antes de curtir novamente",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isLiked) {
        // Optimistic update - remove like immediately
        setIsLiked(false);
        setLocalLikesCount(prev => Math.max(0, prev - 1));

        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user!.id)
          .eq('audio_id', post.id);

        if (error) throw error;
      } else {
        // Optimistic update - add like immediately
        setIsLiked(true);
        setLocalLikesCount(prev => prev + 1);

        const { error } = await supabase
          .from('likes')
          .insert({
            user_id: user!.id,
            audio_id: post.id,
          });

        if (error) throw error;
      }

      // Invalidate queries to refresh the data from server
      queryClient.invalidateQueries({ queryKey: ['audio-posts'] });
    } catch (error: any) {
      console.error('❌ [ShhhhAudioPost] Erro ao processar like:', error);
      
      // Rollback optimistic update on error
      setIsLiked(post.likes.some(like => like.user_id === user?.id));
      setLocalLikesCount(post.likes_count || 0);
      
      // Handle specific error types
      if (error.code === '23505') { // Unique constraint violation
        toast({
          title: "Ação já realizada",
          description: "Você já curtiu este post",
          variant: "destructive",
        });
      } else if (error.code === '42501') { // RLS policy violation
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para esta ação",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível processar a curtida",
          variant: "destructive",
        });
      }
    }
  };

  const handleDelete = async () => {
    if (!isAuthenticated || user!.id !== post.user_id) {
      toast({
        title: "Acesso negado",
        description: "Você só pode deletar seus próprios posts",
        variant: "destructive",
      });
      return;
    }

    console.log('🗑️ [ShhhhAudioPost] Tentando deletar post:', { 
      postId: post.id, 
      userId: user!.id, 
      postUserId: post.user_id 
    });

    try {
      // Use DELETE instead of UPDATE to avoid RLS policy issues
      const { error } = await supabase
        .from('audio_posts')
        .delete()
        .eq('id', post.id)
        .eq('user_id', user!.id); // Double check ownership

      if (error) {
        console.error('❌ [ShhhhAudioPost] Erro ao deletar post:', error);
        throw error;
      }

      console.log('✅ [ShhhhAudioPost] Post deletado com sucesso');

      toast({
        title: "Post excluído",
        description: "Seu post foi excluído com sucesso",
      });

      if (onPostDeleted) {
        onPostDeleted();
      }
    } catch (error: any) {
      console.error('❌ [ShhhhAudioPost] Erro completo:', error);
      
      if (error.code === '42501') { // RLS policy violation
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para deletar este post",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível excluir o post",
          variant: "destructive",
        });
      }
    }
  };

  const handleUserClick = () => {
    if (post.profiles?.id) {
      navigate(`/user/${post.profiles.id}`);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-0">
        <ShhhhAudioPostHeader 
          post={post}
          currentUserId={user?.id}
          onUserClick={handleUserClick}
          onDelete={handleDelete}
        />

        <ShhhhAudioPostContent post={post} />
        
        <div className="px-4 pb-3">
          <ShhhhAudioPlayer post={post} />
        </div>

        <ShhhhAudioPostActions 
          isLiked={isLiked}
          onLike={handleLike}
          disabled={!isAuthenticated}
        />

        <ShhhhAudioPostStats 
          likesCount={localLikesCount}
          repliesCount={post.replies_count || 0}
        />
      </CardContent>
    </Card>
  );
};

export default ShhhhAudioPost;
