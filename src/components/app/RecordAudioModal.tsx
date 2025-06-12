
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Mic, Square, Play, Pause } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface RecordAudioModalProps {
  open: boolean;
  onClose: () => void;
}

const RecordAudioModal = ({ open, onClose }: RecordAudioModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setRecordedBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          setIsRecording(false);
        }
      }, 60000);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  const handleSubmit = async () => {
    if (!recordedBlob || !user) return;

    setIsUploading(true);

    try {
      // Upload audio file
      const fileName = `${user.id}/${Date.now()}.wav`;
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, recordedBlob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName);

      // Create audio post
      const { error: insertError } = await supabase
        .from('audio_posts')
        .insert({
          user_id: user.id,
          title: title || null,
          description: description || null,
          audio_url: publicUrl,
          duration: 30, // Placeholder - would be calculated from actual audio
          is_anonymous: isAnonymous,
        });

      if (insertError) throw insertError;

      toast({
        title: "Sucesso!",
        description: "Áudio publicado com sucesso",
      });

      // Refresh the feed
      queryClient.invalidateQueries({ queryKey: ['audio-posts'] });

      // Reset form and close
      setTitle('');
      setDescription('');
      setIsAnonymous(false);
      setRecordedBlob(null);
      onClose();
    } catch (error: any) {
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
          {/* Recording Controls */}
          <div className="text-center space-y-4">
            {!recordedBlob ? (
              <div className="space-y-4">
                <div className="w-24 h-24 mx-auto gradient-bg rounded-full flex items-center justify-center">
                  <Mic className="w-12 h-12 text-white" />
                </div>
                
                {!isRecording ? (
                  <Button onClick={startRecording} className="gradient-bg">
                    <Mic className="w-4 h-4 mr-2" />
                    Começar Gravação
                  </Button>
                ) : (
                  <Button onClick={stopRecording} variant="destructive">
                    <Square className="w-4 h-4 mr-2" />
                    Parar Gravação
                  </Button>
                )}
                
                {isRecording && (
                  <p className="text-sm text-muted-foreground animate-pulse">
                    Gravando... (máx. 60s)
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-center space-x-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setIsPlaying(!isPlaying)}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <span className="text-sm">Áudio gravado com sucesso!</span>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  onClick={() => setRecordedBlob(null)}
                  size="sm"
                >
                  Gravar Novamente
                </Button>
              </div>
            )}
          </div>

          {/* Form Fields */}
          {recordedBlob && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Título (opcional)</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Dê um título ao seu áudio"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Descrição (opcional)</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Conte mais sobre seu áudio..."
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

export default RecordAudioModal;
