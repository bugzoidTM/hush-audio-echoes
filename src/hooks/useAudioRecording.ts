
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
  const startTimeRef = useRef<number>(0);

  const { toast } = useToast();

  const startRecording = async () => {
    console.log('🎙️ Iniciando gravação...');
    
    try {
      // Reset previous state
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
      
      console.log('🔊 Stream de áudio obtido');
      streamRef.current = stream;
      
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
      
      mediaRecorder.onstop = async () => {
        console.log('⏹️ Gravação finalizada, processando...');
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        console.log('📦 Blob criado:', blob.size, 'bytes');
        
        try {
          // Apply voice filter before setting the audio blob
          const filteredBlob = await applyVoiceFilter(blob, voiceFilterRef.current);
          console.log('🎛️ Filtro aplicado:', voiceFilterRef.current);
          setAudioBlob(filteredBlob);
        } catch (error) {
          console.error('❌ Erro ao aplicar filtro:', error);
          setAudioBlob(blob); // Use original blob if filter fails
        }
        
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
      startTimeRef.current = Date.now();
      
      console.log('▶️ Gravação iniciada, configurando timer...');
      
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Start timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        console.log('⏰ Timer tick - elapsed:', elapsed);
        setDuration(elapsed);
        
        if (elapsed >= 60) {
          console.log('⏰ Tempo limite de 60s atingido');
          stopRecording('normal');
        }
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
    console.log('🛑 Parando gravação com filtro:', voiceFilter);
    
    // Store the voice filter
    voiceFilterRef.current = voiceFilter;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
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
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
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
    setIsRecording(false);
    setAudioBlob(null);
    setIsPlaying(false);
    setDuration(0);
    voiceFilterRef.current = 'normal';
    chunksRef.current = [];
    startTimeRef.current = 0;
  };

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
