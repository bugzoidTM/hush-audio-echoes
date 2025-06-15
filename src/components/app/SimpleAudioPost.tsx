
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Repeat } from 'lucide-react';
import { useState } from 'react';
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
  const [showReplyModal, setShowReplyModal] = useState(false);

  const handleRepost = async () => {
    if (!user) return;
    
    const isReposted = post.reposts?.some(repost => repost.user_id === user.id) || false;
    
    try {
      if (isReposted) {
        const { error } = await supabase
          .from('audio_reposts')
          .delete()
          .eq('user_id', user.id)
          .eq('original_audio_id', post.id);
        if (error) throw error;
        
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

  const isReposted = post.reposts?.some(repost => repost.user_id === user?.id) || false;

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <SimplePostHeader 
            username={post.profiles?.username}
            avatarUrl={post.profiles?.avatar_url}
            createdAt={post.created_at}
          />
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Descrição */}
            <SimplePostDescription description={post.description} />

            {/* Player de Áudio */}
            <SimpleAudioPlayer 
              audioUrl={post.audio_url}
              duration={post.duration}
              voiceFilter={post.voice_filter}
              expiresAt={post.expires_at}
            />

            {/* Ações */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <SimpleLikeButton 
                  postId={post.id}
                  initialLikesCount={post.likes_count}
                  userLikes={post.likes}
                />

                <Button
                  onClick={() => setShowReplyModal(true)}
                  variant="ghost"
                  size="sm"
                  className="p-0 h-auto"
                >
                  <MessageCircle className="w-5 h-5 mr-1 text-muted-foreground" />
                  <span className="text-sm">{post.replies_count}</span>
                </Button>

                <Button
                  onClick={handleRepost}
                  variant="ghost"
                  size="sm"
                  className={`p-0 h-auto ${isReposted ? 'text-green-500' : ''}`}
                >
                  <Repeat className="w-5 h-5 mr-1" />
                  <span className="text-sm">{post.reposts_count}</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ReplyModal
        open={showReplyModal}
        onClose={() => setShowReplyModal(false)}
        parentPostId={post.id}
        parentUsername={post.profiles?.username}
      />
    </>
  );
};

export default SimpleAudioPost;
