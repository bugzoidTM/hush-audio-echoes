
-- Criar bucket para avatars se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true, 
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Criar políticas de storage para avatars
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'avatars'
  );

CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update their own avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'avatars'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete their own avatars" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'avatars'
    AND auth.uid() IS NOT NULL
  );
