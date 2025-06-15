
-- Criar tabela para respostas de áudio
CREATE TABLE public.audio_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_audio_id UUID REFERENCES public.audio_posts(id) ON DELETE CASCADE NOT NULL,
  reply_audio_id UUID REFERENCES public.audio_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para republicações
CREATE TABLE public.audio_reposts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_audio_id UUID REFERENCES public.audio_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(original_audio_id, user_id)
);

-- Adicionar RLS às tabelas
ALTER TABLE public.audio_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_reposts ENABLE ROW LEVEL SECURITY;

-- Políticas para audio_replies
CREATE POLICY "Users can view all audio replies" 
  ON public.audio_replies 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create audio replies" 
  ON public.audio_replies 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audio replies" 
  ON public.audio_replies 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Políticas para audio_reposts
CREATE POLICY "Users can view all audio reposts" 
  ON public.audio_reposts 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create audio reposts" 
  ON public.audio_reposts 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audio reposts" 
  ON public.audio_reposts 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Adicionar contador de reposts na tabela audio_posts
ALTER TABLE public.audio_posts ADD COLUMN IF NOT EXISTS reposts_count INTEGER NOT NULL DEFAULT 0;

-- Função para atualizar contadores de replies
CREATE OR REPLACE FUNCTION update_replies_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.audio_posts 
    SET replies_count = replies_count + 1 
    WHERE id = NEW.parent_audio_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.audio_posts 
    SET replies_count = replies_count - 1 
    WHERE id = OLD.parent_audio_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar contadores de reposts
CREATE OR REPLACE FUNCTION update_reposts_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.audio_posts 
    SET reposts_count = reposts_count + 1 
    WHERE id = NEW.original_audio_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.audio_posts 
    SET reposts_count = reposts_count - 1 
    WHERE id = OLD.original_audio_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar contadores
CREATE TRIGGER trigger_update_replies_count
  AFTER INSERT OR DELETE ON public.audio_replies
  FOR EACH ROW EXECUTE FUNCTION update_replies_count();

CREATE TRIGGER trigger_update_reposts_count
  AFTER INSERT OR DELETE ON public.audio_reposts
  FOR EACH ROW EXECUTE FUNCTION update_reposts_count();
