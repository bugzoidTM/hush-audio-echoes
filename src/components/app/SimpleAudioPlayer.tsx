
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatTime, getFilterDisplayName, convertToWav } from '@/utils/audioUtils';

interface SimpleAudioPlayerProps {
  audioUrl: string;
  duration: number;
  voiceFilter?: string;
  expiresAt?: string;
}

const SimpleAudioPlayer = ({ audioUrl, duration, voiceFilter, expiresAt }: SimpleAudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [source, setSource] = useState<MediaElementAudioSourceNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  const { toast } = useToast();

  // Calculate countdown timer
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

  useEffect(() => {
    if (!expiresAt) return;

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    setTimeLeft(calculateTimeLeft());

    return () => clearInterval(timer);
  }, [expiresAt]);

  // Apply voice filter using Web Audio API
  const applyVoiceFilter = (audioCtx: AudioContext, sourceNode: MediaElementAudioSourceNode, filterType?: string) => {
    let currentNode: AudioNode = sourceNode;

    switch (filterType) {
      case 'robot':
        // Robot effect using bit crusher simulation
        const robotGain = audioCtx.createGain();
        robotGain.gain.value = 0.3;
        const robotFilter = audioCtx.createBiquadFilter();
        robotFilter.type = 'lowpass';
        robotFilter.frequency.value = 2000;
        currentNode.connect(robotGain);
        robotGain.connect(robotFilter);
        currentNode = robotFilter;
        break;

      case 'helium':
        // Helium effect using pitch shift simulation
        const heliumGain = audioCtx.createGain();
        heliumGain.gain.value = 0.8;
        const heliumFilter = audioCtx.createBiquadFilter();
        heliumFilter.type = 'highpass';
        heliumFilter.frequency.value = 800;
        heliumFilter.Q.value = 5;
        currentNode.connect(heliumGain);
        heliumGain.connect(heliumFilter);
        currentNode = heliumFilter;
        break;

      case 'deep':
        // Deep voice effect
        const deepGain = audioCtx.createGain();
        deepGain.gain.value = 1.2;
        const deepFilter = audioCtx.createBiquadFilter();
        deepFilter.type = 'lowpass';
        deepFilter.frequency.value = 500;
        deepFilter.Q.value = 3;
        currentNode.connect(deepGain);
        deepGain.connect(deepFilter);
        currentNode = deepFilter;
        break;

      case 'echo':
        // Echo effect using delay
        const echoDelay = audioCtx.createDelay(0.5);
        echoDelay.delayTime.value = 0.3;
        const echoGain = audioCtx.createGain();
        echoGain.gain.value = 0.4;
        const echoFeedback = audioCtx.createGain();
        echoFeedback.gain.value = 0.3;
        
        currentNode.connect(echoDelay);
        echoDelay.connect(echoGain);
        echoGain.connect(echoFeedback);
        echoFeedback.connect(echoDelay);
        
        // Mix dry and wet signals
        const echoMixer = audioCtx.createGain();
        currentNode.connect(echoMixer);
        echoGain.connect(echoMixer);
        currentNode = echoMixer;
        break;

      case 'whisper':
        // Whisper effect using low gain and high-frequency filtering
        const whisperGain = audioCtx.createGain();
        whisperGain.gain.value = 0.3;
        const whisperFilter = audioCtx.createBiquadFilter();
        whisperFilter.type = 'highpass';
        whisperFilter.frequency.value = 1000;
        currentNode.connect(whisperGain);
        whisperGain.connect(whisperFilter);
        currentNode = whisperFilter;
        break;

      case 'alien':
        // Alien effect using ring modulation simulation
        const alienOscillator = audioCtx.createOscillator();
        alienOscillator.frequency.value = 30;
        alienOscillator.type = 'sine';
        const alienGain = audioCtx.createGain();
        alienGain.gain.value = 0.7;
        const alienModulator = audioCtx.createGain();
        
        alienOscillator.connect(alienModulator.gain);
        currentNode.connect(alienModulator);
        alienModulator.connect(alienGain);
        alienOscillator.start();
        currentNode = alienGain;
        break;

      case 'chipmunk':
        // Chipmunk effect using high-frequency emphasis
        const chipmunkGain = audioCtx.createGain();
        chipmunkGain.gain.value = 0.9;
        const chipmunkFilter = audioCtx.createBiquadFilter();
        chipmunkFilter.type = 'highshelf';
        chipmunkFilter.frequency.value = 2000;
        chipmunkFilter.gain.value = 10;
        currentNode.connect(chipmunkGain);
        chipmunkGain.connect(chipmunkFilter);
        currentNode = chipmunkFilter;
        break;

      default:
        // Normal - no filter
        break;
    }

    // Connect to destination
    currentNode.connect(audioCtx.destination);
  };

  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      if (audio) {
        audio.pause();
        if (audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [audio, audioContext]);

  const togglePlayback = async () => {
    console.log('🎵 Tentando reproduzir áudio:', audioUrl);

    // Cleanup previous audio and context
    if (audio) {
      audio.pause();
      if (audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }
      setAudio(null);
    }
    if (audioContext) {
      audioContext.close();
      setAudioContext(null);
      setSource(null);
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

        // Create audio context for filters
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Resume audio context if suspended (required by some browsers)
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const newAudio = new Audio();
        newAudio.preload = 'auto';
        newAudio.crossOrigin = 'anonymous';
        
        // Enhanced error handling
        const handleError = (error: Event) => {
          console.error('❌ Erro no elemento de áudio:', error);
          URL.revokeObjectURL(blobUrl);
          setIsPlaying(false);
          setAudio(null);
          setIsLoading(false);
          audioCtx.close();
          
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
          audioCtx.close();
          setAudioContext(null);
          setSource(null);
        };

        newAudio.addEventListener('error', handleError);
        newAudio.addEventListener('ended', handleEnded);

        newAudio.addEventListener('canplay', () => {
          console.log('▶️ Áudio pode ser reproduzido');
          setIsLoading(false);
        });

        // Set the source to the blob URL
        newAudio.src = blobUrl;
        
        // Create audio source node and apply filters
        const audioSource = audioCtx.createMediaElementSource(newAudio);
        
        console.log('🎯 Aplicando filtro de voz:', voiceFilter);
        applyVoiceFilter(audioCtx, audioSource, voiceFilter);
        
        console.log('🎯 Tentando reproduzir áudio com filtros...');
        
        const playPromise = newAudio.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('🎶 Reprodução iniciada com sucesso com filtros');
              setAudio(newAudio);
              setAudioContext(audioCtx);
              setSource(audioSource);
              setIsPlaying(true);
              setIsLoading(false);
            })
            .catch((error) => {
              console.error('❌ Erro ao iniciar reprodução:', error);
              URL.revokeObjectURL(blobUrl);
              audioCtx.close();
              
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

      {/* Filtro aplicado e contador logo abaixo */}
      <div className="mt-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Filtro aplicado:</span>
          <span className="font-medium">{getFilterDisplayName(voiceFilter)}</span>
        </div>
        {expiresAt && timeLeft && (
          <div
            className="flex items-center justify-center text-xs text-muted-foreground mt-1"
            data-testid="countdown-timer"
          >
            <span>{timeLeft}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleAudioPlayer;
