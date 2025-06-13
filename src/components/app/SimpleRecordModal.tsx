
import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mic, Square, Play, Pause, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SimpleRecordModalProps {
  open: boolean;
  onClose: () => void;
}

const SimpleRecordModal = ({ open, onClose }: SimpleRecordModalProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [voiceFilter, setVoiceFilter] = useState<string>('none');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const biquadFilterRef = useRef<BiquadFilterNode | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Configurar filtros de áudio
      audioContextRef.current = new AudioContext();
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      gainNodeRef.current = audioContextRef.current.createGain();
      biquadFilterRef.current = audioContextRef.current.createBiquadFilter();
      
      // Aplicar filtro selecionado
      applyVoiceFilter();
      
      sourceRef.current.connect(biquadFilterRef.current);
      biquadFilterRef.current.connect(gainNodeRef.current);
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Timer de gravação com limite de 60 segundos
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 59) {
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
  }, [voiceFilter]);

  const applyVoiceFilter = () => {
    if (!biquadFilterRef.current || !gainNodeRef.current) return;
    
    switch (voiceFilter) {
      case 'robot':
        biquadFilterRef.current.type = 'lowpass';
        biquadFilterRef.current.frequency.value = 1000;
        gainNodeRef.current.gain.value = 1.5;
        break;
      case 'deep':
        biquadFilterRef.current.type = 'lowpass';
        biquadFilterRef.current.frequency.value = 500;
        gainNodeRef.current.gain.value = 2;
        break;
      case 'high':
        biquadFilterRef.current.type = 'highpass';
        biquadFilterRef.current.frequency.value = 1000;
        gainNodeRef.current.gain.value = 1.2;
        break;
      case 'echo':
        // Efeito de eco básico
        gainNodeRef.current.gain.value = 0.8;
        break;
      default:
        biquadFilterRef.current.type = 'allpass';
        gainNodeRef.current.gain.value = 1;
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    }
  }, [isRecording]);

  const playAudio = () => {
    if (audioBlob && !isPlaying) {
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current = new Audio(audioUrl);
      audioRef.current.play();
      setIsPlaying(true);
      
      audioRef.current.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
    }
  };

  const pauseAudio = () => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const uploadAudio = async () => {
    if (!audioBlob || !user || !description.trim()) {
      toast({
        title: "Erro",
        description: "Adicione uma descrição para o áudio",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('audio_posts')
        .insert({
          user_id: user.id,
          audio_url: urlData.publicUrl,
          description: description.trim(),
          duration: recordingTime,
          status: 'active'
        });

      if (insertError) throw insertError;

      toast({
        title: "Sucesso!",
        description: "Áudio publicado com sucesso"
      });

      onClose();
      setAudioBlob(null);
      setDescription('');
      setRecordingTime(0);
      window.location.reload(); // Recarregar para mostrar novo áudio
      
    } catch (error) {
      console.error('Erro ao publicar áudio:', error);
      toast({
        title: "Erro",
        description: "Não foi possível publicar o áudio",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gravar Áudio</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Filtros de Voz */}
          <div>
            <label className="text-sm font-medium">Filtro de Voz</label>
            <select 
              value={voiceFilter} 
              onChange={(e) => setVoiceFilter(e.target.value)}
              className="w-full mt-1 p-2 border rounded-md"
            >
              <option value="none">Normal</option>
              <option value="robot">Robô</option>
              <option value="deep">Grave</option>
              <option value="high">Agudo</option>
              <option value="echo">Eco</option>
            </select>
          </div>

          {/* Timer */}
          <div className="text-center">
            <div className="text-2xl font-mono">
              {formatTime(recordingTime)} / 1:00
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-red-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${(recordingTime / 60) * 100}%` }}
              />
            </div>
          </div>

          {/* Controles de Gravação */}
          <div className="flex justify-center space-x-4">
            {!isRecording && !audioBlob && (
              <Button onClick={startRecording} className="bg-red-500 hover:bg-red-600">
                <Mic className="w-4 h-4 mr-2" />
                Gravar
              </Button>
            )}
            
            {isRecording && (
              <Button onClick={stopRecording} variant="outline">
                <Square className="w-4 h-4 mr-2" />
                Parar
              </Button>
            )}
            
            {audioBlob && !isRecording && (
              <>
                <Button onClick={isPlaying ? pauseAudio : playAudio} variant="outline">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button onClick={resetRecording} variant="outline">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>

          {/* Descrição */}
          {audioBlob && (
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Adicione uma descrição e hashtags (#exemplo)..."
                className="mt-1"
                maxLength={500}
              />
              <div className="text-xs text-gray-500 mt-1">
                {description.length}/500 caracteres
              </div>
            </div>
          )}

          {/* Botão Publicar */}
          {audioBlob && (
            <Button 
              onClick={uploadAudio} 
              disabled={isUploading || !description.trim()}
              className="w-full"
            >
              {isUploading ? 'Publicando...' : 'Publicar Áudio'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleRecordModal;
