-- Políticas RLS para bucket de avatars
-- Execute este SQL no painel do Supabase (SQL Editor)
-- Acesse: https://supabase.nutef.com

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

-- Política para permitir que usuários autenticados façam upload de avatars
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'avatars'
  );

-- Política para permitir que qualquer pessoa visualize avatars (públicos)
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- Política para permitir que usuários atualizem seus próprios avatars
CREATE POLICY "Users can update their own avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'avatars'
    AND auth.uid() IS NOT NULL
  );

-- Política para permitir que usuários deletem seus próprios avatars
CREATE POLICY "Users can delete their own avatars" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'avatars'
    AND auth.uid() IS NOT NULL
  );

-- Verificar se as políticas foram criadas
SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname LIKE '%avatars%';

-- Verificar se o bucket existe
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'avatars'; 