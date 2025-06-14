
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
  const durationRef = useRef(0);

  const { toast } = useToast();

  const startRecording = async () => {
    console.log('🎙️ [useAudioRecording] Iniciando gravação...');
    
    try {
      // Reset state
      durationRef.current = 0;
      setDuration(0);
      setAudioBlob(null);
      setIsRecording(true);
      chunksRef.current = [];
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      console.log('🔊 [useAudioRecording] Stream de áudio obtido');
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 [useAudioRecording] Dados de áudio disponíveis:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        console.log('⏹️ [useAudioRecording] Gravação finalizada, processando...');
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        console.log('📦 [useAudioRecording] Blob criado:', blob.size, 'bytes');
        
        try {
          const filteredBlob = await applyVoiceFilter(blob, voiceFilterRef.current);
          console.log('🎛️ [useAudioRecording] Filtro aplicado:', voiceFilterRef.current);
          setAudioBlob(filteredBlob);
        } catch (error) {
          console.error('❌ [useAudioRecording] Erro ao aplicar filtro:', error);
          setAudioBlob(blob);
        }
        
        // Cleanup stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('❌ [useAudioRecording] Erro no MediaRecorder:', event);
        toast({
          title: "Erro",
          description: "Erro durante a gravação",
          variant: "destructive"
        });
        setIsRecording(false);
      };
      
      // Start recording
      mediaRecorder.start();
      console.log('▶️ [useAudioRecording] Gravação iniciada, configurando timer...');
      
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Start timer
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        console.log('⏰ [useAudioRecording] Timer tick - duration:', durationRef.current);
        
        setDuration(durationRef.current);
        
        if (durationRef.current >= 60) {
          console.log('⏰ [useAudioRecording] Tempo limite de 60s atingido, parando gravação...');
          stopRecording('normal');
        }
      }, 1000);
      
    } catch (error) {
      console.error('❌ [useAudioRecording] Erro ao iniciar gravação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone. Verifique as permissões.",
        variant: "destructive"
      });
      setIsRecording(false);
    }
  };

  const stopRecording = useCallback((voiceFilter: VoiceFilter = 'normal') => {
    console.log('🛑 [useAudioRecording] Parando gravação com filtro:', voiceFilter);
    
    voiceFilterRef.current = voiceFilter;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('🛑 [useAudioRecording] MediaRecorder está gravando, parando...');
      mediaRecorderRef.current.stop();
    }
    
    setIsRecording(false);
    
    if (timerRef.current) {
      console.log('🛑 [useAudioRecording] Limpando timer...');
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    console.log('✅ [useAudioRecording] Gravação parada');
  }, []);

  const playAudio = () => {
    console.log('🎵 [useAudioRecording] Tentando reproduzir áudio...');
    
    if (audioBlob && !isPlaying) {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audioRef.current = audio;
      
      audio.onended = () => {
        console.log('🔚 [useAudioRecording] Áudio terminou');
        setIsPlaying(false);
        audioRef.current = null;
      };
      
      audio.play();
      setIsPlaying(true);
      console.log('▶️ [useAudioRecording] Áudio iniciado');
    } else if (audioRef.current && isPlaying) {
      console.log('⏸️ [useAudioRecording] Pausando áudio');
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
    }
  };

  const cleanup = useCallback(() => {
    console.log('🧹 [useAudioRecording] Fazendo cleanup...');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
    setAudioBlob(null);
    setIsPlaying(false);
    setDuration(0);
    durationRef.current = 0;
    voiceFilterRef.current = 'normal';
    chunksRef.current = [];
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
