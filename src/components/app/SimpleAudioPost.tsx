
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, Play, Pause, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface AudioPost {
  id: string;
  description: string;
  audio_url: string;
  duration: number;
  created_at: string;
  user_id: string;
  likes_count: number;
  profiles?: {
    username?: string;
    avatar_url?: string;
  } | null;
  likes?: Array<{ user_id: string }>;
}

interface SimpleAudioPostProps {
  post: AudioPost;
}

const SimpleAudioPost = ({ post }: SimpleAudioPostProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user && post.likes) {
      setIsLiked(post.likes.some(like => like.user_id === user.id));
    }
  }, [user, post.likes]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'agora';
    if (diffInHours < 24) return `${diffInHours}h`;
    return `${Math.floor(diffInHours / 24)}d`;
  };

  const togglePlayback = () => {
    if (!audio && !isPlaying) {
      const newAudio = new Audio(post.audio_url);
      newAudio.addEventListener('ended', () => {
        setIsPlaying(false);
        setAudio(null);
      });
      newAudio.addEventListener('error', () => {
        toast({
          title: "Erro",
          description: "Não foi possível reproduzir o áudio",
          variant: "destructive"
        });
        setIsPlaying(false);
        setAudio(null);
      });
      newAudio.play();
      setAudio(newAudio);
      setIsPlaying(true);
    } else if (audio) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleLike = async () => {
    if (!user) return;

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('audio_id', post.id)
          .eq('user_id', user.id);

        if (error) throw error;
        
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({
            audio_id: post.id,
            user_id: user.id
          });

        if (error) throw error;
        
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Erro ao curtir:', error);
      toast({
        title: "Erro",
        description: "Não foi possível curtir o áudio",
        variant: "destructive"
      });
    }
  };

  const renderDescription = (text: string | null | undefined) => {
    if (!text) return 'Sem descrição';
    
    return text.split(/(\s+)/).map((word, index) => {
      if (word.startsWith('#')) {
        return (
          <span key={index} className="text-blue-500 font-medium">
            {word}
          </span>
        );
      }
      return word;
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-3">
          <Avatar className="w-8 h-8">
            <AvatarImage src={post.profiles?.avatar_url} />
            <AvatarFallback className="text-xs">
              {post.profiles?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-sm">
                {post.profiles?.username || 'Usuário'}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(post.created_at)}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Descrição */}
          <p className="text-sm leading-relaxed">
            {renderDescription(post.description)}
          </p>

          {/* Player de Áudio */}
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Button
                onClick={togglePlayback}
                size="sm"
                variant="outline"
                className="rounded-full w-10 h-10 p-0"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </Button>
              
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Áudio</span>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(post.duration)}</span>
                  </div>
                </div>
                <div className="mt-1 w-full bg-background rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full w-0"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center space-x-4">
            <Button
              onClick={toggleLike}
              variant="ghost"
              size="sm"
              className="p-0 h-auto"
            >
              <Heart 
                className={`w-5 h-5 mr-1 ${isLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} 
              />
              <span className="text-sm">{likesCount}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleAudioPost;
