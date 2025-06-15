
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
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
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const isLiked = post.likes.some(like => like.user_id === user?.id);

  const handleLike = async () => {
    if (!user) return;

    try {
      if (isLiked) {
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('audio_id', post.id);
      } else {
        await supabase
          .from('likes')
          .insert({
            user_id: user.id,
            audio_id: post.id,
          });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível processar a ação",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!user || user.id !== post.user_id) return;

    try {
      const { error } = await supabase
        .from('audio_posts')
        .update({ status: 'deleted' })
        .eq('id', post.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Post excluído",
        description: "Seu post foi excluído com sucesso",
      });

      // Notificar o componente pai que o post foi deletado
      if (onPostDeleted) {
        onPostDeleted();
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o post",
        variant: "destructive",
      });
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
        />

        <ShhhhAudioPostStats 
          likesCount={post.likes_count}
          repliesCount={post.replies_count}
        />
      </CardContent>
    </Card>
  );
};

export default ShhhhAudioPost;
