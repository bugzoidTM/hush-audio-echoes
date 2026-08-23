-- Mini-hardening antes do beta aberto.
--
-- 1) O corte de diversidade dos feeds agrupava TODOS os Echoes anônimos numa
--    partição só: no Postgres, PARTITION BY com voice_id nulo junta todos os
--    NULL. Com voice_position <= 2, o Discovery inteiro mostrava no máximo
--    DOIS Echoes anônimos — justamente o conteúdo que é a tese do produto. Na
--    prévia pública, com posicao_da_voice = 1, mostrava no máximo UM.
--    COALESCE(voice_id, id) faz cada Echo anônimo ser a própria partição.
--    Mesmo raciocínio para category_id, que também é nulo com frequência.

CREATE OR REPLACE FUNCTION public.get_discovery_feed(p_limit integer DEFAULT 12, p_category_slug text DEFAULT NULL::text, p_exclude_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, public_identity text, voice_handle text, voice_display_name text, avatar_seed text, category_slug text, category_name text, title text, description text, transcription text, audio_url text, duration integer, expires_at timestamp with time zone, voice_protection_enabled boolean, voice_protection_preset text, reaction_counts jsonb, reply_count integer, created_at timestamp with time zone, next_cursor text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH candidate_events AS (
  SELECT
    e.echo_id,
    count(*) FILTER (WHERE e.event_type = 'impression') AS impressions,
    count(*) FILTER (WHERE e.event_type IN ('play_70', 'play_complete')) AS qualified_plays,
    count(*) FILTER (WHERE e.event_type = 'play_complete') AS completes,
    count(*) FILTER (WHERE e.event_type = 'skip') AS skips,
    count(*) FILTER (WHERE e.event_type = 'follow_voice') AS follows,
    count(*) FILTER (WHERE e.event_type = 'reply') AS replies,
    count(*) FILTER (WHERE e.event_type = 'report') AS reports
  FROM public.echo_events e
  GROUP BY e.echo_id
),
reaction_aggregate AS (
  SELECT echo_id, jsonb_object_agg(reaction_type, count) AS counts
  FROM (
    SELECT echo_id, reaction_type, count(*)::integer AS count
    FROM public.echo_reactions
    GROUP BY echo_id, reaction_type
  ) reactions
  GROUP BY echo_id
),
candidates AS (
  SELECT
    p.*, c.slug AS resolved_category_slug, c.name AS resolved_category_name,
    v.handle, v.display_name, v.avatar_seed,
    COALESCE(ce.impressions, 0) AS impressions,
    COALESCE(ce.qualified_plays, 0) AS qualified_plays,
    COALESCE(ce.completes, 0) AS completes,
    COALESCE(ce.skips, 0) AS skips,
    COALESCE(ce.follows, 0) AS follows,
    COALESCE(ce.replies, 0) AS tracked_replies,
    COALESCE(ce.reports, 0) AS reports,
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
    -- Teto defensivo: o cliente acumula o que já viu, mas a lista não cresce sem fim.
    AND p.id <> ALL (COALESCE(p_exclude_ids[1:300], ARRAY[]::uuid[]))
    AND (p_category_slug IS NULL OR c.slug = p_category_slug)
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_blocks b
      WHERE b.blocker_user_id = auth.uid()
        AND (b.blocked_user_id = p.owner_user_id OR (p.voice_id IS NOT NULL AND b.blocked_voice_id = p.voice_id))
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.echo_events seen
      WHERE seen.echo_id = p.id
        AND seen.user_id = auth.uid()
        AND seen.event_type = 'play_complete'
        AND seen.created_at > now() - interval '7 days'
    )
),
ranked AS (
  SELECT *,
    round((
      0.15 * greatest(0, 1 - extract(epoch FROM (now() - published_at)) / 604800.0)
      + 0.25 * CASE WHEN impressions = 0 THEN 0.5 ELSE qualified_plays::numeric / impressions END
      + 0.15 * (COALESCE((reactions->>'me_too')::numeric, 0) + COALESCE((reactions->>'with_you')::numeric, 0)) / greatest(impressions, 1)
      + 0.10 * tracked_replies::numeric / greatest(impressions, 1)
      + 0.20 * follows::numeric / greatest(impressions, 1)
      + 0.15 * CASE WHEN impressions < 100 THEN 1 ELSE 0 END
      - 0.20 * skips::numeric / greatest(impressions, 1)
      - 0.60 * reports::numeric / greatest(impressions, 1)
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
  resolved_category_slug,
  resolved_category_name,
  title,
  description,
  transcription,
  audio_url,
  duration,
  expires_at,
  voice_protection_enabled,
  voice_protection_preset,
  reactions,
  replies_count,
  created_at,
  format('%s|%s|%s', score, published_at, id) AS next_cursor
FROM ranked
ORDER BY score DESC, published_at DESC, id DESC
LIMIT least(greatest(p_limit, 1), 15);
$function$
;
CREATE OR REPLACE FUNCTION public.get_public_preview_feed(p_exclude_ids uuid[] DEFAULT NULL::uuid[], p_limit integer DEFAULT 3)
 RETURNS TABLE(id uuid, public_identity text, voice_handle text, voice_display_name text, avatar_seed text, category_slug text, category_name text, title text, description text, transcription text, audio_url text, duration integer, expires_at timestamp with time zone, voice_protection_enabled boolean, voice_protection_preset text, reaction_counts jsonb, reply_count integer, created_at timestamp with time zone, next_cursor text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH recentes AS (
  SELECT p.*, ROW_NUMBER() OVER (PARTITION BY COALESCE(p.voice_id, p.id) ORDER BY p.published_at DESC) AS posicao_da_voice
  FROM public.audio_posts p
  WHERE p.status = 'active'
    AND p.moderation_status = 'approved'
    AND p.visibility = 'public'
    AND p.storage_path IS NOT NULL
    AND (p.expires_at IS NULL OR p.expires_at > now())
    AND public.voice_is_public(p.voice_id)
    AND p.id <> ALL (COALESCE(p_exclude_ids[1:50], ARRAY[]::uuid[]))
  ORDER BY p.published_at DESC
  LIMIT 30
)
SELECT r.id,
       CASE WHEN r.identity_mode = 'anonymous' THEN 'Anônimo' ELSE COALESCE(v.display_name, 'Voice') END,
       CASE WHEN r.identity_mode = 'anonymous' THEN NULL ELSE v.handle END,
       CASE WHEN r.identity_mode = 'anonymous' THEN NULL ELSE v.display_name END,
       CASE WHEN r.identity_mode = 'anonymous' THEN NULL ELSE v.avatar_seed END,
       c.slug, c.name, r.title, r.description, r.transcription, r.audio_url, r.duration, r.expires_at,
       r.voice_protection_enabled, r.voice_protection_preset,
       COALESCE((
         SELECT jsonb_object_agg(reaction_type, reaction_count)
         FROM (
           SELECT reaction_type, count(*)::integer AS reaction_count
           FROM public.echo_reactions er WHERE er.echo_id = r.id GROUP BY reaction_type
         ) agrupadas
       ), '{}'::jsonb),
       r.replies_count, r.created_at, NULL::text
FROM recentes r
LEFT JOIN public.voices v ON v.id = r.voice_id
LEFT JOIN public.categories c ON c.id = r.category_id
WHERE r.posicao_da_voice = 1
ORDER BY r.published_at DESC
LIMIT least(greatest(p_limit, 1), 3);
$function$
;

-- 2) consume_rate_limit contava e só depois inseria, sem lock: duas requisições
--    simultâneas do mesmo usuário liam o mesmo total e passavam juntas. O lock
--    consultivo serializa por (usuário, ação) dentro da transação — é barato,
--    não toca em outras contas e morre com o COMMIT.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_user_id uuid, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  config public.rate_limits%ROWTYPE;
  recent integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO config FROM public.rate_limits WHERE action = p_action;
  -- Ação sem configuração não é bloqueada: um limite esquecido não pode
  -- derrubar um fluxo do produto. O que falta aparece na tabela, não no erro.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Serializa apenas este par (usuário, ação). Sem isto, N requisições
  -- simultâneas contavam o mesmo valor antes de qualquer INSERT e todas
  -- passavam — o limite virava "limite + concorrência".
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_action, 0));

  SELECT count(*) INTO recent
  FROM public.rate_limit_hits h
  WHERE h.user_id = p_user_id
    AND h.action = p_action
    AND h.created_at > now() - make_interval(secs => config.window_seconds);

  IF recent >= config.max_hits THEN
    RAISE EXCEPTION 'Limite de % por % minutos atingido para esta ação. Tente mais tarde.',
      config.max_hits, greatest(config.window_seconds / 60, 1)
      USING ERRCODE = 'PT429';
  END IF;

  INSERT INTO public.rate_limit_hits (user_id, action) VALUES (p_user_id, p_action);

  -- Faxina oportunista: sem isto a tabela cresce para sempre. Roda em ~1% das
  -- chamadas, o que basta e não exige cron novo.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit_hits WHERE created_at < now() - interval '2 days';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(uuid, text) TO service_role;
