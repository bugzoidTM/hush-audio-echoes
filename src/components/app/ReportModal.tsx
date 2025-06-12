
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Flag } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  audioId: string;
}

const reportReasons = [
  { value: 'spam', label: 'Spam ou conteúdo repetitivo' },
  { value: 'harassment', label: 'Assédio ou bullying' },
  { value: 'hate-speech', label: 'Discurso de ódio' },
  { value: 'violence', label: 'Violência ou ameaças' },
  { value: 'inappropriate', label: 'Conteúdo inapropriado' },
  { value: 'misinformation', label: 'Desinformação' },
  { value: 'copyright', label: 'Violação de direitos autorais' },
  { value: 'other', label: 'Outro motivo' },
];

const ReportModal = ({ open, onClose, audioId }: ReportModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          audio_id: audioId,
          reason: reportReasons.find(r => r.value === reason)?.label || reason,
          description: description.trim() || null,
        });

      if (error) throw error;

      toast({
        title: "Denúncia enviada",
        description: "Sua denúncia foi recebida e será analisada pela nossa equipe",
      });

      setReason('');
      setDescription('');
      onClose();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível enviar a denúncia",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Flag className="w-5 h-5" />
            <span>Denunciar Conteúdo</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Motivo da denúncia</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {reportReasons.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Detalhes adicionais (opcional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Forneça mais informações sobre o problema..."
              rows={4}
            />
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!reason || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "Enviando..." : "Enviar Denúncia"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportModal;
