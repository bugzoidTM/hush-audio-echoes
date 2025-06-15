
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

interface AudioPostFormProps {
  title: string;
  description: string;
  isAnonymous: boolean;
  enableTranscription: boolean;
  isUploading: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onAnonymousChange: (value: boolean) => void;
  onTranscriptionChange: (value: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const AudioPostForm = ({
  title,
  description,
  isAnonymous,
  enableTranscription,
  isUploading,
  onTitleChange,
  onDescriptionChange,
  onAnonymousChange,
  onTranscriptionChange,
  onSubmit,
  onCancel
}: AudioPostFormProps) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Título (opcional)</label>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Dê um título ao seu áudio"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Descrição (opcional)</label>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Conte mais sobre seu áudio..."
          rows={3}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Switch
            checked={isAnonymous}
            onCheckedChange={onAnonymousChange}
          />
          <label className="text-sm font-medium">Publicar anonimamente</label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={enableTranscription}
            onCheckedChange={onTranscriptionChange}
          />
          <label className="text-sm font-medium">Gerar transcrição automática</label>
        </div>
      </div>

      <div className="flex space-x-2">
        <Button
          onClick={onCancel}
          variant="outline"
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isUploading}
          className="flex-1 gradient-bg"
        >
          {isUploading ? "Publicando..." : "Publicar"}
        </Button>
      </div>
    </div>
  );
};

export default AudioPostForm;
