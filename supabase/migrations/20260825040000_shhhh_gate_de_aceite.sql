-- Gate de aceite: verificar as TRÊS versões, não só a dos Termos.
--
-- A verificação anterior olhava terms_version e adult_declared. Publicar uma
-- Política de Privacidade 2.0 mantendo os Termos em 1.0 continuaria respondendo
-- "em dia" — justamente o caso em que é preciso pedir aceite de novo. E os
-- próprios documentos prometem avisar sobre mudanças relevantes.
--
-- As três versões são obrigatórias, sem DEFAULT: um padrão fixo em '1.0' teria
-- o mesmo defeito que esta migração corrige — publicada a Privacidade 2.0,
-- quem chamasse sem o argumento seria comparado ao valor velho e ouviria "em
-- dia". Sem padrão, a chamada incompleta não encontra a função (PGRST202) e
-- falha fechado, que é o comportamento certo para um gate.
DROP FUNCTION IF EXISTS public.has_current_legal_acceptance(text, text, text);
CREATE FUNCTION public.has_current_legal_acceptance(
  p_terms_version text,
  p_privacy_version text,
  p_guidelines_version text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.legal_acceptances l
    WHERE l.user_id = auth.uid()
      AND l.terms_version = p_terms_version
      AND l.privacy_version = p_privacy_version
      AND l.guidelines_version = p_guidelines_version
      AND l.adult_declared
  );
$$;
REVOKE ALL ON FUNCTION public.has_current_legal_acceptance(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_current_legal_acceptance(text, text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.accounts_missing_acceptance(text, text, text);
CREATE FUNCTION public.accounts_missing_acceptance(
  p_terms_version text,
  p_privacy_version text,
  p_guidelines_version text
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE total bigint;
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Permissão de moderação obrigatória.' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) INTO total FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.legal_acceptances l
    WHERE l.user_id = u.id
      AND l.terms_version = p_terms_version
      AND l.privacy_version = p_privacy_version
      AND l.guidelines_version = p_guidelines_version
      AND l.adult_declared
  );
  RETURN total;
END;
$$;
REVOKE ALL ON FUNCTION public.accounts_missing_acceptance(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accounts_missing_acceptance(text, text, text) TO authenticated;

-- A versão antiga de um argumento só some para não responder "em dia" por
-- engano a quem esquecer de passar as três.
DROP FUNCTION IF EXISTS public.has_current_legal_acceptance(text);
DROP FUNCTION IF EXISTS public.accounts_missing_acceptance(text);

-- `REVOKE ... FROM PUBLIC` NÃO tira o anon: o Supabase tem ALTER DEFAULT
-- PRIVILEGES concedendo EXECUTE a anon/authenticated/service_role em toda
-- função nova de public, e essa concessão é explícita, não vem de PUBLIC.
-- Quem protege de verdade é a checagem dentro de cada função (auth.uid() aqui,
-- is_moderator() ali); o REVOKE abaixo é para o anon não conseguir nem chamar.
REVOKE ALL ON FUNCTION public.has_current_legal_acceptance(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.accounts_missing_acceptance(text, text, text) FROM anon;
