-- Criar bucket de storage para áudios
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'audio-files',
    'audio-files', 
    true,
    52428800, -- 50MB
    ARRAY['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
) ON CONFLICT (id) DO NOTHING;

-- Política para permitir que usuários autenticados façam upload
CREATE POLICY "Authenticated users can upload audio files" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'audio-files' 
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir que qualquer um visualize arquivos (público)
CREATE POLICY "Anyone can view audio files" ON storage.objects
FOR SELECT USING (bucket_id = 'audio-files');

-- Política para permitir que usuários deletem seus próprios arquivos
CREATE POLICY "Users can delete own audio files" ON storage.objects
FOR DELETE USING (
    bucket_id = 'audio-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir que usuários atualizem seus próprios arquivos
CREATE POLICY "Users can update own audio files" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'audio-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Verificar se as políticas foram criadas
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- Verificar se o bucket foi criado
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'audio-files'; 