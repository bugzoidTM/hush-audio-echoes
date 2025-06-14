
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
    console.log('🎙️ [useAudioRecording] Iniciando gravação...');
    
    try {
      // Reset state
      setDuration(0);
      setAudioBlob(null);
      chunksRef.current = [];
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      console.log('🔊 [useAudioRecording] Stream obtido');
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 [useAudioRecording] Dados disponíveis:', event.data.size);
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        console.log('⏹️ [useAudioRecording] MediaRecorder parado');
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        try {
          const filteredBlob = await applyVoiceFilter(blob, voiceFilterRef.current);
          setAudioBlob(filteredBlob);
        } catch (error) {
          console.error('❌ [useAudioRecording] Erro no filtro:', error);
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
        stopTimer();
      };
      
      // Start recording and timer
      setIsRecording(true);
      mediaRecorder.start();
      startTimer();
      
      console.log('✅ [useAudioRecording] Gravação iniciada');
      
    } catch (error) {
      console.error('❌ [useAudioRecording] Erro ao iniciar:', error);
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone. Verifique as permissões.",
        variant: "destructive"
      });
      setIsRecording(false);
    }
  };

  const stopRecording = useCallback((voiceFilter: VoiceFilter = 'normal') => {
    console.log('🛑 [useAudioRecording] Parando gravação...');
    
    voiceFilterRef.current = voiceFilter;
    setIsRecording(false);
    stopTimer();
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    console.log('✅ [useAudioRecording] Gravação parada');
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
    console.log('🧹 [useAudioRecording] Cleanup...');
    
    setIsRecording(false);
    setAudioBlob(null);
    setIsPlaying(false);
    setDuration(0);
    
    stopTimer();
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    chunksRef.current = [];
    voiceFilterRef.current = 'normal';
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
