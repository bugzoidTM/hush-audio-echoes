
import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Mic, Square, Play, Pause, RotateCcw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface SimpleRecordModalProps {
  open: boolean;
  onClose: () => void;
}

const SimpleRecordModal = ({ open, onClose }: SimpleRecordModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Timer para gravação
  useEffect(() => {
    if (isRecording) {
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        setDuration(recordingTime);
        
        // Cleanup stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      setRecordingTime(0);
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(recordedUrl!);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSubmit = async () => {
    if (!recordedBlob || !user) return;

    setIsUploading(true);

    try {
      // Upload do arquivo de áudio
      const fileName = `${user.id}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, recordedBlob);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName);

      // Criar post de áudio
      const { error: insertError } = await supabase
        .from('audio_posts')
        .insert({
          user_id: user.id,
          description: description || null,
          audio_url: publicUrl,
          duration: duration,
          is_anonymous: isAnonymous,
        });

      if (insertError) throw insertError;

      toast({
        title: "Sucesso!",
        description: "Áudio publicado com sucesso",
      });

      // Refresh do feed
      queryClient.invalidateQueries({ queryKey: ['audio-posts'] });

      // Reset e fechar
      setDescription('');
      setIsAnonymous(false);
      resetRecording();
      onClose();
    } catch (error: any) {
      console.error('Erro ao publicar:', error);
      toast({
        title: "Erro",
        description: "Não foi possível publicar o áudio",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gravar Áudio</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Controles de Gravação */}
          <div className="text-center space-y-4">
            {!recordedBlob ? (
              <div className="space-y-4">
                <div className="w-24 h-24 mx-auto gradient-bg rounded-full flex items-center justify-center">
                  <Mic className="w-12 h-12 text-white" />
                </div>
                
                {isRecording && (
                  <div className="text-2xl font-mono font-bold">
                    {formatTime(recordingTime)} / 1:00
                  </div>
                )}
                
                {!isRecording ? (
                  <Button onClick={startRecording} className="gradient-bg">
                    <Mic className="w-4 h-4 mr-2" />
                    Começar Gravação
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Button onClick={stopRecording} variant="destructive">
                      <Square className="w-4 h-4 mr-2" />
                      Parar Gravação
                    </Button>
                    <p className="text-sm text-muted-foreground animate-pulse">
                      Gravando... (máx. 60s)
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-center space-x-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={togglePlayback}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <span className="text-sm font-mono">{formatTime(duration)}</span>
                  </div>
                </div>
                
                <Button variant="outline" onClick={resetRecording} size="sm">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Gravar Novamente
                </Button>
              </div>
            )}
          </div>

          {/* Formulário */}
          {recordedBlob && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Descrição (opcional)</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva seu áudio... Use #hashtags para organizar!"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={isAnonymous}
                  onCheckedChange={setIsAnonymous}
                />
                <label className="text-sm font-medium">Publicar anonimamente</label>
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isUploading}
                  className="flex-1 gradient-bg"
                >
                  {isUploading ? "Publicando..." : "Publicar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleRecordModal;
