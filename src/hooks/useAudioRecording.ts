
import { useState, useRef, useCallback } from 'react';
import { VoiceFilter } from '@/utils/voiceFilters';
import { useRecordingTimer } from './useRecordingTimer';
import { useMediaRecorder } from './useMediaRecorder';
import { processAndApplyVoiceFilter } from '@/utils/audioProcessingUtils';

export const useAudioRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceFilterRef = useRef<VoiceFilter>('normal');

  const { duration, startTimer, stopTimer, resetTimer } = useRecordingTimer();
  const { 
    requestMicrophoneAccess, 
    createMediaRecorder, 
    startRecording: startMediaRecording, 
    stopRecording: stopMediaRecording, 
    cleanup: cleanupMediaRecorder 
  } = useMediaRecorder();

  const handleRecordingStop = useCallback(async (blob: Blob) => {
    console.log('⏹️ [useAudioRecording] === MediaRecorder PARADO ===');
    console.log('🎛️ [useAudioRecording] Aplicando filtro:', voiceFilterRef.current);
    
    try {
      const filteredBlob = await processAndApplyVoiceFilter(blob, voiceFilterRef.current);
      setAudioBlob(filteredBlob);
      console.log('✅ [useAudioRecording] === GRAVAÇÃO FINALIZADA COM FILTRO APLICADO ===');
    } catch (error) {
      console.error('❌ [useAudioRecording] Erro no processamento:', error);
      setAudioBlob(blob);
    }
  }, []);

  const startRecording = useCallback(async () => {
    console.log('🎙️ [useAudioRecording] === INICIANDO GRAVAÇÃO ===');
    
    try {
      // Reset state
      resetTimer();
      setAudioBlob(null);
      
      const stream = await requestMicrophoneAccess();
      const mediaRecorder = createMediaRecorder(stream, handleRecordingStop);
      
      // Start recording and timer
      setIsRecording(true);
      startMediaRecording(mediaRecorder);
      startTimer(() => stopRecording('normal'));
      
      console.log('✅ [useAudioRecording] Gravação iniciada com sucesso');
      
    } catch (error) {
      console.error('❌ [useAudioRecording] ERRO FATAL ao iniciar gravação:', error);
      setIsRecording(false);
    }
  }, [requestMicrophoneAccess, createMediaRecorder, handleRecordingStop, startMediaRecording, startTimer, resetTimer]);

  const stopRecording = useCallback((voiceFilter: VoiceFilter = 'normal') => {
    console.log('🛑 [useAudioRecording] === PARANDO GRAVAÇÃO ===');
    console.log('🛑 [useAudioRecording] Filtro a ser aplicado:', voiceFilter);
    
    voiceFilterRef.current = voiceFilter;
    setIsRecording(false);
    stopTimer();
    stopMediaRecording();
    
    console.log('✅ [useAudioRecording] Comando de parada enviado com filtro:', voiceFilter);
  }, [stopTimer, stopMediaRecording]);

  const playAudio = useCallback(() => {
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
  }, [audioBlob, isPlaying]);

  const cleanup = useCallback(() => {
    console.log('🧹 [useAudioRecording] === CLEANUP ===');
    
    setIsRecording(false);
    setAudioBlob(null);
    setIsPlaying(false);
    resetTimer();
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    cleanupMediaRecorder();
    voiceFilterRef.current = 'normal';
    console.log('✅ [useAudioRecording] Cleanup concluído');
  }, [resetTimer, cleanupMediaRecorder]);

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
