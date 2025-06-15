
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSecureAuth } from '@/hooks/useSecureAuth';
import { useRateLimiter } from '@/hooks/useRateLimiter';
import { audioPostSchema, validateAudioFile, sanitizeHtml } from '@/utils/inputValidation';
import { Mic, Upload, AlertTriangle } from 'lucide-react';

const SecureAudioPostForm = () => {
  const { user, isAuthorized } = useSecureAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  
  const rateLimiter = useRateLimiter('audio_post_creation', {
    maxAttempts: 5,
    windowMs: 60000, // 1 minute
    blockDurationMs: 300000, // 5 minutes
  });

  if (!isAuthorized) {
    return null;
  }

  const handleInputChange = (field: string, value: string) => {
    const sanitizedValue = sanitizeHtml(value);
    setFormData(prev => ({ ...prev, [field]: sanitizedValue }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateAudioFile(file);
    if (!validation.isValid) {
      toast({
        title: "Arquivo inválido",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    setAudioFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rateLimiter.checkRateLimit()) {
      toast({
        title: "Muitas tentativas",
        description: "Aguarde antes de tentar novamente",
        variant: "destructive",
      });
      return;
    }

    if (!audioFile) {
      toast({
        title: "Arquivo obrigatório",
        description: "Selecione um arquivo de áudio",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate form data
      const validatedData = audioPostSchema.parse({
        ...formData,
        duration: 30, // This would come from actual audio duration
      });

      setIsSubmitting(true);

      // Upload audio file with user-specific path
      const fileName = `${user!.id}/${Date.now()}_${audioFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, audioFile);

      if (uploadError) throw uploadError;

      // Create audio post
      const { error: insertError } = await supabase
        .from('audio_posts')
        .insert({
          user_id: user!.id,
          title: validatedData.title,
          description: validatedData.description,
          audio_url: uploadData.path,
          duration: validatedData.duration,
          status: 'active',
        });

      if (insertError) throw insertError;

      toast({
        title: "Post criado",
        description: "Seu áudio foi publicado com sucesso",
      });

      // Reset form
      setFormData({ title: '', description: '' });
      setAudioFile(null);

    } catch (error: any) {
      console.error('Erro ao criar post:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar o post",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (rateLimiter.isBlocked) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <h3 className="text-lg font-semibold mb-2">Limite de posts atingido</h3>
          <p className="text-muted-foreground">
            Aguarde alguns minutos antes de criar outro post.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Criar Post de Áudio
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              placeholder="Título do seu áudio..."
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              maxLength={200}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formData.title.length}/200 caracteres
            </p>
          </div>

          <div>
            <Textarea
              placeholder="Descrição (opcional)..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              maxLength={1000}
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formData.description.length}/1000 caracteres
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span className="text-sm">Selecionar arquivo de áudio</span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
                required
              />
            </label>
            {audioFile && (
              <p className="text-sm text-green-600 mt-2">
                Arquivo selecionado: {audioFile.name}
              </p>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            <p>• Formatos aceitos: MP3, WAV, OGG, WebM, MP4</p>
            <p>• Tamanho máximo: 50MB</p>
            <p>• Duração máxima: 10 minutos</p>
            <p>• Posts restantes: {rateLimiter.remainingAttempts}</p>
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting || !audioFile}
            className="w-full"
          >
            {isSubmitting ? 'Publicando...' : 'Publicar Áudio'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SecureAudioPostForm;
