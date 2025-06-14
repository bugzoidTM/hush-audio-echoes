
-- Adicionar coluna voice_filter à tabela audio_posts
ALTER TABLE public.audio_posts 
ADD COLUMN IF NOT EXISTS voice_filter TEXT DEFAULT 'normal';

-- Atualizar posts existentes para ter o filtro normal
UPDATE public.audio_posts 
SET voice_filter = 'normal' 
WHERE voice_filter IS NULL;
