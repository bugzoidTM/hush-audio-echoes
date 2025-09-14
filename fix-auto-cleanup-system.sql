-- ================================================================================================
-- CORREÇÃO DO SISTEMA DE LIMPEZA AUTOMÁTICA DE ÁUDIOS
-- Data: $(date)
-- Problema: Áudios não estão sendo deletados automaticamente após 24 horas
-- ================================================================================================

-- 1. Corrigir função de limpeza para DELETAR em vez de apenas marcar como expirado
CREATE OR REPLACE FUNCTION public.cleanup_expired_audios()
RETURNS TABLE(
  deleted_posts_count INTEGER,
  deleted_files_count INTEGER,
  execution_time TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_posts INTEGER := 0;
  deleted_files INTEGER := 0;
  post_record RECORD;
BEGIN
  -- Log do início da execução
  RAISE NOTICE 'Iniciando limpeza de áudios expirados em %', NOW();
  
  -- Buscar todos os posts expirados (mais de 24 horas)
  FOR post_record IN 
    SELECT id, audio_url, user_id, expires_at, created_at
    FROM public.audio_posts 
    WHERE expires_at < NOW() 
    AND status = 'active'
  LOOP
    BEGIN
      -- Deletar as referências relacionadas primeiro (devido a foreign keys)
      -- Deletar likes
      DELETE FROM public.likes WHERE audio_id = post_record.id;
      
      -- Deletar hashtags relacionadas
      DELETE FROM public.audio_hashtags WHERE audio_id = post_record.id;
      
      -- Deletar replies (tanto como pai quanto como resposta)
      DELETE FROM public.audio_replies WHERE parent_audio_id = post_record.id OR reply_audio_id = post_record.id;
      
      -- Deletar reposts
      DELETE FROM public.audio_reposts WHERE original_audio_id = post_record.id;
      
      -- Deletar reports
      DELETE FROM public.reports WHERE audio_id = post_record.id;
      
      -- Deletar o post principal
      DELETE FROM public.audio_posts WHERE id = post_record.id;
      
      deleted_posts := deleted_posts + 1;
      
      RAISE NOTICE 'Post % deletado com sucesso (expirado em %)', post_record.id, post_record.expires_at;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao deletar post %: %', post_record.id, SQLERRM;
    END;
  END LOOP;
  
  -- Retornar estatísticas
  RETURN QUERY SELECT 
    deleted_posts,
    deleted_files,
    NOW();
    
  RAISE NOTICE 'Limpeza concluída: % posts deletados', deleted_posts;
END;
$$;

-- 2. Função auxiliar para verificar posts expirados (sem deletar)
CREATE OR REPLACE FUNCTION public.check_expired_audios()
RETURNS TABLE(
  post_id UUID,
  expires_at TIMESTAMP WITH TIME ZONE,
  hours_expired NUMERIC,
  audio_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.id,
    ap.expires_at,
    EXTRACT(EPOCH FROM (NOW() - ap.expires_at)) / 3600 AS hours_expired,
    ap.audio_url
  FROM public.audio_posts ap
  WHERE ap.expires_at < NOW() 
  AND ap.status = 'active'
  ORDER BY ap.expires_at ASC;
END;
$$;

-- 3. Trigger para execução automática da limpeza (executar a cada INSERT de novo áudio)
CREATE OR REPLACE FUNCTION public.trigger_cleanup_check()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Verificar se há posts expirados a cada 10 novos posts
  SELECT COUNT(*) INTO expired_count
  FROM public.audio_posts 
  WHERE expires_at < NOW() AND status = 'active';
  
  -- Se há mais de 5 posts expirados, executar limpeza
  IF expired_count > 5 THEN
    PERFORM public.cleanup_expired_audios();
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Criar trigger que executa limpeza periodicamente
DROP TRIGGER IF EXISTS trigger_periodic_cleanup ON public.audio_posts;
CREATE TRIGGER trigger_periodic_cleanup
  AFTER INSERT ON public.audio_posts
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_cleanup_check();

-- 5. Função para executar limpeza manual (pode ser chamada via API)
CREATE OR REPLACE FUNCTION public.manual_cleanup_expired_audios()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  cleanup_stats RECORD;
BEGIN
  -- Executar limpeza
  SELECT * INTO cleanup_stats FROM public.cleanup_expired_audios();
  
  -- Retornar resultado em formato JSON
  SELECT json_build_object(
    'success', true,
    'deleted_posts', cleanup_stats.deleted_posts_count,
    'deleted_files', cleanup_stats.deleted_files_count,
    'execution_time', cleanup_stats.execution_time,
    'message', 'Limpeza executada com sucesso'
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 6. Atualizar posts existentes que já deveriam ter expirado
DO $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Contar posts expirados
  SELECT COUNT(*) INTO expired_count
  FROM public.audio_posts 
  WHERE expires_at < NOW() AND status = 'active';
  
  RAISE NOTICE 'Encontrados % posts expirados para limpeza imediata', expired_count;
  
  -- Executar limpeza imediata se houver posts expirados
  IF expired_count > 0 THEN
    PERFORM public.cleanup_expired_audios();
  END IF;
END $$;

-- 7. Criar índice para otimizar consultas de expiração
CREATE INDEX IF NOT EXISTS idx_audio_posts_expires_at_status 
ON public.audio_posts(expires_at, status) 
WHERE status = 'active';

-- 8. Comentários e documentação
COMMENT ON FUNCTION public.cleanup_expired_audios() IS 
'Função que deleta permanentemente áudios expirados (mais de 24 horas) e suas referências relacionadas';

COMMENT ON FUNCTION public.check_expired_audios() IS 
'Função para verificar quais áudios estão expirados sem deletá-los (para debug/monitoramento)';

COMMENT ON FUNCTION public.manual_cleanup_expired_audios() IS 
'Função para execução manual da limpeza via API, retorna resultado em JSON';

-- ================================================================================================
-- VERIFICAÇÃO FINAL
-- ================================================================================================

-- Verificar se as funções foram criadas corretamente
SELECT 
  routine_name,
  routine_type,
  created AS data_criacao
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%cleanup%'
ORDER BY routine_name;

-- Verificar posts expirados atuais
SELECT 
  COUNT(*) AS total_expirados,
  MIN(expires_at) AS mais_antigo,
  MAX(expires_at) AS mais_recente
FROM public.audio_posts 
WHERE expires_at < NOW() AND status = 'active';

-- Mensagem final
SELECT 'Sistema de limpeza automática configurado com sucesso! ✅' AS status;