
-- Verificar se o trigger existe e criar apenas se necessário
DO $$
BEGIN
    -- Criar o trigger apenas se não existir
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_likes_count_trigger' 
        AND tgrelid = 'public.likes'::regclass
    ) THEN
        CREATE TRIGGER update_likes_count_trigger
          AFTER INSERT OR DELETE ON public.likes
          FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();
        RAISE NOTICE 'Trigger update_likes_count_trigger criado com sucesso';
    ELSE
        RAISE NOTICE 'Trigger update_likes_count_trigger já existe';
    END IF;
END
$$;
