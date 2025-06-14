
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Bookmark } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import SimplePostHeader from './SimplePostHeader';
import SimplePostDescription from './SimplePostDescription';
import SimpleAudioPlayer from './SimpleAudioPlayer';

interface AudioPost {
  id: string;
  description: string;
  audio_url: string;
  duration: number;
  created_at: string;
  expires_at: string;
  user_id: string;
  likes_count: number;
  voice_filter?: string;
  profiles?: {
    username?: string;
    avatar_url?: string;
  } | null;
  likes?: Array<{ user_id: string }>;
}

interface InstagramAudioPostProps {
  post: AudioPost;
}

const InstagramAudioPost = ({ post }: InstagramAudioPostProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLiked, setIsLiked] = useState(
    post.likes?.some((like) => like.user_id === user?.id) || false
  );
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [isSaved, setIsSaved] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Função para calcular tempo restante
  const calculateTimeLeft = () => {
    const now = new Date().getTime();
    const expiresAt = new Date(post.expires_at).getTime();
    const difference = expiresAt - now;

    if (difference > 0) {
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      if (hours > 0) {
        return `${hours}h ${minutes}m restantes`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s restantes`;
      } else {
        return `${seconds}s restantes`;
      }
    } else {
      return 'Expirado';
    }
  };

  // Atualizar contador a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    // Calcular inicial
    setTimeLeft(calculateTimeLeft());

    return () => clearInterval(timer);
  }, [post.expires_at]);

  const handleLike = async () => {
    if (!user) return;

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('audio_id', post.id);

        if (error) throw error;

        setIsLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({
            user_id: user.id,
            audio_id: post.id,
          });

        if (error) throw error;

        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível processar a curtida",
        variant: "destructive",
      });
    }
  };

  const handleComment = () => {
    // TODO: Implementar comentários com áudio
    toast({
      title: "Em breve",
      description: "Comentários com áudio serão implementados em breve!",
    });
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    toast({
      title: isSaved ? "Removido dos salvos" : "Salvo",
      description: isSaved ? "Áudio removido dos salvos" : "Áudio salvo com sucesso",
    });
  };

  const getVoiceFilterName = (filter?: string) => {
    switch (filter) {
      case 'robot': return 'Robô';
      case 'echo': return 'Eco';
      case 'deep': return 'Grave';
      case 'high': return 'Agudo';
      default: return 'Normal';
    }
  };

  return (
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
        />

        {/* Descrição */}
        <div>
          <SimplePostDescription description={post.description} />
        </div>

        {/* Filtro e Contador - logo após a descrição */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Filtro: {getVoiceFilterName(post.voice_filter)}</span>
          <span className={timeLeft === 'Expirado' ? 'text-red-500' : ''}>{timeLeft}</span>
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

        {/* Contagem de curtidas */}
        {likesCount > 0 && (
          <div className="text-sm font-semibold">
            {likesCount} {likesCount === 1 ? 'curtida' : 'curtidas'}
          </div>
        )}

        {/* Link para comentários */}
        <button 
          onClick={handleComment}
          className="text-sm text-muted-foreground hover:underline"
        >
          Adicionar comentário...
        </button>
      </CardContent>
    </Card>
  );
};

export default InstagramAudioPost;
