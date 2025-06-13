
import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, Play, Pause, Volume2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SimpleAudioPostProps {
  post: any;
}

const SimpleAudioPost = ({ post }: SimpleAudioPostProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLiked, setIsLiked] = useState(
    post.likes?.some((like: any) => like.user_id === user?.id) || false
  );
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleLike = async () => {
    if (!user) return;

    try {
      if (isLiked) {
        // Remove like
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('audio_id', post.id);

        if (error) throw error;

        setIsLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        // Add like
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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const timeUntilExpiration = () => {
    const expiresAt = new Date(post.expires_at);
    const now = new Date();
    const diffInHours = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
    const diffInMinutes = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60)) % 60);
    
    if (diffInHours > 0) {
      return `${diffInHours}h ${diffInMinutes}m restantes`;
    } else if (diffInMinutes > 0) {
      return `${diffInMinutes}m restantes`;
    } else {
      return 'Expirando...';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={post.profiles?.avatar_url} />
              <AvatarFallback>
                {post.is_anonymous ? '?' : post.profiles?.username?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">
                {post.is_anonymous ? 'Anônimo' : `@${post.profiles?.username}` || 'Usuário'}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{timeUntilExpiration()}</p>
            <p className="text-xs text-muted-foreground">{formatDuration(post.duration)}</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {post.description && (
          <p className="text-muted-foreground">{post.description}</p>
        )}

        {/* Audio Player */}
        <div className="bg-muted rounded-lg p-4 flex items-center justify-center space-x-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <div className="flex-1 bg-background rounded-full h-2">
            <div className="bg-primary h-2 rounded-full w-1/3"></div>
          </div>
          <Volume2 className="w-4 h-4 text-muted-foreground" />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={isLiked ? 'text-red-500' : ''}
          >
            <Heart className={`w-4 h-4 mr-1 ${isLiked ? 'fill-current' : ''}`} />
            {likesCount}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleAudioPost;
