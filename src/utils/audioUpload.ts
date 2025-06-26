import { supabase, AUDIO_BUCKET, AUDIO_FOLDER } from '@/integrations/supabase/client';

export interface AudioUploadResult {
  success: boolean;
  publicUrl?: string;
  error?: string;
}

export async function uploadAudioFile(
  audioBlob: Blob, 
  userId: string, 
  filename?: string
): Promise<AudioUploadResult> {
  try {
    // Gerar nome do arquivo se não fornecido
    const fileName = filename || `${Date.now()}.webm`;
    
    // Caminho: audio/userId/filename
    const filePath = `${AUDIO_FOLDER}/${userId}/${fileName}`;
    
    console.log('📤 Uploading audio:', filePath);
    
    // Upload para bucket public
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(filePath, audioBlob);
    
    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      return {
        success: false,
        error: uploadError.message
      };
    }
    
    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(AUDIO_BUCKET)
      .getPublicUrl(filePath);
    
    console.log('✅ Upload successful:', publicUrl);
    
    return {
      success: true,
      publicUrl
    };
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

export async function deleteAudioFile(
  userId: string, 
  filename: string
): Promise<boolean> {
  try {
    const filePath = `${AUDIO_FOLDER}/${userId}/${filename}`;
    
    const { error } = await supabase.storage
      .from(AUDIO_BUCKET)
      .remove([filePath]);
    
    if (error) {
      console.error('❌ Delete error:', error);
      return false;
    }
    
    console.log('✅ File deleted:', filePath);
    return true;
    
  } catch (error) {
    console.error('❌ Delete failed:', error);
    return false;
  }
} 