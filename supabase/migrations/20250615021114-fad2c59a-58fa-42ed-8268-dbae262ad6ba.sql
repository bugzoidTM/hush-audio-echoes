
-- Habilitar RLS na tabela audio_posts
ALTER TABLE audio_posts ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários vejam todos os posts ativos
CREATE POLICY "Users can view all active audio posts" ON audio_posts
  FOR SELECT TO authenticated
  USING (status = 'active');

-- Política para permitir que usuários criem seus próprios posts
CREATE POLICY "Users can create their own audio posts" ON audio_posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Política para permitir que usuários atualizem seus próprios posts
CREATE POLICY "Users can update their own audio posts" ON audio_posts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
