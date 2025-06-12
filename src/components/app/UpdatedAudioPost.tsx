
import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Share2, Flag, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AudioPlayer from './AudioPlayer';
import ReportModal from './ReportModal';

interface UpdatedAudioPostProps {
  post: any;
}

const UpdatedAudioPost = ({ post }: UpdatedAudioPostProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLiked, setIsLiked] = useState(
    post.likes?.some((like: any) => like.user_id === user?.id) || false
  );
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [showReportModal, setShowReportModal] = useState(false);

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

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title || 'Áudio no Shhhh',
          text: post.description || 'Confira este áudio efêmero!',
          url: window.location.href,
        });
      } catch (error) {
        console.log('Erro ao compartilhar:', error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copiado!",
        description: "O link foi copiado para a área de transferência",
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={post.profiles?.avatar_url} />
                <AvatarFallback>
                  {post.is_anonymous ? '?' : post.profiles?.display_name?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">
                  {post.is_anonymous ? 'Anônimo' : post.profiles?.display_name || 'Usuário'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{timeUntilExpiration()}</p>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setShowReportModal(true)}>
                    <Flag className="w-4 h-4 mr-2" />
                    Denunciar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {post.title && (
            <h3 className="font-semibold">{post.title}</h3>
          )}
          
          {post.description && (
            <p className="text-muted-foreground">{post.description}</p>
          )}

          {/* Player de Áudio Real */}
          <AudioPlayer audioUrl={post.audio_url} duration={post.duration} />

          {post.transcription && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm italic">"{post.transcription}"</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                className={isLiked ? 'text-red-500' : ''}
              >
                <Heart className={`w-4 h-4 mr-1 ${isLiked ? 'fill-current' : ''}`} />
                {likesCount}
              </Button>
              
              <Button variant="ghost" size="sm">
                <MessageCircle className="w-4 h-4 mr-1" />
                {post.replies_count}
              </Button>
            </div>
            
            <Button variant="ghost" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <ReportModal 
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        audioId={post.id}
      />
    </>
  );
};

export default UpdatedAudioPost;
