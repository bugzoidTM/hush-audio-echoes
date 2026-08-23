-- Últimos acertos antes do beta.
--
-- Sobre a ordem das migrations: `erase_account_data` nasceu em
-- 20260824200000, antes de existirem `legal_acceptances` e
-- `acquisition_events`. A tentação era voltar lá e acrescentar as duas linhas —
-- e foi o que se fez por um momento. Está errado por dois motivos: numa
-- instalação limpa a migration antiga rodaria antes de a tabela existir, e uma
-- instalação que já aplicou aquele arquivo nunca veria a versão editada.
-- Migration aplicada é história; correção vem em arquivo novo.

-- ---------------------------------------------------------------------------
-- 1. Tentativa de senha vira endpoint limitado
-- ---------------------------------------------------------------------------

-- `verify_my_password` compara a tentativa direto com o bcrypt e podia ser
-- chamada à vontade por qualquer sessão autenticada. Na prática, uma sessão
-- roubada ganhava um oráculo de senha — e é justamente ela que protege a
-- exclusão de conta.
INSERT INTO public.rate_limits (action, max_hits, window_seconds, description) VALUES
  ('password_check', 5, 900, 'Tentativas de reconfirmação de senha por 15 minutos, por conta.')
ON CONFLICT (action) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_my_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE hash_atual text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  -- O limite entra ANTES da comparação: contar só os acertos deixaria a força
  -- bruta livre, que é exatamente o caso a impedir. Estourar levanta PT429, que
  -- o PostgREST devolve como 429.
  PERFORM public.consume_rate_limit(auth.uid(), 'password_check');

  IF p_password IS NULL OR p_password = '' THEN
    RETURN false;
  END IF;

  SELECT encrypted_password INTO hash_atual FROM auth.users WHERE id = auth.uid();
  IF hash_atual IS NULL OR hash_atual = '' THEN
    -- Conta sem senha (login social, por exemplo) não tem o que reconfirmar.
    RETURN false;
  END IF;

  RETURN extensions.crypt(p_password, hash_atual) = hash_atual;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_my_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_my_password(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Exclusão de conta alcança o que nasceu depois dela
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.erase_account_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  echoes_apagados integer;
  voices_apagadas integer;
  caminhos text[];
BEGIN
  IF NOT (auth.role() = 'service_role' OR auth.uid() = p_user_id) THEN
    RAISE EXCEPTION 'Só o titular pode apagar a própria conta.' USING ERRCODE = '42501';
  END IF;

  -- Os caminhos saem antes: audio_posts.owner_user_id tem ON DELETE CASCADE
  -- para auth.users, então apagar a conta primeiro levaria embora o
  -- storage_path e deixaria o áudio no bucket para sempre.
  SELECT COALESCE(array_agg(storage_path), ARRAY[]::text[]) INTO caminhos
  FROM public.audio_posts
  WHERE owner_user_id = p_user_id AND storage_path IS NOT NULL;

  UPDATE public.audio_posts
  SET status = 'deleted', visibility = 'unlisted', expires_at = now(), updated_at = now()
  WHERE owner_user_id = p_user_id AND status <> 'deleted';
  GET DIAGNOSTICS echoes_apagados = ROW_COUNT;

  UPDATE public.voices SET status = 'deleted', updated_at = now()
  WHERE owner_user_id = p_user_id AND status <> 'deleted';
  GET DIAGNOSTICS voices_apagadas = ROW_COUNT;

  DELETE FROM public.echo_reactions WHERE user_id = p_user_id;
  DELETE FROM public.voice_follows WHERE follower_user_id = p_user_id;
  DELETE FROM public.user_blocks WHERE blocker_user_id = p_user_id;
  DELETE FROM public.onboarding_preferences WHERE user_id = p_user_id;
  DELETE FROM public.echo_events WHERE user_id = p_user_id;
  DELETE FROM public.rate_limit_hits WHERE user_id = p_user_id;
  DELETE FROM public.notifications WHERE recipient_user_id = p_user_id;
  DELETE FROM public.legal_acceptances WHERE user_id = p_user_id;

  -- Telemetria de funil é anonimizada, não apagada: "uma sessão chegou ao
  -- cadastro" continua sendo verdade sem guardar de quem era a conta. Destruir
  -- a métrica histórica não é exigência de ninguém; manter o vínculo, sim.
  UPDATE public.acquisition_events SET user_id = NULL WHERE user_id = p_user_id;

  -- Denúncias feitas perdem o vínculo com a pessoa, mas não somem: apagá-las
  -- deixaria a moderação sem o histórico do caso denunciado, que existe para
  -- proteger terceiros.
  UPDATE public.reports SET reporter_id = NULL WHERE reporter_id = p_user_id;

  RETURN jsonb_build_object(
    'echoes_apagados', echoes_apagados,
    'voices_apagadas', voices_apagadas,
    'caminhos_de_midia', to_jsonb(caminhos)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.erase_account_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.erase_account_data(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Contas sem aceite registrado ficam detectáveis
-- ---------------------------------------------------------------------------

-- O registro do aceite pode ter falhado calado (ver a correção do fetch no
-- front). Sem uma forma de perguntar "esta conta aceitou a versão vigente?",
-- uma falha assim só apareceria num pedido judicial.
CREATE OR REPLACE FUNCTION public.has_current_legal_acceptance(p_terms_version text DEFAULT '1.0')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.legal_acceptances l
    WHERE l.user_id = auth.uid() AND l.terms_version = p_terms_version AND l.adult_declared
  );
$$;
REVOKE ALL ON FUNCTION public.has_current_legal_acceptance(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_current_legal_acceptance(text) TO authenticated;

-- Quantas contas ficaram sem aceite: pergunta de operação, resposta no painel.
CREATE OR REPLACE FUNCTION public.accounts_missing_acceptance(p_terms_version text DEFAULT '1.0')
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
    WHERE l.user_id = u.id AND l.terms_version = p_terms_version
  );
  RETURN total;
END;
$$;
REVOKE ALL ON FUNCTION public.accounts_missing_acceptance(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accounts_missing_acceptance(text) TO authenticated;
