
-- Remover todas as políticas existentes do bucket audio-files
DROP POLICY IF EXISTS "Users can upload their audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view audio files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload audio files" ON storage.objects;

-- Garantir que o bucket está público e configurado corretamente
UPDATE storage.buckets 
SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4']
WHERE id = 'audio-files';

-- Criar novas políticas com nomes únicos
CREATE POLICY "public_audio_files_read" ON storage.objects
FOR SELECT USING (bucket_id = 'audio-files');

CREATE POLICY "auth_users_audio_upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'audio-files' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "owners_audio_update" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'audio-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "owners_audio_delete" ON storage.objects
FOR DELETE USING (
  bucket_id = 'audio-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
