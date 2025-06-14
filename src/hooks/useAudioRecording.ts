
import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { applyVoiceFilter, VoiceFilter } from '@/utils/voiceFilters';

export const useAudioRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const { toast } = useToast();

  const startRecording = async () => {
    console.log('🎙️ Iniciando gravação...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      console.log('🔊 Stream de áudio obtido');
      streamRef.current = stream;
      chunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 Dados de áudio disponíveis:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async (voiceFilter: VoiceFilter) => {
        console.log('⏹️ Gravação finalizada, processando...');
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        console.log('📦 Blob criado:', blob.size, 'bytes');
        
        // Apply voice filter before setting the audio blob
        const filteredBlob = await applyVoiceFilter(blob, voiceFilter);
        console.log('🎛️ Filtro aplicado:', voiceFilter);
        setAudioBlob(filteredBlob);
        
        // Cleanup stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('❌ Erro no MediaRecorder:', event);
        toast({
          title: "Erro",
          description: "Erro durante a gravação",
          variant: "destructive"
        });
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingStartTime(Date.now());
      setDuration(0);
      
      console.log('▶️ Gravação iniciada, configurando timer...');
      
      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= 60) {
            console.log('⏰ Tempo limite de 60s atingido');
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);
      
    } catch (error) {
      console.error('❌ Erro ao iniciar gravação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone. Verifique as permissões.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = useCallback((voiceFilter: VoiceFilter = 'normal') => {
    console.log('🛑 Parando gravação...');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      // We need to pass the voice filter to the onstop handler
      const originalOnStop = mediaRecorderRef.current.onstop;
      mediaRecorderRef.current.onstop = () => {
        if (originalOnStop) {
          (originalOnStop as any)(voiceFilter);
        }
      };
      mediaRecorderRef.current.stop();
    }
    
    setIsRecording(false);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    console.log('✅ Gravação parada');
  }, []);

  const playAudio = () => {
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

  const cleanup = () => {
    console.log('🧹 Fazendo cleanup...');
    
    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }
    
    // Stop audio playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Reset state
    setAudioBlob(null);
    setIsPlaying(false);
    setDuration(0);
    setRecordingStartTime(0);
    chunksRef.current = [];
  };

  return {
    isRecording,
    audioBlob,
    isPlaying,
    duration,
    recordingStartTime,
    startRecording,
    stopRecording,
    playAudio,
    cleanup
  };
};
