
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { VoiceFilter } from '@/utils/voiceFilters';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import RecordingControls from './RecordingControls';
import RecordingTimer from './RecordingTimer';
import VoiceFilterSelector from './VoiceFilterSelector';

interface RecordAudioModalProps {
  open: boolean;
  onClose: () => void;
}

const RecordAudioModal = ({ open, onClose }: RecordAudioModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<VoiceFilter>('normal');

  const {
    isRecording,
    audioBlob,
    isPlaying,
    duration,
    startRecording,
    stopRecording,
    playAudio,
    cleanup
  } = useAudioRecording();

  const handleStartRecording = () => {
    startRecording();
  };

  const handleStopRecording = () => {
    stopRecording(selectedFilter);
  };

  const handleSubmit = async () => {
    if (!audioBlob || !user) return;

    setIsUploading(true);

    try {
      // Upload audio file
      const fileName = `${user.id}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, audioBlob);

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
          duration: duration,
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
      handleReset();
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

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setIsAnonymous(false);
    setSelectedFilter('normal');
    cleanup();
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gravar Áudio</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Recording Timer */}
          <RecordingTimer duration={duration} isRecording={isRecording} />

          {/* Recording Controls */}
          <div className="flex justify-center">
            <RecordingControls
              isRecording={isRecording}
              isPlaying={isPlaying}
              audioBlob={audioBlob}
              isUploading={isUploading}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              onPlayAudio={playAudio}
            />
          </div>

          {/* Voice Filter Selector */}
          {!isRecording && (
            <VoiceFilterSelector
              value={selectedFilter}
              onChange={setSelectedFilter}
              disabled={isRecording || isUploading}
            />
          )}

          {/* Form Fields */}
          {audioBlob && (
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
                  onClick={handleClose}
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
