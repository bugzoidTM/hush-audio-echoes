import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatTime, getFilterDisplayName, convertToWav } from '@/utils/audioUtils';

interface SimpleAudioPlayerProps {
  audioUrl: string;
  duration: number;
  voiceFilter?: string;
  expiresAt?: string; // Add expires_at prop
}

const SimpleAudioPlayer = ({ audioUrl, duration, voiceFilter, expiresAt }: SimpleAudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  
  const { toast } = useToast();

  // Calculate time left function
  const calculateTimeLeft = () => {
    if (!expiresAt) return '';
    
    const now = new Date().getTime();
    const expiresAtTime = new Date(expiresAt).getTime();
    const difference = expiresAtTime - now;

    if (difference > 0) {
      const hours = Math.floor(difference % (1000 * 60 * 60 * 24) / (1000 * 60 * 60));
      const minutes = Math.floor(difference % (1000 * 60 * 60) / (1000 * 60));
      const seconds = Math.floor(difference % (1000 * 60) / 1000);

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

  // Update countdown every second
  useEffect(() => {
    if (!expiresAt) return;

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    // Calculate initial time
    setTimeLeft(calculateTimeLeft());

    return () => clearInterval(timer);
  }, [expiresAt]);

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

  const togglePlayback = async () => {
    console.log('🎵 Tentando reproduzir áudio:', audioUrl);

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
        if (!audioUrl || audioUrl.trim() === '') {
          throw new Error('URL do áudio não encontrada');
        }

        console.log('🔗 URL do áudio a ser buscada:', audioUrl);

        // Fetch the audio data
        console.log('📥 Buscando dados do áudio...');
        const response = await fetch(audioUrl, {
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

        const blobUrl = URL.createObjectURL(wavBlob);
        console.log('📦 URL de objeto blob criada:', blobUrl);

        const newAudio = new Audio();
        
        // Set properties for better compatibility
        newAudio.preload = 'auto';
        newAudio.crossOrigin = 'anonymous';
        
        // Enhanced error handling
        const handleError = (error: Event) => {
          console.error('❌ Erro no elemento de áudio:', error);
          URL.revokeObjectURL(blobUrl);
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
          URL.revokeObjectURL(blobUrl);
          setAudio(null);
        };

        newAudio.addEventListener('error', handleError);
        newAudio.addEventListener('ended', handleEnded);

        newAudio.addEventListener('canplay', () => {
          console.log('▶️ Áudio pode ser reproduzido');
          setIsLoading(false);
        });

        // Set the source to the blob URL
        newAudio.src = blobUrl;
        
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
              URL.revokeObjectURL(blobUrl);
              
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

  return (
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
              <span>{formatTime(duration)}</span>
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
          <span className="font-medium">{getFilterDisplayName(voiceFilter)}</span>
        </div>
        
        {/* Contador regressivo */}
        {expiresAt && timeLeft && (
          <div className="flex items-center justify-center text-xs text-muted-foreground mt-1">
            <span>{timeLeft}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleAudioPlayer;
