
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import VoiceFilters from './VoiceFilters';
import RecordingInterface from './RecordingInterface';
import AudioPostForm from './AudioPostForm';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { applyVoiceFilter, transcribeAudio, uploadAudioFile } from '@/utils/audioProcessingUtils';

interface EnhancedRecordModalProps {
  open: boolean;
  onClose: () => void;
}

const EnhancedRecordModal = ({ open, onClose }: EnhancedRecordModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('normal');
  const [enableTranscription, setEnableTranscription] = useState(true);

  const {
    isRecording,
    recordedBlob,
    recordedUrl,
    duration,
    startRecording,
    stopRecording,
    resetRecording
  } = useAudioRecorder();

  const handleSubmit = async () => {
    if (!recordedBlob || !user) return;

    setIsUploading(true);

    try {
      // Aplicar filtro de voz
      const filteredBlob = await applyVoiceFilter(recordedBlob, selectedFilter);

      // Upload do arquivo de áudio
      const publicUrl = await uploadAudioFile(filteredBlob, user.id);

      // Transcrever áudio se habilitado
      const transcription = await transcribeAudio(filteredBlob, enableTranscription);

      // Criar post de áudio
      const { error: insertError } = await supabase
        .from('audio_posts')
        .insert({
          user_id: user.id,
          title: title || null,
          description: description || null,
          audio_url: publicUrl,
          duration: duration,
          transcription: transcription,
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
      handleReset();
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

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setIsAnonymous(false);
    setEnableTranscription(true);
    setSelectedFilter('normal');
    resetRecording();
  };

  const handleResetRecording = () => {
    resetRecording();
    setSelectedFilter('normal');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gravar Áudio com Filtros</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <RecordingInterface
            isRecording={isRecording}
            recordedBlob={recordedBlob}
            recordedUrl={recordedUrl}
            duration={duration}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onResetRecording={handleResetRecording}
          />

          {!isRecording && (
            <VoiceFilters 
              selectedFilter={selectedFilter} 
              onFilterChange={setSelectedFilter} 
            />
          )}

          {recordedBlob && (
            <AudioPostForm
              title={title}
              description={description}
              isAnonymous={isAnonymous}
              enableTranscription={enableTranscription}
              isUploading={isUploading}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
              onAnonymousChange={setIsAnonymous}
              onTranscriptionChange={setEnableTranscription}
              onSubmit={handleSubmit}
              onCancel={onClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedRecordModal;
