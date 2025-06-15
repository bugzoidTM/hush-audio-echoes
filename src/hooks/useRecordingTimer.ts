
import { useState, useRef, useCallback } from 'react';

const MAX_RECORDING_TIME = 20; // 20 segundos

export const useRecordingTimer = () => {
  const [duration, setDuration] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback((onMaxTime?: () => void) => {
    console.log('⏱️ [useRecordingTimer] Iniciando timer');
    
    intervalRef.current = setInterval(() => {
      setDuration(prev => {
        const newDuration = prev + 1;
        
        // Parar automaticamente aos 20 segundos
        if (newDuration >= MAX_RECORDING_TIME) {
          console.log('⏱️ [useRecordingTimer] Tempo máximo atingido (20s)');
          if (onMaxTime) onMaxTime();
          return MAX_RECORDING_TIME;
        }
        
        return newDuration;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    console.log('⏱️ [useRecordingTimer] Parando timer');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    console.log('⏱️ [useRecordingTimer] Resetando timer');
    setDuration(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return {
    duration,
    maxDuration: MAX_RECORDING_TIME,
    startTimer,
    stopTimer,
    resetTimer
  };
};
