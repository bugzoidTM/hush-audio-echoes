
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Bookmark, Repeat } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import SimplePostHeader from './SimplePostHeader';
import SimplePostDescription from './SimplePostDescription';
import SimpleAudioPlayer from './SimpleAudioPlayer';
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
  likes?: Array<{
    user_id: string;
  }>;
  reposts?: Array<{
    user_id: string;
  }>;
}

interface InstagramAudioPostProps {
  post: AudioPost;
}

const InstagramAudioPost = ({ post }: InstagramAudioPostProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isLiked, setIsLiked] = useState(post.likes?.some(like => like.user_id === user?.id) || false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [isReposted, setIsReposted] = useState(post.reposts?.some(repost => repost.user_id === user?.id) || false);
  const [repostsCount, setRepostsCount] = useState(post.reposts_count || 0);
  const [isSaved, setIsSaved] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);

  const handleLike = async () => {
    if (!user) return;
    try {
      if (isLiked) {
        const { error } = await supabase.from('likes').delete().eq('user_id', user.id).eq('audio_id', post.id);
        if (error) throw error;
        setIsLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        const { error } = await supabase.from('likes').insert({
          user_id: user.id,
          audio_id: post.id
        });
        if (error) throw error;
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível processar a curtida",
        variant: "destructive"
      });
    }
  };

  const handleRepost = async () => {
    if (!user) return;
    try {
      if (isReposted) {
        const { error } = await supabase
          .from('audio_reposts')
          .delete()
          .eq('user_id', user.id)
          .eq('original_audio_id', post.id);
        if (error) throw error;
        setIsReposted(false);
        setRepostsCount(prev => prev - 1);
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
        setIsReposted(true);
        setRepostsCount(prev => prev + 1);
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

  const handleComment = () => {
    setShowReplyModal(true);
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    toast({
      title: isSaved ? "Removido dos salvos" : "Salvo",
      description: isSaved ? "Áudio removido dos salvos" : "Áudio salvo com sucesso"
    });
  };

  return (
    <>
      <Card className="w-full border-0 border-b border-border rounded-none">
        <CardHeader className="pb-3">
          <SimplePostHeader 
            username={post.profiles?.username} 
            avatarUrl={post.profiles?.avatar_url} 
            createdAt={post.created_at} 
          />
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {/* Player de Áudio */}
          <SimpleAudioPlayer 
            audioUrl={post.audio_url} 
            duration={post.duration} 
            voiceFilter={post.voice_filter} 
            expiresAt={post.expires_at} 
          />

          {/* Descrição */}
          <div>
            <SimplePostDescription description={post.description} />
          </div>

          {/* Ações do Instagram */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLike} 
                className={`p-0 h-auto ${isLiked ? 'text-red-500' : ''}`}
              >
                <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleComment} 
                className="p-0 h-auto"
              >
                <MessageCircle className="w-6 h-6" />
              </Button>

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRepost} 
                className={`p-0 h-auto ${isReposted ? 'text-green-500' : ''}`}
              >
                <Repeat className="w-6 h-6" />
              </Button>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSave} 
              className={`p-0 h-auto ${isSaved ? 'text-black' : ''}`}
            >
              <Bookmark className={`w-6 h-6 ${isSaved ? 'fill-current' : ''}`} />
            </Button>
          </div>

          {/* Contadores */}
          <div className="space-y-1">
            {likesCount > 0 && (
              <div className="text-sm font-semibold">
                {likesCount} {likesCount === 1 ? 'curtida' : 'curtidas'}
              </div>
            )}
            
            {repostsCount > 0 && (
              <div className="text-sm text-muted-foreground">
                {repostsCount} {repostsCount === 1 ? 'republicação' : 'republicações'}
              </div>
            )}

            {post.replies_count > 0 && (
              <div className="text-sm text-muted-foreground">
                {post.replies_count} {post.replies_count === 1 ? 'resposta' : 'respostas'}
              </div>
            )}
          </div>

          {/* Link para comentários */}
          <button 
            onClick={handleComment} 
            className="text-sm text-muted-foreground hover:underline"
          >
            Responder com áudio...
          </button>
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

export default InstagramAudioPost;
