
-- Dar permissão de admin para o usuário atual
INSERT INTO public.user_roles (user_id, role) 
VALUES ('278374b0-9430-4ce7-9185-58bfbc40ea6e', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Criar bucket de armazenamento para arquivos de áudio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('audio-files', 'audio-files', true, 52428800, ARRAY['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg'])
ON CONFLICT (id) DO NOTHING;

-- Criar políticas RLS para o bucket de áudio
CREATE POLICY "Usuários podem fazer upload de arquivos de áudio" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Arquivos de áudio são publicamente visíveis" ON storage.objects
FOR SELECT USING (bucket_id = 'audio-files');

CREATE POLICY "Usuários podem deletar seus próprios arquivos" ON storage.objects
FOR DELETE USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Criar foreign keys que estão faltando
ALTER TABLE audio_posts 
ADD CONSTRAINT fk_audio_posts_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE audio_posts 
ADD CONSTRAINT fk_audio_posts_challenge_id 
FOREIGN KEY (challenge_id) REFERENCES daily_challenges(id) ON DELETE SET NULL;

ALTER TABLE likes 
ADD CONSTRAINT fk_likes_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE likes 
ADD CONSTRAINT fk_likes_audio_id 
FOREIGN KEY (audio_id) REFERENCES audio_posts(id) ON DELETE CASCADE;

-- Criar políticas RLS para as tabelas principais
ALTER TABLE audio_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para audio_posts
CREATE POLICY "Audio posts são visíveis para todos" ON audio_posts
FOR SELECT USING (status = 'active');

CREATE POLICY "Usuários podem criar seus próprios posts" ON audio_posts
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem editar seus próprios posts" ON audio_posts
FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para likes
CREATE POLICY "Likes são visíveis para todos" ON likes
FOR SELECT USING (true);

CREATE POLICY "Usuários podem criar likes" ON likes
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios likes" ON likes
FOR DELETE USING (auth.uid() = user_id);

-- Políticas para profiles
CREATE POLICY "Profiles são visíveis para todos" ON profiles
FOR SELECT USING (true);

CREATE POLICY "Usuários podem editar seu próprio profile" ON profiles
FOR UPDATE USING (auth.uid() = id);
