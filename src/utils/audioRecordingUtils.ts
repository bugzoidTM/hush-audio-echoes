
import { applyVoiceFilter, VoiceFilter } from '@/utils/voiceFilters';

export const processRecordedAudio = async (blob: Blob, voiceFilter: VoiceFilter): Promise<Blob> => {
  console.log('🎛️ [audioRecordingUtils] Aplicando filtro de voz:', voiceFilter);
  
  try {
    const filteredBlob = await applyVoiceFilter(blob, voiceFilter);
    console.log('✅ [audioRecordingUtils] Filtro aplicado - tamanho final:', filteredBlob.size, 'bytes');
    return filteredBlob;
  } catch (error) {
    console.error('❌ [audioRecordingUtils] Erro ao aplicar filtro:', error);
    console.log('🔄 [audioRecordingUtils] Usando áudio original sem filtro');
    return blob;
  }
};

export const createAudioURL = (blob: Blob): string => {
  return URL.createObjectURL(blob);
};

export const revokeAudioURL = (url: string): void => {
  URL.revokeObjectURL(url);
};
