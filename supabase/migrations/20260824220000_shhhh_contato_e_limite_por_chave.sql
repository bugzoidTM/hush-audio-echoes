-- Formulário de contato e limite para quem não tem conta.
--
-- O canal de exercício de direitos (LGPD, art. 18) precisa existir e ser
-- confiável — mas é um endpoint público que dispara mensagem para o dono. Sem
-- limite, vira megafone de spam; com limite por conta não serve, porque quem
-- escreve pode não ter conta (inclusive alguém pedindo exclusão de dados).
--
-- Daí o limite por chave: o mesmo mecanismo já testado, com o ator identificado
-- por um texto (aqui, o IP) em vez de por user_id.

CREATE OR REPLACE FUNCTION public.consume_rate_limit_by_key(p_key text, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_key IS NULL OR btrim(p_key) = '' THEN
    RAISE EXCEPTION 'Origem não identificada.' USING ERRCODE = '42501';
  END IF;
  -- md5 do texto vira um uuid estável: reusa a mesma tabela, o mesmo lock e a
  -- mesma faxina do limite por conta, sem guardar o IP em claro.
  PERFORM public.consume_rate_limit(md5(p_key)::uuid, p_action);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_rate_limit_by_key(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit_by_key(text, text) TO service_role;

INSERT INTO public.rate_limits (action, max_hits, window_seconds, description) VALUES
  ('contato', 3, 3600, 'Mensagens do formulário de contato por hora, por origem.')
ON CONFLICT (action) DO NOTHING;
