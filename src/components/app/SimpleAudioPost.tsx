
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Repeat } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import SimplePostHeader from './SimplePostHeader';
import SimplePostDescription from './SimplePostDescription';
import SimpleAudioPlayer from './SimpleAudioPlayer';
import SimpleLikeButton from './SimpleLikeButton';
import ReplyModal from './ReplyModal';

interface AudioPost {
  id: string;
  description: string;
  audio_url: string;
  duration: number;
  created_at: string;
  expires_at: string;
  user_id: string;
  likes_count: number;
  replies_count: number;
  reposts_count: number;
  voice_filter?: string;
  profiles?: {
    username?: string;
    avatar_url?: string;
  } | null;
  likes?: Array<{ user_id: string }>;
  reposts?: Array<{ user_id: string }>;
}

interface SimpleAudioPostProps {
  post: AudioPost;
}

const SimpleAudioPost = ({ post }: SimpleAudioPostProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estado local sincronizado com os dados do post
  const [currentPost, setCurrentPost] = useState(post);

  // Atualizar estado local quando post muda
  useEffect(() => {
    console.log(`📊 [SimpleAudioPost] Atualizando post ${post.id}:`, {
      likesCount: post.likes_count,
      likesArray: post.likes?.length || 0
    });
    setCurrentPost(post);
  }, [post]);

  const handleLikeChange = (liked: boolean, newCount: number) => {
    console.log(`🔄 [SimpleAudioPost] Mudança de like para post ${post.id}:`, {
      liked,
      newCount,
      previousCount: currentPost.likes_count
    });
    
    // Atualizar estado local imediatamente
    setCurrentPost(prev => ({
      ...prev,
      likes_count: newCount,
      likes: liked 
        ? [...(prev.likes || []), { user_id: user?.id || '' }]
        : (prev.likes || []).filter(like => like.user_id !== user?.id)
    }));
  };

  const handleRepost = async () => {
    if (!user) return;
    
    const isReposted = currentPost.reposts?.some(repost => repost.user_id === user.id) || false;
    
    try {
      if (isReposted) {
        const { error } = await supabase
          .from('audio_reposts')
          .delete()
          .eq('user_id', user.id)
          .eq('original_audio_id', post.id);
        if (error) throw error;
        
        setCurrentPost(prev => ({
          ...prev,
          reposts_count: Math.max(0, prev.reposts_count - 1),
          reposts: (prev.reposts || []).filter(repost => repost.user_id !== user.id)
        }));
        
        toast({
          title: "Republicação removida",
          description: "Áudio removido do seu perfil"
        });
      } else {
        const { error } = await supabase
          .from('audio_reposts')
          .insert({
            user_id: user.id,
            original_audio_id: post.id
          });
        if (error) throw error;
        
        setCurrentPost(prev => ({
          ...prev,
          reposts_count: prev.reposts_count + 1,
          reposts: [...(prev.reposts || []), { user_id: user.id }]
        }));
        
        toast({
          title: "Áudio republicado",
          description: "Áudio adicionado ao seu perfil"
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['audio-posts'] });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível republicar o áudio",
        variant: "destructive"
      });
    }
  };

  const [showReplyModal, setShowReplyModal] = useState(false);
  const isReposted = currentPost.reposts?.some(repost => repost.user_id === user?.id) || false;

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <SimplePostHeader 
            username={currentPost.profiles?.username}
            avatarUrl={currentPost.profiles?.avatar_url}
            createdAt={currentPost.created_at}
          />
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Descrição */}
            <SimplePostDescription description={currentPost.description} />

            {/* Player de Áudio */}
            <SimpleAudioPlayer 
              audioUrl={currentPost.audio_url}
              duration={currentPost.duration}
              voiceFilter={currentPost.voice_filter}
              expiresAt={currentPost.expires_at}
            />

            {/* Ações */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <SimpleLikeButton 
                  postId={currentPost.id}
                  initialLikesCount={currentPost.likes_count}
                  userLikes={currentPost.likes}
                  onLikeChange={handleLikeChange}
                />

                <Button
                  onClick={() => setShowReplyModal(true)}
                  variant="ghost"
                  size="sm"
                  className="p-0 h-auto"
                >
                  <MessageCircle className="w-5 h-5 mr-1 text-muted-foreground" />
                  <span className="text-sm">{currentPost.replies_count}</span>
                </Button>

                <Button
                  onClick={handleRepost}
                  variant="ghost"
                  size="sm"
                  className={`p-0 h-auto ${isReposted ? 'text-green-500' : ''}`}
                >
                  <Repeat className="w-5 h-5 mr-1" />
                  <span className="text-sm">{currentPost.reposts_count}</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ReplyModal
        open={showReplyModal}
        onClose={() => setShowReplyModal(false)}
        parentPostId={currentPost.id}
        parentUsername={currentPost.profiles?.username}
      />
    </>
  );
};

export default SimpleAudioPost;
