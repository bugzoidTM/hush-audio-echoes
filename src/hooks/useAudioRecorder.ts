import { useCallback, useEffect, useRef, useState } from 'react';
import { DISCOVERY_DURATION } from '@/features/echoes/services/discoveryPolicy';
import { useToast } from '@/hooks/use-toast';

/**
 * Gravador do Echo. O corte em 60 s já existia, mas era invisível: `duration`
 * só era calculada no `onstop`, então a pessoa gravava sem saber quanto tempo
 * tinha — e a gravação simplesmente morria sozinha. Agora o tempo decorrido é
 * publicado a cada 200 ms, o que permite mostrar a contagem regressiva.
 */
export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const maxDuration = DISCOVERY_DURATION.maximum;
  const minDuration = DISCOVERY_DURATION.minimum;

  const clearTimers = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (limitRef.current) { clearTimeout(limitRef.current); limitRef.current = null; }
  }, []);

  // Sem isto, sair da tela no meio da gravação deixava o microfone aberto.
  useEffect(() => () => {
    clearTimers();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [clearTimers]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });

      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        clearTimers();
        const blob = new Blob(chunks, { type: 'audio/webm' });
        // O corte é do relógio: mesmo que o MediaRecorder entregue alguns
        // milissegundos a mais, a duração declarada nunca passa do limite.
        const recorded = Math.min(Math.floor((Date.now() - startTimeRef.current) / 1000), maxDuration);
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        setDuration(recorded);
        setElapsed(recorded);
        setIsRecording(false);
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      startTimeRef.current = Date.now();
      setElapsed(0);
      mediaRecorder.start();
      setIsRecording(true);

      tickRef.current = setInterval(() => {
        setElapsed(Math.min((Date.now() - startTimeRef.current) / 1000, maxDuration));
      }, 200);

      limitRef.current = setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          toast({ title: `Limite de ${maxDuration} segundos atingido.`, description: 'A gravação foi encerrada automaticamente. Você pode gravar de novo.' });
        }
      }, maxDuration * 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({ title: 'Erro', description: 'Não foi possível acessar o microfone', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    clearTimers();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      return;
    }
    setIsRecording(false);
  };

  const resetRecording = () => {
    clearTimers();
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);
    setElapsed(0);
  };

  return {
    isRecording,
    recordedBlob,
    recordedUrl,
    duration,
    /** Segundos decorridos, atualizados durante a gravação. */
    elapsed,
    /** Quanto ainda resta antes do corte automático. */
    remaining: Math.max(0, maxDuration - elapsed),
    maxDuration,
    minDuration,
    startRecording,
    stopRecording,
    resetRecording,
  };
};
