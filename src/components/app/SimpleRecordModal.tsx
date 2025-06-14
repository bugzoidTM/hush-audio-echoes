
import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, Square, Play, Pause, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SimpleRecordModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type VoiceFilter = 'normal' | 'robot' | 'helium' | 'deep' | 'echo' | 'whisper' | 'alien' | 'chipmunk';

const SimpleRecordModal = ({ open, onClose, onSuccess }: SimpleRecordModalProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [description, setDescription] = useState('');
  const [voiceFilter, setVoiceFilter] = useState<VoiceFilter>('normal');
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();

  const voiceFilters = [
    { value: 'normal', label: 'Normal' },
    { value: 'robot', label: 'Robô' },
    { value: 'helium', label: 'Hélio' },
    { value: 'deep', label: 'Grave' },
    { value: 'echo', label: 'Eco' },
    { value: 'whisper', label: 'Sussurro' },
    { value: 'alien', label: 'Alien' },
    { value: 'chipmunk', label: 'Esquilo' }
  ];

  // Apply voice filter to audio blob
  const applyVoiceFilter = useCallback(async (blob: Blob, filter: VoiceFilter): Promise<Blob> => {
    if (filter === 'normal') return blob;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Create a new buffer for the filtered audio
      const filteredBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );

      // Apply different filters based on selection
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const inputData = audioBuffer.getChannelData(channel);
        const outputData = filteredBuffer.getChannelData(channel);

        for (let i = 0; i < inputData.length; i++) {
          let sample = inputData[i];

          switch (filter) {
            case 'robot':
              sample = Math.sign(sample) * Math.pow(Math.abs(sample), 0.5);
              if (i % 100 < 50) sample *= 0.7;
              break;
            
            case 'helium':
              if (i < inputData.length - 1) {
                sample = (sample + inputData[i + 1]) * 0.8;
              }
              break;
            
            case 'deep':
              sample *= 1.2;
              if (i % 3 === 0 && i > 0) {
                sample = (sample + inputData[i - 1]) * 0.6;
              }
              break;
            
            case 'echo':
              if (i > audioBuffer.sampleRate * 0.2) {
                const echoIndex = Math.floor(i - audioBuffer.sampleRate * 0.2);
                sample += inputData[echoIndex] * 0.3;
              }
              break;
            
            case 'whisper':
              sample *= 0.4;
              sample += (Math.random() - 0.5) * 0.02;
              break;
            
            case 'alien':
              const mod = Math.sin(i * 0.01) * 0.5;
              sample = sample * (1 + mod);
              break;
            
            case 'chipmunk':
              sample *= 0.7;
              if (i % 2 === 0 && i < inputData.length - 2) {
                sample = inputData[i + 2] * 0.9;
              }
              break;
          }

          outputData[i] = Math.max(-1, Math.min(1, sample));
        }
      }

      // Convert back to blob
      const length = filteredBuffer.length * filteredBuffer.numberOfChannels * 2 + 44;
      const buffer = new ArrayBuffer(length);
      const view = new DataView(buffer);
      
      // Write WAV header
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      
      writeString(0, 'RIFF');
      view.setUint32(4, length - 8, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, filteredBuffer.numberOfChannels, true);
      view.setUint32(24, filteredBuffer.sampleRate, true);
      view.setUint32(28, filteredBuffer.sampleRate * filteredBuffer.numberOfChannels * 2, true);
      view.setUint16(32, filteredBuffer.numberOfChannels * 2, true);
      view.setUint16(34, 16, true);
      writeString(36, 'data');
      view.setUint32(40, length - 44, true);
      
      let offset = 44;
      for (let i = 0; i < filteredBuffer.length; i++) {
        for (let channel = 0; channel < filteredBuffer.numberOfChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, filteredBuffer.getChannelData(channel)[i]));
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
          offset += 2;
        }
      }
      
      return new Blob([buffer], { type: 'audio/wav' });
    } catch (error) {
      console.error('Erro ao aplicar filtro de voz:', error);
      return blob;
    }
  }, []);

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
      
      mediaRecorder.onstop = async () => {
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

  const stopRecording = () => {
    console.log('🛑 Parando gravação...');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    setIsRecording(false);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    console.log('✅ Gravação parada');
  };

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

  const uploadAudio = async () => {
    if (!audioBlob || !user) return;

    setIsUploading(true);
    
    try {
      // Upload to storage
      const fileName = `${user.id}/${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase
        .from('audio_posts')
        .insert({
          user_id: user.id,
          description: description.trim() || null,
          audio_url: publicUrl,
          duration: duration,
          voice_filter: voiceFilter
        });

      if (dbError) throw dbError;

      toast({
        title: "Sucesso!",
        description: "Áudio publicado com sucesso",
      });

      onSuccess?.();
      handleClose();
      
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: "Erro",
        description: "Não foi possível publicar o áudio",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    console.log('🚪 Fechando modal, fazendo cleanup...');
    
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
    setDescription('');
    setVoiceFilter('normal');
    setIsPlaying(false);
    setDuration(0);
    setRecordingStartTime(0);
    chunksRef.current = [];
    
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRemainingTime = () => {
    return Math.max(0, 60 - duration);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gravar Áudio</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Voice Filter Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Filtro de Voz</label>
            <Select 
              value={voiceFilter} 
              onValueChange={(value: VoiceFilter) => setVoiceFilter(value)}
              disabled={isRecording || isUploading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {voiceFilters.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recording Controls */}
          <div className="flex flex-col items-center space-y-4">
            {/* Timer Display */}
            <div className="text-center space-y-2">
              <div className="text-3xl font-mono font-bold">
                {formatTime(duration)}
              </div>
              {isRecording && (
                <div className="text-sm text-muted-foreground">
                  <span className="animate-pulse text-red-500">● Gravando</span>
                  <span className="ml-2">
                    (máx. {getRemainingTime()}s restantes)
                  </span>
                </div>
              )}
            </div>
            
            {/* Control Buttons */}
            <div className="flex space-x-4">
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  className="rounded-full w-16 h-16 gradient-bg"
                  disabled={isUploading}
                >
                  <Mic className="w-6 h-6" />
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  className="rounded-full w-16 h-16"
                >
                  <Square className="w-6 h-6" />
                </Button>
              )}
              
              {audioBlob && (
                <Button
                  onClick={playAudio}
                  variant="outline"
                  className="rounded-full w-16 h-16"
                  disabled={isRecording || isUploading}
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </Button>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Descrição (opcional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva seu áudio..."
              maxLength={500}
              disabled={isRecording || isUploading}
            />
          </div>

          {/* Upload Button */}
          <Button
            onClick={uploadAudio}
            disabled={!audioBlob || isRecording || isUploading}
            className="w-full gradient-bg"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Publicando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Publicar Áudio
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleRecordModal;
