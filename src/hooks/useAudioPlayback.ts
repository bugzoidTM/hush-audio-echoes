
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { convertToWav } from '@/utils/audioUtils';
import { applyVoiceFilterToContext } from '@/utils/voiceFilterUtils';

interface UseAudioPlaybackProps {
  audioUrl: string;
  voiceFilter?: string;
}

export const useAudioPlayback = ({ audioUrl, voiceFilter }: UseAudioPlaybackProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [source, setSource] = useState<MediaElementAudioSourceNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Helper function to safely close AudioContext
  const safeCloseAudioContext = (ctx: AudioContext) => {
    if (ctx && ctx.state !== 'closed') {
      try {
        ctx.close();
      } catch (error) {
        console.warn('Erro ao fechar AudioContext:', error);
      }
    }
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
        safeCloseAudioContext(audioContext);
      }
    };
  }, [audio, audioContext]);

  const togglePlayback = async () => {
    console.log('🎵 Tentando reproduzir áudio:', audioUrl);

    // If already playing, just pause
    if (isPlaying && audio) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    // Cleanup previous audio and context
    if (audio) {
      audio.pause();
      if (audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }
      setAudio(null);
    }
    if (audioContext) {
      safeCloseAudioContext(audioContext);
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
          safeCloseAudioContext(audioCtx);
          
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
          safeCloseAudioContext(audioCtx);
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
        applyVoiceFilterToContext(audioCtx, audioSource, voiceFilter);
        
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
              safeCloseAudioContext(audioCtx);
              
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
    }
  };

  return {
    isPlaying,
    isLoading,
    togglePlayback
  };
};
