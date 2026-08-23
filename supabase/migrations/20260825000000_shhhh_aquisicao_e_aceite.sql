-- Funil de aquisição e trilha de aceite dos documentos.

-- ---------------------------------------------------------------------------
-- 1. Eventos de aquisição, separados dos eventos que afetam ranking
-- ---------------------------------------------------------------------------

-- Tabela própria de propósito. `echo_events` alimenta o Discovery: misturar
-- telemetria de funil ali significaria que qualquer medição de marketing mexe
-- no que as pessoas veem. Aqui nada influencia ranking.
--
-- E há um motivo prático: `record_echo_event` só é executável por
-- `authenticated`, então TODO o funil anterior ao cadastro — que é justamente o
-- que precisamos medir — caía num catch silencioso e nunca era registrado.
CREATE TABLE IF NOT EXISTS public.acquisition_events (
  id bigserial PRIMARY KEY,
  session_id text NOT NULL CHECK (char_length(session_id) BETWEEN 8 AND 128),
  event_type text NOT NULL,
  echo_id uuid,
  user_id uuid,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS acquisition_events_funil_idx
  ON public.acquisition_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS acquisition_events_sessao_idx
  ON public.acquisition_events (session_id, created_at);

ALTER TABLE public.acquisition_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.acquisition_events FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.acquisition_events_id_seq FROM anon, authenticated;
-- Sem policy: escrever é só pela RPC abaixo; ler é só pelo painel.

INSERT INTO public.rate_limits (action, max_hits, window_seconds, description) VALUES
  ('acquisition_event', 200, 3600, 'Eventos de funil por hora, por sessão.')
ON CONFLICT (action) DO NOTHING;

CREATE OR REPLACE FUNCTION public.record_acquisition_event(
  p_session_id text,
  p_event_type text,
  p_echo_id uuid DEFAULT NULL,
  p_source text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_type NOT IN (
    'landing_view', 'listen_without_account_click',
    'preview_view', 'preview_play', 'preview_complete', 'preview_next', 'preview_gate_reached',
    'shared_echo_view', 'shared_echo_play',
    'signup_view', 'signup_completed', 'onboarding_completed',
    'first_discovery_play', 'first_reaction', 'first_follow', 'first_publish'
  ) THEN
    RAISE EXCEPTION 'Evento de aquisição inválido.' USING ERRCODE = '22023';
  END IF;

  IF p_session_id IS NULL OR char_length(p_session_id) < 8 THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = '22023';
  END IF;

  -- Limite por sessão, e não por conta: quase todo este funil acontece antes de
  -- existir conta.
  PERFORM public.consume_rate_limit_by_key(p_session_id, 'acquisition_event');

  INSERT INTO public.acquisition_events (session_id, event_type, echo_id, user_id, source)
  VALUES (p_session_id, p_event_type, p_echo_id, auth.uid(), left(COALESCE(p_source, ''), 100));
END;
$$;
REVOKE ALL ON FUNCTION public.record_acquisition_event(text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_acquisition_event(text, text, uuid, text) TO anon, authenticated;

-- Leitura do funil, para o painel. Só moderação: são dados de negócio.
CREATE OR REPLACE FUNCTION public.get_acquisition_funnel(p_days integer DEFAULT 7)
RETURNS TABLE (event_type text, sessoes bigint, eventos bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Permissão de moderação obrigatória.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT a.event_type, count(DISTINCT a.session_id), count(*)
  FROM public.acquisition_events a
  WHERE a.created_at > now() - make_interval(days => greatest(p_days, 1))
  GROUP BY a.event_type
  ORDER BY count(DISTINCT a.session_id) DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_acquisition_funnel(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_acquisition_funnel(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Trilha de aceite dos documentos
-- ---------------------------------------------------------------------------

-- A caixa "declaro que tenho 18 anos e aceito os Termos" era validação de HTML
-- e nada mais: nenhum registro de quem aceitou o quê, nem de qual versão. Os
-- próprios Termos prometem avisar sobre mudanças relevantes — sem versão
-- guardada, não há como saber quem precisa aceitar de novo.
--
-- Não guardamos IP: para saber que a pessoa aceitou, basta saber que foi ela.
CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  guidelines_version text NOT NULL,
  adult_declared boolean NOT NULL DEFAULT false,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS legal_acceptances_user_idx ON public.legal_acceptances (user_id, accepted_at DESC);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legal_acceptances FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.legal_acceptances_id_seq FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_legal_acceptance(
  p_terms_version text,
  p_privacy_version text,
  p_guidelines_version text,
  p_adult_declared boolean DEFAULT true
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE registrado timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.legal_acceptances (user_id, terms_version, privacy_version, guidelines_version, adult_declared)
  VALUES (auth.uid(), left(p_terms_version, 20), left(p_privacy_version, 20), left(p_guidelines_version, 20), p_adult_declared)
  RETURNING accepted_at INTO registrado;
  RETURN registrado;
END;
$$;
REVOKE ALL ON FUNCTION public.record_legal_acceptance(text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_legal_acceptance(text, text, text, boolean) TO authenticated;

-- O aceite entra na exportação de dados (é informação da pessoa sobre ela) e sai
-- junto na exclusão. Não há função separada de leitura: a tabela não é exposta
-- ao PostgREST, e quem lê é a export_my_data, que já é SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quem uuid := auth.uid();
  resultado jsonb;
BEGIN
  IF quem IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'gerado_em', now(),
    'aviso', 'Este arquivo contém os dados vinculados à sua conta no shhhh. Os endereços de áudio deixam de funcionar quando o Echo expira ou é apagado.',
    'conta', (
      SELECT jsonb_build_object('id', u.id, 'email', u.email, 'criada_em', u.created_at, 'ultimo_acesso', u.last_sign_in_at)
      FROM auth.users u WHERE u.id = quem
    ),
    'aceites_de_documentos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'termos', l.terms_version, 'privacidade', l.privacy_version, 'diretrizes', l.guidelines_version,
        'declarou_18_anos', l.adult_declared, 'em', l.accepted_at) ORDER BY l.accepted_at DESC)
      FROM public.legal_acceptances l WHERE l.user_id = quem
    ), '[]'::jsonb),
    'voices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('handle', v.handle, 'nome', v.display_name, 'bio', v.bio,
                                          'criada_em', v.created_at, 'status', v.status, 'indexavel', v.indexable))
      FROM public.voices v WHERE v.owner_user_id = quem
    ), '[]'::jsonb),
    'echoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'titulo', p.title, 'descricao', p.description, 'transcricao', p.transcription,
        'publicado_em', p.published_at, 'expira_em', p.expires_at, 'duracao_segundos', p.duration,
        'modo_identidade', p.identity_mode, 'situacao', p.status, 'moderacao', p.moderation_status,
        'audio', p.audio_url))
      FROM public.audio_posts p WHERE p.owner_user_id = quem
    ), '[]'::jsonb),
    'reacoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('echo', r.echo_id, 'reacao', r.reaction_type, 'em', r.created_at))
      FROM public.echo_reactions r WHERE r.user_id = quem
    ), '[]'::jsonb),
    'voices_seguidas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('handle', v.handle, 'desde', f.created_at))
      FROM public.voice_follows f JOIN public.voices v ON v.id = f.voice_id
      WHERE f.follower_user_id = quem
    ), '[]'::jsonb),
    'bloqueios', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('em', b.created_at))
      FROM public.user_blocks b WHERE b.blocker_user_id = quem
    ), '[]'::jsonb),
    'denuncias_feitas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('motivo', d.reason, 'em', d.created_at, 'situacao', d.status))
      FROM public.reports d WHERE d.reporter_id = quem
    ), '[]'::jsonb),
    'preferencias', (
      SELECT jsonb_build_object('categorias', o.category_ids, 'concluido_em', o.completed_at)
      FROM public.onboarding_preferences o WHERE o.user_id = quem
    )
  ) INTO resultado;

  RETURN resultado;
END;
$$;
REVOKE ALL ON FUNCTION public.export_my_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;
