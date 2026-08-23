-- P0: moderar o texto público, não só o áudio; e tirar do ranking os números
-- que o próprio cliente podia inventar.

-- ---------------------------------------------------------------------------
-- 1. Moderação passa a considerar título e descrição
-- ---------------------------------------------------------------------------

-- A moderação classificava apenas a transcrição do áudio. Só que o autor
-- escreve livremente título e descrição, e os dois aparecem em público — agora
-- inclusive no card do WhatsApp. Dava para gravar "hoje foi um dia normal",
-- passar pela análise e pôr um dado pessoal ou uma ameaça no título.
CREATE OR REPLACE FUNCTION public.apply_server_moderation(
  p_echo_id uuid,
  p_transcription text,
  p_source text DEFAULT 'server_stt',
  p_error text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  decision text;
  attempts integer;
  texto_publico text;
BEGIN
  IF p_source NOT IN ('server_stt', 'human') THEN
    RAISE EXCEPTION 'Origem de moderação inválida.' USING ERRCODE = '22023';
  END IF;

  IF p_transcription IS NULL OR btrim(p_transcription) = '' THEN
    UPDATE public.audio_posts
    SET moderation_attempts = moderation_attempts + 1,
        moderation_note = left(COALESCE(p_error, 'transcrição server-side vazia'), 500)
    WHERE id = p_echo_id
    RETURNING moderation_attempts INTO attempts;

    IF attempts IS NULL THEN
      RAISE EXCEPTION 'Echo inexistente.' USING ERRCODE = '42704';
    END IF;

    -- Depois de 3 tentativas o Echo não volta para o limbo: vai para a fila
    -- humana. Em nenhum caminho ele é aprovado sem análise.
    IF attempts >= 3 THEN
      UPDATE public.audio_posts
      SET moderation_status = 'review_required', moderated_at = now(), moderation_source = 'server_stt'
      WHERE id = p_echo_id;
      RETURN 'review_required';
    END IF;
    RETURN 'pending';
  END IF;

  -- A decisão considera TODO o conteúdo público em texto: o que a pessoa
  -- escreveu e o que ela falou. A transcrição continua sendo só a do servidor.
  SELECT concat_ws(' ', p.title, p.description, p_transcription)
  INTO texto_publico
  FROM public.audio_posts p WHERE p.id = p_echo_id;

  IF texto_publico IS NULL THEN
    RAISE EXCEPTION 'Echo inexistente.' USING ERRCODE = '42704';
  END IF;

  decision := public.classify_transcription(texto_publico);

  UPDATE public.audio_posts
  SET transcription = left(p_transcription, 10000),
      moderation_status = decision,
      moderation_source = p_source,
      moderated_at = now(),
      moderation_note = NULL
  WHERE id = p_echo_id;

  RETURN decision;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_server_moderation(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_server_moderation(uuid, text, text, text) TO service_role;

-- Editar depois de aprovado era a mesma brecha por outra porta: publicar algo
-- inofensivo, ser aprovado e então trocar o título por um dado pessoal. O texto
-- novo é reclassificado; se não passar, o Echo sai do ar até revisão humana.
-- Passa a devolver a decisão da moderação, não o id: quem edita precisa saber
-- se o texto novo tirou o Echo do ar.
DROP FUNCTION IF EXISTS public.update_echo_metadata(uuid, text, text, uuid);
CREATE OR REPLACE FUNCTION public.update_echo_metadata(
  p_echo_id uuid,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  atual public.audio_posts%ROWTYPE;
  novo_titulo text;
  nova_descricao text;
  decisao text;
BEGIN
  IF p_category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.categories WHERE id = p_category_id) THEN
    RAISE EXCEPTION 'Categoria inexistente.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO atual FROM public.audio_posts
  WHERE id = p_echo_id AND owner_user_id = auth.uid() AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Echo não encontrado para esta conta.' USING ERRCODE = '42501';
  END IF;

  novo_titulo := NULLIF(left(COALESCE(p_title, atual.title), 140), '');
  nova_descricao := NULLIF(left(COALESCE(p_description, atual.description), 500), '');
  decisao := public.classify_transcription(
    concat_ws(' ', novo_titulo, nova_descricao, atual.transcription)
  );

  UPDATE public.audio_posts p
  SET title = novo_titulo,
      description = nova_descricao,
      category_id = COALESCE(p_category_id, p.category_id),
      -- Só desce de nível: uma edição nunca promove um Echo que estava em
      -- revisão para aprovado sem passar pela moderação de novo.
      moderation_status = CASE
        WHEN decisao = 'approved' THEN p.moderation_status
        ELSE decisao END,
      moderated_at = CASE WHEN decisao = 'approved' THEN p.moderated_at ELSE now() END,
      moderation_note = CASE
        WHEN decisao = 'approved' THEN p.moderation_note
        ELSE 'Texto editado após a publicação exigiu nova análise.' END,
      updated_at = now()
  WHERE p.id = p_echo_id;

  RETURN decisao;
END;
$$;
REVOKE ALL ON FUNCTION public.update_echo_metadata(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_echo_metadata(uuid, text, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Ranking deixa de acreditar em número que o cliente inventa
-- ---------------------------------------------------------------------------

-- `record_echo_event` aceita qualquer evento de qualquer conta autenticada, sem
-- deduplicação. Um cliente modificado podia repetir 'play_complete' no próprio
-- Echo ou 'report' no Echo alheio e mexer no ranking sem denúncia nenhuma.
--
-- Duas mudanças: sinais que têm tabela própria (reação, resposta, denúncia)
-- passam a ser contados dessas tabelas, e os eventos que só existem no player
-- passam a contar PESSOAS DISTINTAS, não linhas — girar session_id deixa de
-- multiplicar peso.
--
-- `follow_voice` sai do score por enquanto: não há tabela que registre que o
-- follow veio daquele Echo, e um número falsificável é pior que um sinal a
-- menos. O peso vai para conclusão, que é o sinal mais honesto que temos.
CREATE OR REPLACE FUNCTION public.get_discovery_feed(
  p_limit integer DEFAULT 12,
  p_category_slug text DEFAULT NULL,
  p_exclude_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid, public_identity text, voice_handle text, voice_display_name text, avatar_seed text,
  category_slug text, category_name text, title text, description text, transcription text,
  audio_url text, duration integer, expires_at timestamptz, voice_protection_enabled boolean,
  voice_protection_preset text, reaction_counts jsonb, reply_count integer, created_at timestamptz,
  next_cursor text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH candidate_events AS (
  -- count(DISTINCT ...) é a defesa: uma conta vale um voto por sinal, por mais
  -- que o cliente repita a chamada ou troque de session_id.
  SELECT
    e.echo_id,
    count(DISTINCT COALESCE(e.user_id::text, e.session_id)) FILTER (WHERE e.event_type = 'impression') AS impressions,
    count(DISTINCT COALESCE(e.user_id::text, e.session_id)) FILTER (WHERE e.event_type IN ('play_70', 'play_complete')) AS qualified_plays,
    count(DISTINCT COALESCE(e.user_id::text, e.session_id)) FILTER (WHERE e.event_type = 'skip') AS skips
  FROM public.echo_events e
  GROUP BY e.echo_id
),
reaction_aggregate AS (
  SELECT echo_id, jsonb_object_agg(reaction_type, count) AS counts
  FROM (
    SELECT echo_id, reaction_type, count(*)::integer AS count
    FROM public.echo_reactions GROUP BY echo_id, reaction_type
  ) reactions
  GROUP BY echo_id
),
candidates AS (
  SELECT
    p.*, c.slug AS resolved_category_slug, c.name AS resolved_category_name,
    v.handle, v.display_name, v.avatar_seed,
    COALESCE(ce.impressions, 0) AS impressions,
    COALESCE(ce.qualified_plays, 0) AS qualified_plays,
    COALESCE(ce.skips, 0) AS skips,
    -- Da tabela real, não do evento: responder e denunciar deixam registro.
    (SELECT count(*) FROM public.audio_replies ar WHERE ar.parent_audio_id = p.id) AS respostas_reais,
    (SELECT count(*) FROM public.reports r WHERE r.audio_id = p.id) AS denuncias_reais,
    COALESCE(ra.counts, '{}'::jsonb) AS reactions,
    ROW_NUMBER() OVER (PARTITION BY COALESCE(p.voice_id, p.id) ORDER BY p.published_at DESC) AS voice_position,
    ROW_NUMBER() OVER (PARTITION BY COALESCE(p.category_id, p.id) ORDER BY p.published_at DESC) AS category_position
  FROM public.audio_posts p
  LEFT JOIN public.categories c ON c.id = p.category_id
  LEFT JOIN public.voices v ON v.id = p.voice_id AND v.status = 'active'
  LEFT JOIN candidate_events ce ON ce.echo_id = p.id
  LEFT JOIN reaction_aggregate ra ON ra.echo_id = p.id
  WHERE p.status = 'active'
    AND p.moderation_status = 'approved'
    AND p.visibility = 'public'
    AND (p.expires_at IS NULL OR p.expires_at > now())
    AND p.storage_path IS NOT NULL
    AND public.voice_is_public(p.voice_id)
    AND p.id <> ALL (COALESCE(p_exclude_ids[1:300], ARRAY[]::uuid[]))
    AND (p_category_slug IS NULL OR c.slug = p_category_slug)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE b.blocker_user_id = auth.uid()
        AND (b.blocked_user_id = p.owner_user_id OR (p.voice_id IS NOT NULL AND b.blocked_voice_id = p.voice_id))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.echo_events seen
      WHERE seen.echo_id = p.id AND seen.user_id = auth.uid()
        AND seen.event_type = 'play_complete' AND seen.created_at > now() - interval '7 days'
    )
),
ranked AS (
  SELECT *,
    round((
      0.15 * greatest(0, 1 - extract(epoch FROM (now() - published_at)) / 604800.0)
      + 0.40 * CASE WHEN impressions = 0 THEN 0.5 ELSE qualified_plays::numeric / impressions END
      + 0.15 * (COALESCE((reactions->>'me_too')::numeric, 0) + COALESCE((reactions->>'with_you')::numeric, 0)) / greatest(impressions, 1)
      + 0.15 * respostas_reais::numeric / greatest(impressions, 1)
      + 0.15 * CASE WHEN impressions < 100 THEN 1 ELSE 0 END
      - 0.20 * skips::numeric / greatest(impressions, 1)
      - 0.60 * denuncias_reais::numeric / greatest(impressions, 1)
    )::numeric, 9) AS score
  FROM candidates
  WHERE voice_position <= 2 AND category_position <= 5
)
SELECT
  id,
  CASE WHEN identity_mode = 'anonymous' THEN 'Anônimo' ELSE COALESCE(display_name, 'Voice') END,
  CASE WHEN identity_mode = 'anonymous' THEN NULL ELSE handle END,
  CASE WHEN identity_mode = 'anonymous' THEN NULL ELSE display_name END,
  CASE WHEN identity_mode = 'anonymous' THEN NULL ELSE avatar_seed END,
  resolved_category_slug, resolved_category_name, title, description, transcription,
  audio_url, duration, expires_at, voice_protection_enabled, voice_protection_preset,
  reactions, replies_count, created_at,
  format('%s|%s|%s', score, published_at, id) AS next_cursor
FROM ranked
ORDER BY score DESC, published_at DESC, id DESC
LIMIT least(greatest(p_limit, 1), 15);
$$;
REVOKE ALL ON FUNCTION public.get_discovery_feed(integer, text, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_discovery_feed(integer, text, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_discovery_feed(integer, text, uuid[]) TO authenticated, service_role;

-- Teto de eventos por conta: mesmo sem peso extra no ranking, inundar a tabela
-- é ataque de custo.
INSERT INTO public.rate_limits (action, max_hits, window_seconds, description) VALUES
  ('echo_event', 900, 3600, 'Eventos de player por hora, por conta.')
ON CONFLICT (action) DO NOTHING;

CREATE OR REPLACE FUNCTION public.record_echo_event(
  p_echo_id uuid,
  p_session_id text,
  p_event_type text,
  p_play_position numeric DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_type NOT IN ('impression','play_start','play_25','play_50','play_70','play_complete','replay','skip','reaction','reply','follow_voice','share','report','hide') THEN
    RAISE EXCEPTION 'Invalid event type';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    PERFORM public.consume_rate_limit(auth.uid(), 'echo_event');
  END IF;

  INSERT INTO public.echo_events (echo_id, user_id, session_id, event_type, play_position, metadata)
  VALUES (p_echo_id, auth.uid(), p_session_id, p_event_type, p_play_position, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.record_echo_event(uuid, text, text, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_echo_event(uuid, text, text, numeric, jsonb) TO authenticated;
