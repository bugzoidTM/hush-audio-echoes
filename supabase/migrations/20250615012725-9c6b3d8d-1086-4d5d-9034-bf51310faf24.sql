
-- Criar tabela para seguidores
CREATE TABLE public.followers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Adicionar RLS à tabela
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

-- Políticas para followers
CREATE POLICY "Users can view all followers" 
  ON public.followers 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can follow others" 
  ON public.followers 
  FOR INSERT 
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow others" 
  ON public.followers 
  FOR DELETE 
  USING (auth.uid() = follower_id);

-- Adicionar contadores de seguidores e seguindo na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS followers_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS following_count INTEGER NOT NULL DEFAULT 0;

-- Função para atualizar contadores de seguidores
CREATE OR REPLACE FUNCTION update_followers_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Incrementar followers_count do usuário sendo seguido
    UPDATE public.profiles 
    SET followers_count = followers_count + 1 
    WHERE id = NEW.following_id;
    
    -- Incrementar following_count do usuário que está seguindo
    UPDATE public.profiles 
    SET following_count = following_count + 1 
    WHERE id = NEW.follower_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrementar followers_count do usuário sendo deixado de seguir
    UPDATE public.profiles 
    SET followers_count = followers_count - 1 
    WHERE id = OLD.following_id;
    
    -- Decrementar following_count do usuário que parou de seguir
    UPDATE public.profiles 
    SET following_count = following_count - 1 
    WHERE id = OLD.follower_id;
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar contadores
CREATE TRIGGER trigger_update_followers_count
  AFTER INSERT OR DELETE ON public.followers
  FOR EACH ROW EXECUTE FUNCTION update_followers_count();
