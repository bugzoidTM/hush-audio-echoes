
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import VoiceFilters from './VoiceFilters';
import RecordingInterface from './RecordingInterface';
import { Button } from '@/components/ui/button';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { processAndApplyVoiceFilter, uploadAudioFile } from '@/utils/audioProcessingUtils';
import { VoiceFilter } from '@/utils/voiceFilters';

interface ReplyModalProps {
  open: boolean;
  onClose: () => void;
  parentPostId: string;
  parentUsername?: string;
}

const ReplyModal = ({ open, onClose, parentPostId, parentUsername }: ReplyModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<VoiceFilter>('normal');

  const {
    isRecording,
    recordedBlob,
    recordedUrl,
    duration,
    startRecording,
    stopRecording,
    resetRecording
  } = useAudioRecorder();

  const handleFilterChange = (filterId: string) => {
    setSelectedFilter(filterId as VoiceFilter);
  };

  const handleSubmit = async () => {
    if (!recordedBlob || !user) return;

    setIsUploading(true);

    try {
      // Aplicar filtro de voz
      const filteredBlob = await processAndApplyVoiceFilter(recordedBlob, selectedFilter);

      // Upload do arquivo de áudio
      const publicUrl = await uploadAudioFile(filteredBlob, user.id);

      // Criar post de resposta
      const { data: replyPost, error: replyError } = await supabase
        .from('audio_posts')
        .insert({
          user_id: user.id,
          description: `Respondendo ${parentUsername ? `@${parentUsername}` : 'a um áudio'}`,
          audio_url: publicUrl,
          duration: duration,
          is_anonymous: false,
          voice_filter: selectedFilter,
          parent_id: parentPostId,
        })
        .select()
        .single();

      if (replyError) throw replyError;

      // Criar relação de resposta
      const { error: relationError } = await supabase
        .from('audio_replies')
        .insert({
          parent_audio_id: parentPostId,
          reply_audio_id: replyPost.id,
          user_id: user.id,
        });

      if (relationError) throw relationError;

      toast({
        title: "Resposta enviada!",
        description: "Sua resposta em áudio foi publicada com sucesso",
      });

      // Refresh do feed
      queryClient.invalidateQueries({ queryKey: ['audio-posts'] });

      // Reset e fechar
      handleReset();
      onClose();
    } catch (error: any) {
      console.error('Erro ao enviar resposta:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a resposta",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFilter('normal');
    resetRecording();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Responder {parentUsername ? `@${parentUsername}` : 'ao áudio'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <RecordingInterface
            isRecording={isRecording}
            recordedBlob={recordedBlob}
            recordedUrl={recordedUrl}
            duration={duration}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onResetRecording={handleReset}
          />

          {!isRecording && (
            <VoiceFilters 
              selectedFilter={selectedFilter} 
              onFilterChange={handleFilterChange} 
            />
          )}

          {recordedBlob && (
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
                {isUploading ? "Enviando..." : "Enviar Resposta"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReplyModal;
