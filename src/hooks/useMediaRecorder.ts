
import { useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useMediaRecorder = () => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const requestMicrophoneAccess = useCallback(async (): Promise<MediaStream> => {
    console.log('🎙️ [useMediaRecorder] Solicitando permissão do microfone...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      console.log('🔊 [useMediaRecorder] Stream obtido com sucesso');
      streamRef.current = stream;
      return stream;
    } catch (error) {
      console.error('❌ [useMediaRecorder] ERRO ao acessar microfone:', error);
      
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
      
      throw error;
    }
  }, [toast]);

  const createMediaRecorder = useCallback((stream: MediaStream, onStop: (blob: Blob) => void): MediaRecorder => {
    console.log('🔊 [useMediaRecorder] Criando MediaRecorder...');
    
    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    mediaRecorderRef.current = mediaRecorder;
    
    mediaRecorder.ondataavailable = (event) => {
      console.log('📊 [useMediaRecorder] Dados disponíveis - tamanho:', event.data.size);
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
        console.log('📊 [useMediaRecorder] Total de chunks:', chunksRef.current.length);
      }
    };
    
    mediaRecorder.onstop = async () => {
      console.log('⏹️ [useMediaRecorder] === MediaRecorder PARADO ===');
      console.log('⏹️ [useMediaRecorder] Total de chunks coletados:', chunksRef.current.length);
      
      if (chunksRef.current.length === 0) {
        console.error('❌ [useMediaRecorder] ERRO: Nenhum chunk de áudio foi coletado!');
        toast({
          title: "Erro",
          description: "Nenhum áudio foi gravado",
          variant: "destructive"
        });
        return;
      }
      
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      console.log('📦 [useMediaRecorder] Blob criado - tamanho:', blob.size, 'bytes');
      
      if (blob.size === 0) {
        console.error('❌ [useMediaRecorder] ERRO: Blob está vazio!');
        toast({
          title: "Erro",
          description: "Áudio gravado está vazio",
          variant: "destructive"
        });
        return;
      }
      
      onStop(blob);
    };
    
    mediaRecorder.onerror = (event) => {
      console.error('❌ [useMediaRecorder] ERRO no MediaRecorder:', event);
      toast({
        title: "Erro",
        description: "Erro durante a gravação",
        variant: "destructive"
      });
    };
    
    return mediaRecorder;
  }, [toast]);

  const startRecording = useCallback((mediaRecorder: MediaRecorder) => {
    console.log('▶️ [useMediaRecorder] Iniciando gravação...');
    mediaRecorder.start(1000); // Collect data every second
    console.log('✅ [useMediaRecorder] Gravação iniciada - Estado:', mediaRecorder.state);
  }, []);

  const stopRecording = useCallback(() => {
    console.log('🛑 [useMediaRecorder] === PARANDO GRAVAÇÃO ===');
    
    if (mediaRecorderRef.current) {
      console.log('🛑 [useMediaRecorder] Estado do MediaRecorder:', mediaRecorderRef.current.state);
      if (mediaRecorderRef.current.state === 'recording') {
        console.log('🛑 [useMediaRecorder] Parando MediaRecorder...');
        mediaRecorderRef.current.stop();
      } else {
        console.log('⚠️ [useMediaRecorder] MediaRecorder não está gravando:', mediaRecorderRef.current.state);
      }
    } else {
      console.log('⚠️ [useMediaRecorder] MediaRecorder é null');
    }
  }, []);

  const cleanup = useCallback(() => {
    console.log('🧹 [useMediaRecorder] === CLEANUP ===');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('🧹 [useMediaRecorder] Parando MediaRecorder no cleanup');
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('🧹 [useMediaRecorder] Parando track no cleanup:', track.kind);
        track.stop();
      });
      streamRef.current = null;
    }
    
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    console.log('✅ [useMediaRecorder] Cleanup concluído');
  }, []);

  return {
    requestMicrophoneAccess,
    createMediaRecorder,
    startRecording,
    stopRecording,
    cleanup
  };
};
