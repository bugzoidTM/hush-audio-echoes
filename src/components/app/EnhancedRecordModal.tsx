
import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Mic, Square, Play, Pause, RotateCcw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import VoiceFilters from './VoiceFilters';
import AudioPlayer from './AudioPlayer';

interface EnhancedRecordModalProps {
  open: boolean;
  onClose: () => void;
}

const EnhancedRecordModal = ({ open, onClose }: EnhancedRecordModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('normal');
  const [enableTranscription, setEnableTranscription] = useState(true);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);

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
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        
        // Cleanup stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      startTimeRef.current = Date.now();
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
    setSelectedFilter('normal');
  };

  const applyVoiceFilter = async (blob: Blob, filter: string): Promise<Blob> => {
    // Esta função seria implementada com Web Audio API para aplicar filtros
    // Por simplicidade, retornamos o blob original
    // Em produção, você implementaria os filtros usando AudioContext
    console.log(`Aplicando filtro: ${filter}`);
    return blob;
  };

  const transcribeAudio = async (audioBlob: Blob): Promise<string | null> => {
    if (!enableTranscription) return null;

    try {
      // Converter blob para base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Audio }
      });

      if (error) throw error;
      return data.text || null;
    } catch (error) {
      console.error('Erro na transcrição:', error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!recordedBlob || !user) return;

    setIsUploading(true);

    try {
      // Aplicar filtro de voz
      const filteredBlob = await applyVoiceFilter(recordedBlob, selectedFilter);

      // Upload do arquivo de áudio
      const fileName = `${user.id}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, filteredBlob);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName);

      // Transcrever áudio se habilitado
      const transcription = await transcribeAudio(filteredBlob);

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
      setTitle('');
      setDescription('');
      setIsAnonymous(false);
      setEnableTranscription(true);
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gravar Áudio com Filtros</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Controles de Gravação */}
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
                <AudioPlayer audioUrl={recordedUrl!} duration={duration} />
                
                <div className="flex justify-center space-x-2">
                  <Button variant="outline" onClick={resetRecording} size="sm">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Gravar Novamente
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Filtros de Voz */}
          {!isRecording && (
            <VoiceFilters 
              selectedFilter={selectedFilter} 
              onFilterChange={setSelectedFilter} 
            />
          )}

          {/* Formulário */}
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

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={isAnonymous}
                    onCheckedChange={setIsAnonymous}
                  />
                  <label className="text-sm font-medium">Publicar anonimamente</label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={enableTranscription}
                    onCheckedChange={setEnableTranscription}
                  />
                  <label className="text-sm font-medium">Gerar transcrição automática</label>
                </div>
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

export default EnhancedRecordModal;
