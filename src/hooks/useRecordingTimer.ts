
import { useState, useRef, useCallback } from 'react';

export const useRecordingTimer = () => {
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback((onMaxDuration?: () => void) => {
    console.log('🕐 [useRecordingTimer] Iniciando timer...');
    setDuration(0);
    
    timerRef.current = setInterval(() => {
      setDuration(prev => {
        const newDuration = prev + 1;
        console.log('⏰ [useRecordingTimer] Timer tick:', newDuration);
        
        if (newDuration >= 60) {
          console.log('⏰ [useRecordingTimer] 60s atingidos, parando...');
          onMaxDuration?.();
        }
        
        return newDuration;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    console.log('⏹️ [useRecordingTimer] Parando timer...');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    stopTimer();
    setDuration(0);
  }, [stopTimer]);

  return {
    duration,
    startTimer,
    stopTimer,
    resetTimer
  };
};
