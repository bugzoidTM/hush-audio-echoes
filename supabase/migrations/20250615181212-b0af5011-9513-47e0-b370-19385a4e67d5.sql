
-- Criar função para deletar posts expirados automaticamente
CREATE OR REPLACE FUNCTION public.delete_expired_posts()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Deletar posts que expiraram
  DELETE FROM public.audio_posts 
  WHERE expires_at < NOW() AND status = 'active';
  
  -- Log para debug
  RAISE NOTICE 'Posts expirados removidos em %', NOW();
END;
$function$;

-- Habilitar extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Agendar execução da função a cada 5 minutos
SELECT cron.schedule(
  'delete-expired-posts',
  '*/5 * * * *', -- a cada 5 minutos
  $$
  SELECT public.delete_expired_posts();
  $$
);
