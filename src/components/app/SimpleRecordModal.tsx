
import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mic, Square, Play, Pause } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SimpleRecordModalProps {
  open: boolean;
  onClose: () => void;
}

const SimpleRecordModal = ({ open, onClose }: SimpleRecordModalProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<string>('normal');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();

  const voiceFilters = [
    { value: 'normal', label: 'Normal', icon: '🎤' },
    { value: 'robot', label: 'Robô', icon: '🤖' },
    { value: 'helium', label: 'Hélio', icon: '🎈' },
    { value: 'deep', label: 'Grave', icon: '🗣️' },
    { value: 'echo', label: 'Eco', icon: '🔊' },
    { value: 'whisper', label: 'Sussurro', icon: '🤫' },
    { value: 'alien', label: 'Alien', icon: '👽' },
    { value: 'chipmunk', label: 'Esquilo', icon: '🐿️' }
  ];

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const applyVoiceFilter = async (audioBlob: Blob, filter: string): Promise<Blob> => {
    if (filter === 'normal') return audioBlob;
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );
      
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      
      let filterNode;
      
      switch (filter) {
        case 'robot':
          // Bandpass filter for robotic voice
          filterNode = offlineContext.createBiquadFilter();
          filterNode.type = 'bandpass';
          filterNode.frequency.value = 1000;
          filterNode.Q.value = 15;
          break;
        case 'helium':
          // High-pass filter for helium effect  
          filterNode = offlineContext.createBiquadFilter();
          filterNode.type = 'highpass';
          filterNode.frequency.value = 2000;
          break;
        case 'deep':
          // Low-pass filter for deep voice
          filterNode = offlineContext.createBiquadFilter();
          filterNode.type = 'lowpass';
          filterNode.frequency.value = 500;
          break;
        case 'echo':
          // Delay for echo effect
          filterNode = offlineContext.createDelay();
          filterNode.delayTime.value = 0.3;
          const feedback = offlineContext.createGain();
          feedback.gain.value = 0.4;
          filterNode.connect(feedback);
          feedback.connect(filterNode);
          break;
        case 'whisper':
          // Low gain and high-pass for whisper
          filterNode = offlineContext.createGain();
          filterNode.gain.value = 0.3;
          break;
        case 'alien':
          // Ring modulator effect
          filterNode = offlineContext.createBiquadFilter();
          filterNode.type = 'bandpass';
          filterNode.frequency.value = 800;
          filterNode.Q.value = 20;
          break;
        case 'chipmunk':
          // High frequency boost
          filterNode = offlineContext.createBiquadFilter();
          filterNode.type = 'peaking';
          filterNode.frequency.value = 3000;
          filterNode.gain.value = 15;
          break;
        default:
          filterNode = offlineContext.createGain();
      }
      
      source.connect(filterNode);
      filterNode.connect(offlineContext.destination);
      source.start();
      
      const renderedBuffer = await offlineContext.startRendering();
      
      const wavBlob = audioBufferToWav(renderedBuffer);
      return wavBlob;
    } catch (error) {
      console.error('Erro ao aplicar filtro:', error);
      toast({
        title: "Aviso",
        description: "Não foi possível aplicar o filtro, usando áudio original",
        variant: "default"
      });
      return audioBlob;
    }
  };

  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    
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
    view.setUint16(22, buffer.numberOfChannels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true);
    view.setUint16(32, buffer.numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length - 44, true);
    
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const playAudio = () => {
    if (audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.play();
      setIsPlaying(true);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const uploadAudio = async () => {
    if (!audioBlob || !user) return;

    setIsUploading(true);
    
    try {
      const processedBlob = await applyVoiceFilter(audioBlob, selectedFilter);
      const fileName = `${user.id}/${Date.now()}.webm`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, processedBlob, {
          contentType: 'audio/webm'
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('audio_posts')
        .insert({
          user_id: user.id,
          description: description,
          audio_url: publicUrl,
          duration: recordingTime,
          voice_filter: selectedFilter,
          status: 'active'
        });

      if (insertError) throw insertError;

      toast({
        title: "Sucesso!",
        description: `Áudio publicado com filtro "${voiceFilters.find(f => f.value === selectedFilter)?.label}"`,
      });

      onClose();
      setAudioBlob(null);
      setDescription('');
      setRecordingTime(0);
      setSelectedFilter('normal');
      
    } catch (error) {
      console.error('Erro ao enviar áudio:', error);
      toast({
        title: "Erro",
        description: "Não foi possível publicar o áudio",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gravar Áudio</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="text-center">
            <div className="mb-4">
              {isRecording && (
                <div className="text-lg font-mono text-red-500">
                  {formatTime(recordingTime)} / 1:00
                </div>
              )}
            </div>
            
            <div className="flex justify-center space-x-4">
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  className="bg-red-500 hover:bg-red-600 rounded-full w-16 h-16"
                >
                  <Mic className="w-6 h-6" />
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  className="bg-gray-500 hover:bg-gray-600 rounded-full w-16 h-16"
                >
                  <Square className="w-6 h-6" />
                </Button>
              )}
              
              {audioBlob && !isRecording && (
                <Button
                  onClick={isPlaying ? stopAudio : playAudio}
                  variant="outline"
                  className="rounded-full w-16 h-16"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </Button>
              )}
            </div>
          </div>

          {audioBlob && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Filtro de Voz</label>
                <div className="grid grid-cols-2 gap-2">
                  {voiceFilters.map((filter) => (
                    <Button
                      key={filter.value}
                      variant={selectedFilter === filter.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedFilter(filter.value)}
                      className="flex items-center space-x-2 h-auto p-3"
                    >
                      <span className="text-lg">{filter.icon}</span>
                      <div className="text-left">
                        <div className="font-medium text-xs">{filter.label}</div>
                      </div>
                    </Button>
                  ))}
                </div>
                {selectedFilter !== 'normal' && (
                  <div className="mt-2 p-2 bg-muted rounded text-center">
                    <span className="text-sm text-muted-foreground">
                      Filtro selecionado: <strong>{voiceFilters.find(f => f.value === selectedFilter)?.label}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Descrição (use #hashtags)
                </label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva seu áudio... Use #hashtags para categorizar"
                  className="min-h-[80px]"
                />
              </div>

              <div className="flex space-x-2">
                <Button 
                  onClick={uploadAudio} 
                  disabled={isUploading || !description.trim()}
                  className="flex-1"
                >
                  {isUploading ? 'Publicando...' : 'Publicar'}
                </Button>
                <Button 
                  onClick={onClose} 
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleRecordModal;
