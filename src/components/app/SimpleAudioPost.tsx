
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
  voice_filter?: string;
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
  const [isLoading, setIsLoading] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user && post.likes) {
      setIsLiked(post.likes.some(like => like.user_id === user.id));
    }
  }, [user, post.likes]);

  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      if (audio) {
        audio.pause();
        if (audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
        audio.removeEventListener('error', () => {});
        audio.removeEventListener('ended', () => {});
        setAudio(null);
        setIsPlaying(false);
      }
    };
  }, [audio]);

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

  const getFilterDisplayName = (filter?: string) => {
    const filters: Record<string, string> = {
      'normal': 'Normal',
      'robot': 'Robô',
      'helium': 'Hélio', 
      'deep': 'Grave',
      'echo': 'Eco',
      'whisper': 'Sussurro',
      'alien': 'Alien',
      'chipmunk': 'Esquilo'
    };
    return filters[filter || 'normal'] || 'Normal';
  };

  const togglePlayback = async () => {
    console.log('🎵 Tentando reproduzir áudio:', post.audio_url);

    // Cleanup previous audio and object URLs
    if (audio) {
      audio.pause();
      if (audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }
      audio.removeEventListener('error', () => {});
      audio.removeEventListener('ended', () => {});
      setAudio(null);
    }
    
    if (!isPlaying) {
      setIsLoading(true);
      
      try {
        if (!post.audio_url || post.audio_url.trim() === '') {
          throw new Error('URL do áudio não encontrada');
        }

        console.log('🔗 URL do áudio a ser buscada:', post.audio_url);

        // Fetch the audio data
        console.log('📥 Buscando dados do áudio...');
        const response = await fetch(post.audio_url, {
          method: 'GET',
          headers: {
            'Accept': 'audio/*,*/*;q=0.9',
          },
          mode: 'cors',
          credentials: 'omit'
        });

        if (!response.ok) {
          console.error('❌ Falha ao buscar áudio:', response.status, response.statusText);
          throw new Error(`Não foi possível carregar o arquivo de áudio (${response.status})`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        console.log(`✅ Áudio buscado com sucesso. Tamanho: ${arrayBuffer.byteLength} bytes`);

        // Convert to WAV format for better compatibility
        const wavBlob = await convertToWav(arrayBuffer);
        console.log(`🔄 Convertido para WAV. Tamanho: ${wavBlob.size} bytes`);

        const audioUrl = URL.createObjectURL(wavBlob);
        console.log('📦 URL de objeto blob criada:', audioUrl);

        const newAudio = new Audio();
        
        // Set properties for better compatibility
        newAudio.preload = 'auto';
        newAudio.crossOrigin = 'anonymous';
        
        // Enhanced error handling
        const handleError = (error: Event) => {
          console.error('❌ Erro no elemento de áudio:', error);
          URL.revokeObjectURL(audioUrl);
          setIsPlaying(false);
          setAudio(null);
          setIsLoading(false);
          
          toast({
            title: "Aviso",
            description: "Reprodução finalizada",
            variant: "default"
          });
        };

        const handleEnded = () => {
          console.log('🔚 Áudio terminou');
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
          setAudio(null);
        };

        newAudio.addEventListener('error', handleError);
        newAudio.addEventListener('ended', handleEnded);

        newAudio.addEventListener('canplay', () => {
          console.log('▶️ Áudio pode ser reproduzido');
          setIsLoading(false);
        });

        // Set the source to the blob URL
        newAudio.src = audioUrl;
        
        console.log('🎯 Tentando reproduzir áudio a partir do blob...');
        
        // For mobile compatibility, try to play immediately
        const playPromise = newAudio.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('🎶 Reprodução iniciada com sucesso');
              setAudio(newAudio);
              setIsPlaying(true);
              setIsLoading(false);
            })
            .catch((error) => {
              console.error('❌ Erro ao iniciar reprodução:', error);
              URL.revokeObjectURL(audioUrl);
              
              let userMessage = "Não foi possível reproduzir o áudio.";
              if (error.name === 'NotAllowedError') {
                userMessage = "Interação do usuário necessária. Toque novamente para reproduzir.";
              }
              
              toast({
                title: "Erro",
                description: userMessage,
                variant: "destructive"
              });
              setIsLoading(false);
            });
        }
        
      } catch (error) {
        console.error('💥 Erro geral:', error);
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : "Erro desconhecido ao reproduzir áudio",
          variant: "destructive"
        });
        setIsLoading(false);
      }
    } else {
      if (audio) {
        audio.pause();
        setIsPlaying(false);
      }
    }
  };

  // Convert audio to WAV format for better browser compatibility
  const convertToWav = async (arrayBuffer: ArrayBuffer): Promise<Blob> => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      
      // Create WAV file
      const length = audioBuffer.length * audioBuffer.numberOfChannels * 2 + 44;
      const buffer = new ArrayBuffer(length);
      const view = new DataView(buffer);
      
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      
      // WAV header
      writeString(0, 'RIFF');
      view.setUint32(4, length - 8, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, audioBuffer.numberOfChannels, true);
      view.setUint32(24, audioBuffer.sampleRate, true);
      view.setUint32(28, audioBuffer.sampleRate * audioBuffer.numberOfChannels * 2, true);
      view.setUint16(32, audioBuffer.numberOfChannels * 2, true);
      view.setUint16(34, 16, true);
      writeString(36, 'data');
      view.setUint32(40, length - 44, true);
      
      // PCM data
      let offset = 44;
      for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
          offset += 2;
        }
      }
      
      return new Blob([buffer], { type: 'audio/wav' });
    } catch (error) {
      console.error('Erro na conversão WAV:', error);
      // Return original as fallback
      return new Blob([arrayBuffer], { type: 'audio/webm' });
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
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </Button>
              
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{isLoading ? 'Carregando...' : 'Áudio'}</span>
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
            
            {/* Filtro aplicado */}
            <div className="mt-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Filtro aplicado:</span>
                <span className="font-medium">{getFilterDisplayName(post.voice_filter)}</span>
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
