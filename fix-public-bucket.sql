-- ============================================
-- CONFIGURAR BUCKET PUBLIC PARA ÁUDIOS
-- ============================================

-- 1. Remover políticas conflitantes no bucket public
DROP POLICY IF EXISTS "public_bucket_policy" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1oj01fe_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1oj01fe_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1oj01fe_2" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1oj01fe_3" ON storage.objects;

-- 2. Criar políticas para permitir upload de áudios no bucket public
CREATE POLICY "allow_audio_uploads_public" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'public' AND 
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = 'audio'
);

CREATE POLICY "allow_audio_select_public" ON storage.objects
FOR SELECT USING (
  bucket_id = 'public' AND
  (storage.foldername(name))[1] = 'audio'
);

CREATE POLICY "allow_audio_delete_public" ON storage.objects
FOR DELETE USING (
  bucket_id = 'public' AND 
  auth.uid()::text = (storage.foldername(name))[2] AND
  (storage.foldername(name))[1] = 'audio'
);

-- 3. Verificar políticas criadas
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
AND policyname LIKE '%audio%'; 