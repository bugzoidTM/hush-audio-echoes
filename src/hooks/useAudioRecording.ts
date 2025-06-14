import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { applyVoiceFilter, VoiceFilter } from '@/utils/voiceFilters';

export const useAudioRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const voiceFilterRef = useRef<VoiceFilter>('normal');

  const { toast } = useToast();

  const startTimer = () => {
    console.log('🕐 [useAudioRecording] Iniciando timer...');
    setDuration(0);
    
    timerRef.current = setInterval(() => {
      setDuration(prev => {
        const newDuration = prev + 1;
        console.log('⏰ [useAudioRecording] Timer tick:', newDuration);
        
        if (newDuration >= 60) {
          console.log('⏰ [useAudioRecording] 60s atingidos, parando...');
          stopRecording('normal');
        }
        
        return newDuration;
      });
    }, 1000);
  };

  const stopTimer = () => {
    console.log('⏹️ [useAudioRecording] Parando timer...');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    console.log('🎙️ [useAudioRecording] === INICIANDO GRAVAÇÃO ===');
    
    try {
      // Reset state
      setDuration(0);
      setAudioBlob(null);
      chunksRef.current = [];
      
      console.log('🎙️ [useAudioRecording] Solicitando permissão do microfone...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      console.log('🔊 [useAudioRecording] Stream obtido com sucesso');
      streamRef.current = stream;
      
      console.log('🔊 [useAudioRecording] Criando MediaRecorder...');
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 [useAudioRecording] Dados disponíveis - tamanho:', event.data.size);
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log('📊 [useAudioRecording] Total de chunks:', chunksRef.current.length);
        }
      };
      
      mediaRecorder.onstop = async () => {
        console.log('⏹️ [useAudioRecording] === MediaRecorder PARADO ===');
        console.log('⏹️ [useAudioRecording] Total de chunks coletados:', chunksRef.current.length);
        
        if (chunksRef.current.length === 0) {
          console.error('❌ [useAudioRecording] ERRO: Nenhum chunk de áudio foi coletado!');
          toast({
            title: "Erro",
            description: "Nenhum áudio foi gravado",
            variant: "destructive"
          });
          return;
        }
        
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        console.log('📦 [useAudioRecording] Blob criado - tamanho:', blob.size, 'bytes');
        
        if (blob.size === 0) {
          console.error('❌ [useAudioRecording] ERRO: Blob está vazio!');
          toast({
            title: "Erro",
            description: "Áudio gravado está vazio",
            variant: "destructive"
          });
          return;
        }
        
        try {
          console.log('🎛️ [useAudioRecording] Aplicando filtro de voz:', voiceFilterRef.current);
          const filteredBlob = await applyVoiceFilter(blob, voiceFilterRef.current);
          console.log('✅ [useAudioRecording] Filtro aplicado - tamanho final:', filteredBlob.size, 'bytes');
          setAudioBlob(filteredBlob);
        } catch (error) {
          console.error('❌ [useAudioRecording] Erro ao aplicar filtro:', error);
          console.log('🔄 [useAudioRecording] Usando áudio original sem filtro');
          setAudioBlob(blob);
        }
        
        // Cleanup stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            console.log('🛑 [useAudioRecording] Parando track:', track.kind);
            track.stop();
          });
          streamRef.current = null;
        }
        
        console.log('✅ [useAudioRecording] === GRAVAÇÃO FINALIZADA COM SUCESSO ===');
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('❌ [useAudioRecording] ERRO no MediaRecorder:', event);
        toast({
          title: "Erro",
          description: "Erro durante a gravação",
          variant: "destructive"
        });
        setIsRecording(false);
        stopTimer();
      };
      
      // Start recording and timer
      console.log('▶️ [useAudioRecording] Iniciando gravação...');
      setIsRecording(true);
      mediaRecorder.start(1000); // Collect data every second
      startTimer();
      
      console.log('✅ [useAudioRecording] Gravação iniciada com sucesso - Estado:', {
        isRecording: true,
        mediaRecorderState: mediaRecorder.state
      });
      
    } catch (error) {
      console.error('❌ [useAudioRecording] ERRO FATAL ao iniciar gravação:', error);
      
      let errorMessage = "Não foi possível acessar o microfone";
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = "Permissão do microfone negada. Permita o acesso ao microfone.";
        } else if (error.name === 'NotFoundError') {
          errorMessage = "Microfone não encontrado. Verifique se há um microfone conectado.";
        } else if (error.name === 'NotSupportedError') {
          errorMessage = "Gravação de áudio não suportada neste navegador.";
        }
      }
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
      setIsRecording(false);
    }
  };

  const stopRecording = useCallback((voiceFilter: VoiceFilter = 'normal') => {
    console.log('🛑 [useAudioRecording] === PARANDO GRAVAÇÃO ===');
    console.log('🛑 [useAudioRecording] Filtro solicitado:', voiceFilter);
    
    voiceFilterRef.current = voiceFilter;
    setIsRecording(false);
    stopTimer();
    
    if (mediaRecorderRef.current) {
      console.log('🛑 [useAudioRecording] Estado do MediaRecorder:', mediaRecorderRef.current.state);
      if (mediaRecorderRef.current.state === 'recording') {
        console.log('🛑 [useAudioRecording] Parando MediaRecorder...');
        mediaRecorderRef.current.stop();
      } else {
        console.log('⚠️ [useAudioRecording] MediaRecorder não está gravando:', mediaRecorderRef.current.state);
      }
    } else {
      console.log('⚠️ [useAudioRecording] MediaRecorder é null');
    }
    
    console.log('✅ [useAudioRecording] Comando de parada enviado');
  }, []);

  const playAudio = () => {
    console.log('🎵 [useAudioRecording] Play/pause áudio');
    
    if (audioBlob && !isPlaying) {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        audioRef.current = null;
      };
      
      audio.play();
      setIsPlaying(true);
    } else if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
    }
  };

  const cleanup = useCallback(() => {
    console.log('🧹 [useAudioRecording] === CLEANUP ===');
    
    setIsRecording(false);
    setAudioBlob(null);
    setIsPlaying(false);
    setDuration(0);
    
    stopTimer();
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('🧹 [useAudioRecording] Parando MediaRecorder no cleanup');
      mediaRecorderRef.current.stop();
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('🧹 [useAudioRecording] Parando track no cleanup:', track.kind);
        track.stop();
      });
      streamRef.current = null;
    }
    
    chunksRef.current = [];
    voiceFilterRef.current = 'normal';
    console.log('✅ [useAudioRecording] Cleanup concluído');
  }, []);

  return {
    isRecording,
    audioBlob,
    isPlaying,
    duration,
    startRecording,
    stopRecording,
    playAudio,
    cleanup
  };
};
