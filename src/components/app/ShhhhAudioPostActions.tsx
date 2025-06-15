
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShhhhAudioPostActionsProps {
  isLiked: boolean;
  onLike: () => void;
  disabled?: boolean;
}

const ShhhhAudioPostActions = ({ isLiked, onLike, disabled = false }: ShhhhAudioPostActionsProps) => {
  const { toast } = useToast();

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Áudio Shhhh',
          text: 'Confira este áudio no Shhhh!',
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link copiado",
          description: "O link foi copiado para a área de transferência",
        });
      }
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
    }
  };

  const handleReply = () => {
    if (disabled) {
      toast({
        title: "Login necessário",
        description: "Faça login para responder a posts",
        variant: "destructive",
      });
      return;
    }
    // TODO: Implement reply functionality
    toast({
      title: "Em breve",
      description: "Funcionalidade de resposta em desenvolvimento",
    });
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          className="p-0 h-auto"
          onClick={onLike}
          disabled={disabled}
          title={disabled ? "Faça login para curtir" : isLiked ? "Descurtir" : "Curtir"}
        >
          <Heart 
            className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : ''} ${disabled ? 'opacity-50' : ''}`} 
          />
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="p-0 h-auto"
          onClick={handleReply}
          title={disabled ? "Faça login para responder" : "Responder"}
        >
          <MessageCircle className={`w-6 h-6 ${disabled ? 'opacity-50' : ''}`} />
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="p-0 h-auto"
          onClick={handleShare}
          title="Compartilhar"
        >
          <Share className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
};

export default ShhhhAudioPostActions;
