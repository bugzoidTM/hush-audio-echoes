
-- Verificar se a coluna expires_at existe na tabela audio_posts
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'audio_posts' AND column_name = 'expires_at';

-- Se não existir, vamos adicionar a coluna expires_at
ALTER TABLE public.audio_posts 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '24 hours');

-- Atualizar posts existentes que não têm expires_at definido
UPDATE public.audio_posts 
SET expires_at = created_at + interval '24 hours' 
WHERE expires_at IS NULL;

-- Verificar se a função expire_old_posts já existe e está funcionando
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'expire_old_posts' AND routine_schema = 'public';

-- Se necessário, criar/atualizar a função de expiração
CREATE OR REPLACE FUNCTION public.expire_old_posts()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.audio_posts 
  SET status = 'expired'
  WHERE expires_at < NOW() AND status = 'active';
END;
$function$;
