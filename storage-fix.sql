-- ============================================
-- CORRIGIR STORAGE - POLÍTICAS RLS
-- ============================================

-- 1. Permitir que todos vejam buckets públicos
DROP POLICY IF EXISTS "bucket_select_policy" ON storage.buckets;
CREATE POLICY "bucket_select_policy" ON storage.buckets 
FOR SELECT USING (true);

-- 2. Remover políticas conflitantes em storage.objects
DROP POLICY IF EXISTS "audio_files_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "audio_files_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "audio_files_delete_policy" ON storage.objects;
DROP POLICY IF EXISTS "audio_files_update_policy" ON storage.objects;

-- Remover outras políticas que possam estar conflitando
DROP POLICY IF EXISTS "Authenticated users can upload audio files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own audio files" ON storage.objects;

-- 3. Criar políticas corretas para o bucket audio-files
CREATE POLICY "audio_files_upload_policy" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'audio-files' AND auth.role() = 'authenticated');

CREATE POLICY "audio_files_select_policy" ON storage.objects
FOR SELECT USING (bucket_id = 'audio-files');

CREATE POLICY "audio_files_delete_policy" ON storage.objects
FOR DELETE USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "audio_files_update_policy" ON storage.objects
FOR UPDATE USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4. Verificar se RLS está habilitado
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 5. Verificar se as políticas foram criadas
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('buckets', 'objects') AND schemaname = 'storage';

-- 6. Verificar buckets existentes
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets; 