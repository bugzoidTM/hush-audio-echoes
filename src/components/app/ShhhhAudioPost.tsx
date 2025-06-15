
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Share, MoreHorizontal, Play, Pause, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import HashtagLink from './HashtagLink';
import AudioCountdownTimer from './AudioCountdownTimer';
import { getFilterDisplayName } from '@/utils/audioUtils';

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
}

const ShhhhAudioPost = ({ post }: ShhhhAudioPostProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const isLiked = post.likes.some(like => like.user_id === user?.id);
  const displayName = post.profiles?.display_name || post.profiles?.username || 'Usuário';

  const handlePlay = () => {
    if (!audio) {
      const newAudio = new Audio(post.audio_url);
      newAudio.addEventListener('ended', () => setIsPlaying(false));
      setAudio(newAudio);
      newAudio.play();
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play();
        setIsPlaying(true);
      }
    }
  };

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

  const handleUserClick = () => {
    if (post.profiles?.id) {
      navigate(`/user/${post.profiles.id}`);
    }
  };

  // Função para processar texto e tornar hashtags clicáveis
  const processDescription = (text: string) => {
    if (!text) return null;
    
    const parts = text.split(/(\#\w+)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return <HashtagLink key={index} hashtag={part} />;
      }
      return part;
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-0">
        {/* Header do Post */}
        <div className="flex items-center space-x-3 p-4 pb-3">
          <Avatar 
            className="w-8 h-8 cursor-pointer" 
            onClick={handleUserClick}
          >
            <AvatarImage src={post.profiles?.avatar_url} />
            <AvatarFallback>
              {displayName[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <p 
              className="text-sm font-semibold cursor-pointer hover:underline" 
              onClick={handleUserClick}
            >
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { 
                addSuffix: true, 
                locale: ptBR 
              })}
            </p>
          </div>
          
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>

        {/* Conteúdo do Áudio */}
        <div className="px-4 pb-3">
          {post.title && (
            <h3 className="font-semibold text-sm mb-1">{post.title}</h3>
          )}
          {post.description && (
            <div className="text-sm text-muted-foreground mb-3">
              {processDescription(post.description)}
            </div>
          )}
          
          {/* Player de Áudio */}
          <div className="bg-muted rounded-lg p-3">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handlePlay}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </Button>
              
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <div className="h-8 flex items-center space-x-1">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 bg-primary/40 rounded-full ${
                          isPlaying ? 'animate-pulse' : ''
                        }`}
                        style={{
                          height: `${Math.random() * 20 + 8}px`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">
                    {Math.floor(post.duration / 60)}:{(post.duration % 60).toString().padStart(2, '0')}
                  </p>
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>Filtro: {getFilterDisplayName(post.voice_filter)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Contador regressivo */}
            <AudioCountdownTimer expiresAt={post.expires_at} />
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-auto"
              onClick={handleLike}
            >
              <Heart 
                className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} 
              />
            </Button>
            
            <Button variant="ghost" size="sm" className="p-0 h-auto">
              <MessageCircle className="w-6 h-6" />
            </Button>
            
            <Button variant="ghost" size="sm" className="p-0 h-auto">
              <Share className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Likes e Comentários */}
        <div className="px-4 pb-4">
          {post.likes_count > 0 && (
            <p className="text-sm font-semibold mb-1">
              {post.likes_count} {post.likes_count === 1 ? 'curtida' : 'curtidas'}
            </p>
          )}
          
          {post.replies_count > 0 && (
            <p className="text-sm text-muted-foreground">
              Ver todos os {post.replies_count} comentários
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ShhhhAudioPost;
