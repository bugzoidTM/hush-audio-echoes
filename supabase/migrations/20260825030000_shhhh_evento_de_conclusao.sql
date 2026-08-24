-- "Ouviu até o fim" é o sinal mais importante da prévia — e faltava.
--
-- O allowlist previa `preview_complete`, mas nada no front chamava: dava para
-- saber quantas pessoas começaram a ouvir e não quantas ficaram. Num produto
-- cuja aposta é "ouviu uma história inteira, quer outra", medir só o play é
-- medir a curiosidade e perder a conversão.
--
-- `shared_echo_complete` é novo: o Echo que chega pelo WhatsApp merece a mesma
-- pergunta.
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
    'shared_echo_view', 'shared_echo_play', 'shared_echo_complete',
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
