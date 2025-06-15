
import { supabase } from '@/integrations/supabase/client';
import { applyVoiceFilter } from './voiceFilters';

export const processAndApplyVoiceFilter = async (blob: Blob, filter: string): Promise<Blob> => {
  console.log('🎛️ [audioProcessingUtils] Processando áudio com filtro:', filter);
  
  try {
    const filteredBlob = await applyVoiceFilter(blob, filter as any);
    console.log('✅ [audioProcessingUtils] Filtro aplicado - tamanho final:', filteredBlob.size, 'bytes');
    return filteredBlob;
  } catch (error) {
    console.error('❌ [audioProcessingUtils] Erro ao aplicar filtro:', error);
    console.log('🔄 [audioProcessingUtils] Usando áudio original sem filtro');
    return blob;
  }
};

export const transcribeAudio = async (audioBlob: Blob, enableTranscription: boolean): Promise<string | null> => {
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

export const uploadAudioFile = async (blob: Blob, userId: string): Promise<string> => {
  const fileName = `${userId}/${Date.now()}.webm`;
  const { error: uploadError } = await supabase.storage
    .from('audio-files')
    .upload(fileName, blob);

  if (uploadError) throw uploadError;

  // Obter URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('audio-files')
    .getPublicUrl(fileName);

  return publicUrl;
};
