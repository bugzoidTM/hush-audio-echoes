-- =====================================================
-- FIX DEFINITIVO PARA STORAGE NO SUPABASE SELF-HOSTED
-- Execute este SQL no painel do Supabase
-- =====================================================

-- 1. Primeiro, vamos verificar se os buckets existem no storage.buckets
SELECT name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
ORDER BY name;

-- 2. Recriar os buckets se necessário (com UPSERT)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('public', 'public', true, 52428800, ARRAY['audio/*', 'image/*', 'text/*']::text[]),
  ('audio-posts', 'audio-posts', true, 52428800, ARRAY['audio/*']::text[]),
  ('audio-files', 'audio-files', true, 52428800, ARRAY['audio/*']::text[])
ON CONFLICT (id) 
DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Limpar todas as políticas RLS existentes
DROP POLICY IF EXISTS "Anyone can view public bucket" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to public bucket" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete from public bucket" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view audio-posts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to audio-posts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete from audio-posts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view audio-files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to audio-files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete from audio-files" ON storage.objects;
DROP POLICY IF EXISTS "Public bucket access" ON storage.objects;
DROP POLICY IF EXISTS "Audio posts access" ON storage.objects;
DROP POLICY IF EXISTS "Audio files access" ON storage.objects;

-- 4. Criar políticas RLS PERMISSIVAS para todos os buckets
CREATE POLICY "Public bucket - SELECT" ON storage.objects
  FOR SELECT USING (bucket_id = 'public');

CREATE POLICY "Public bucket - INSERT" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'public');

CREATE POLICY "Public bucket - UPDATE" ON storage.objects
  FOR UPDATE USING (bucket_id = 'public');

CREATE POLICY "Public bucket - DELETE" ON storage.objects
  FOR DELETE USING (bucket_id = 'public');

CREATE POLICY "Audio posts - SELECT" ON storage.objects
  FOR SELECT USING (bucket_id = 'audio-posts');

CREATE POLICY "Audio posts - INSERT" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'audio-posts');

CREATE POLICY "Audio posts - UPDATE" ON storage.objects
  FOR UPDATE USING (bucket_id = 'audio-posts');

CREATE POLICY "Audio posts - DELETE" ON storage.objects
  FOR DELETE USING (bucket_id = 'audio-posts');

CREATE POLICY "Audio files - SELECT" ON storage.objects
  FOR SELECT USING (bucket_id = 'audio-files');

CREATE POLICY "Audio files - INSERT" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'audio-files');

CREATE POLICY "Audio files - UPDATE" ON storage.objects
  FOR UPDATE USING (bucket_id = 'audio-files');

CREATE POLICY "Audio files - DELETE" ON storage.objects
  FOR DELETE USING (bucket_id = 'audio-files');

-- 5. Habilitar RLS nas tabelas de storage
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- 6. Política para buckets (permitir visualização)
DROP POLICY IF EXISTS "Buckets are viewable by everyone" ON storage.buckets;
CREATE POLICY "Buckets are viewable by everyone" ON storage.buckets
  FOR SELECT USING (true);

-- 7. Inserir registros na tabela objects para "acordar" os buckets
INSERT INTO storage.objects (bucket_id, name, owner, metadata)
VALUES 
  ('public', '.keep', NULL, '{}'),
  ('audio-posts', '.keep', NULL, '{}'),
  ('audio-files', '.keep', NULL, '{}')
ON CONFLICT (bucket_id, name) DO NOTHING;

-- 8. Verificar se tudo foi criado corretamente
SELECT 'BUCKETS:' as type, name, public, file_size_limit FROM storage.buckets
UNION ALL
SELECT 'POLICIES:' as type, policyname as name, 'true' as public, NULL FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

-- 9. Testar se consegue inserir um registro
INSERT INTO storage.objects (bucket_id, name, owner, metadata)
VALUES ('public', 'test-connection.txt', NULL, '{"size": 10}')
ON CONFLICT (bucket_id, name) DO UPDATE SET metadata = EXCLUDED.metadata;

SELECT 'TEST:' as status, COUNT(*) as objects_count FROM storage.objects WHERE bucket_id IN ('public', 'audio-posts', 'audio-files');

-- =====================================================
-- EXECUTE ESTE SQL NO PAINEL DO SUPABASE E DEPOIS
-- EXECUTE: npx tsx test-minio-final.ts
-- ===================================================== 