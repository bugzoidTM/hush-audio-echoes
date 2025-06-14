
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { VoiceFilter } from '@/utils/voiceFilters';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import RecordingTimer from './RecordingTimer';
import RecordingControls from './RecordingControls';
import VoiceFilterSelector from './VoiceFilterSelector';

interface SimpleRecordModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SimpleRecordModal = ({ open, onClose, onSuccess }: SimpleRecordModalProps) => {
  const [description, setDescription] = useState('');
  const [voiceFilter, setVoiceFilter] = useState<VoiceFilter>('normal');
  const [isUploading, setIsUploading] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  
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

  console.log('🎬 [SimpleRecordModal] Estado atual:', { 
    isRecording, 
    duration, 
    audioBlob: !!audioBlob,
    open,
    voiceFilter
  });

  const uploadAudio = async () => {
    if (!audioBlob || !user) {
      console.log('❌ [SimpleRecordModal] Upload cancelado - sem áudio ou usuário');
      return;
    }

    setIsUploading(true);
    console.log('📤 [SimpleRecordModal] Iniciando upload...');
    
    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      console.log('📁 [SimpleRecordModal] Nome do arquivo:', fileName);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, audioBlob);

      if (uploadError) {
        console.error('❌ [SimpleRecordModal] Erro no upload:', uploadError);
        throw uploadError;
      }

      console.log('✅ [SimpleRecordModal] Upload realizado');

      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('audio_posts')
        .insert({
          user_id: user.id,
          description: description.trim() || null,
          audio_url: publicUrl,
          duration: duration,
          voice_filter: voiceFilter
        });

      if (dbError) {
        console.error('❌ [SimpleRecordModal] Erro no banco:', dbError);
        throw dbError;
      }

      console.log('✅ [SimpleRecordModal] Post salvo');

      toast({
        title: "Sucesso!",
        description: "Áudio publicado com sucesso",
      });

      onSuccess?.();
      handleClose();
      
    } catch (error) {
      console.error('❌ [SimpleRecordModal] Erro no upload:', error);
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
    console.log('🚪 [SimpleRecordModal] Fechando modal...');
    cleanup();
    setDescription('');
    setVoiceFilter('normal');
    onClose();
  };

  const handleStopRecording = () => {
    console.log('🛑 [SimpleRecordModal] Parando gravação com filtro:', voiceFilter);
    stopRecording(voiceFilter);
  };

  const handleStartRecording = () => {
    console.log('▶️ [SimpleRecordModal] Iniciando gravação...');
    startRecording();
  };

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      console.log('🔄 [SimpleRecordModal] Modal aberto - resetando estado');
      cleanup();
      setDescription('');
      setVoiceFilter('normal');
    }
  }, [open, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gravar Áudio</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <VoiceFilterSelector
            value={voiceFilter}
            onChange={setVoiceFilter}
            disabled={isRecording || isUploading}
          />

          <div className="flex flex-col items-center space-y-4">
            <RecordingTimer duration={duration} isRecording={isRecording} />
            
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
