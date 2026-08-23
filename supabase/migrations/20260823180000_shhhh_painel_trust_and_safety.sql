-- Painel de Trust & Safety: fila de revisão, decisão humana e suspensões.
--
-- Até aqui a moderação automática mandava Echoes para 'review_required' e não
-- havia tela nenhuma para decidir: a fila só era acessível por SQL à mão. Este
-- é o outro lado da moderação server-side — sem ele, tudo que o worker não
-- aprova fica invisível para sempre.

-- ---------------------------------------------------------------------------
-- 1. Quem é moderador
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  );
$$;
REVOKE ALL ON FUNCTION public.is_moderator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_moderator() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Fila de revisão
-- ---------------------------------------------------------------------------

-- O payload da fila é o oposto do payload público: o moderador precisa da
-- transcrição, do texto que o cliente mandou (para comparar) e de quem
-- publicou — é com isso que se decide suspender Voice ou conta. Por isso a
-- função exige papel de moderação e nada aqui é exposto a `anon`.
CREATE OR REPLACE FUNCTION public.get_review_queue(
  p_scope text DEFAULT 'all',
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  moderation_status text,
  moderation_source text,
  moderation_note text,
  moderation_attempts integer,
  moderated_at timestamptz,
  published_at timestamptz,
  title text,
  description text,
  category_name text,
  transcription text,
  client_transcription text,
  audio_url text,
  duration integer,
  identity_mode text,
  owner_user_id uuid,
  voice_id uuid,
  voice_handle text,
  voice_display_name text,
  voice_status text,
  open_reports integer,
  report_reasons text[]
)
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
  WITH report_counts AS (
    SELECT r.audio_id,
           count(*)::integer AS pending_reports,
           array_agg(DISTINCT r.reason) AS reasons
    FROM public.reports r
    WHERE r.status = 'pending'
    GROUP BY r.audio_id
  )
  SELECT
    p.id, p.moderation_status, p.moderation_source, p.moderation_note,
    p.moderation_attempts, p.moderated_at, p.published_at,
    p.title, p.description, c.name,
    p.transcription, p.client_transcription,
    p.audio_url, p.duration, p.identity_mode,
    p.owner_user_id, p.voice_id, v.handle, v.display_name, v.status,
    COALESCE(rc.pending_reports, 0), COALESCE(rc.reasons, ARRAY[]::text[])
  FROM public.audio_posts p
  LEFT JOIN public.categories c ON c.id = p.category_id
  LEFT JOIN public.voices v ON v.id = p.voice_id
  LEFT JOIN report_counts rc ON rc.audio_id = p.id
  WHERE p.status = 'active'
    AND CASE p_scope
      -- 'moderation': o que a análise automática não liberou. Inclui os presos
      -- em 'pending' há mais de 30 min, que é sintoma de worker parado.
      WHEN 'moderation' THEN p.moderation_status = 'review_required'
        OR (p.moderation_status = 'pending' AND p.published_at < now() - interval '30 minutes')
      WHEN 'reports' THEN rc.pending_reports IS NOT NULL
      ELSE p.moderation_status IN ('review_required', 'limited')
        OR (p.moderation_status = 'pending' AND p.published_at < now() - interval '30 minutes')
        OR rc.pending_reports IS NOT NULL
    END
  ORDER BY COALESCE(rc.pending_reports, 0) DESC, p.published_at ASC
  LIMIT least(greatest(p_limit, 1), 200);
END;
$$;
REVOKE ALL ON FUNCTION public.get_review_queue(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_review_queue(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_moderation_stats()
RETURNS TABLE (
  pending integer,
  stuck_pending integer,
  review_required integer,
  limited integer,
  open_reports integer,
  approved_active integer
)
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
  SELECT
    count(*) FILTER (WHERE p.moderation_status = 'pending')::integer,
    count(*) FILTER (WHERE p.moderation_status = 'pending' AND p.published_at < now() - interval '30 minutes')::integer,
    count(*) FILTER (WHERE p.moderation_status = 'review_required')::integer,
    count(*) FILTER (WHERE p.moderation_status = 'limited')::integer,
    (SELECT count(*) FROM public.reports WHERE status = 'pending')::integer,
    count(*) FILTER (WHERE p.moderation_status = 'approved')::integer
  FROM public.audio_posts p
  WHERE p.status = 'active';
END;
$$;
REVOKE ALL ON FUNCTION public.get_moderation_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_moderation_stats() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Decisão humana
-- ---------------------------------------------------------------------------

-- 'limited' = alcance limitado: sai do Discovery, mas o link direto continua
-- valendo. 'rejected' tira do ar e expira a mídia na próxima limpeza.
CREATE OR REPLACE FUNCTION public.review_echo(
  p_echo_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE affected uuid;
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Permissão de moderação obrigatória.' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved', 'limited', 'rejected', 'review_required') THEN
    RAISE EXCEPTION 'Decisão inválida.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.audio_posts p
  SET moderation_status = p_decision,
      moderation_source = 'human',
      moderated_at = now(),
      moderation_note = NULLIF(left(COALESCE(p_note, ''), 500), ''),
      visibility = CASE
        WHEN p_decision IN ('limited', 'rejected') THEN 'unlisted'
        WHEN p_decision = 'approved' AND p.community_id IS NULL THEN 'public'
        ELSE p.visibility END,
      status = CASE WHEN p_decision = 'rejected' THEN 'deleted' ELSE p.status END,
      expires_at = CASE WHEN p_decision = 'rejected' THEN now() ELSE p.expires_at END,
      updated_at = now()
  WHERE p.id = p_echo_id
  RETURNING p.id INTO affected;

  IF affected IS NULL THEN
    RAISE EXCEPTION 'Echo inexistente.' USING ERRCODE = '42704';
  END IF;

  -- A denúncia não fica aberta depois da decisão: aprovar arquiva como
  -- improcedente, qualquer outra decisão resolve.
  UPDATE public.reports
  SET status = (CASE WHEN p_decision = 'approved' THEN 'dismissed' ELSE 'resolved' END)::report_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      resolution_note = NULLIF(left(COALESCE(p_note, ''), 500), '')
  WHERE audio_id = p_echo_id AND status = 'pending';

  RETURN p_decision;
END;
$$;
REVOKE ALL ON FUNCTION public.review_echo(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_echo(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.dismiss_echo_reports(p_echo_id uuid, p_note text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE affected integer;
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Permissão de moderação obrigatória.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.reports
  SET status = 'dismissed'::report_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      resolution_note = NULLIF(left(COALESCE(p_note, ''), 500), '')
  WHERE audio_id = p_echo_id AND status = 'pending';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION public.dismiss_echo_reports(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_echo_reports(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Suspender Voice
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_voice_status(p_voice_id uuid, p_status text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE affected uuid;
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Permissão de moderação obrigatória.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'Status de Voice inválido.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.voices SET status = p_status, updated_at = now()
  WHERE id = p_voice_id AND status <> 'deleted'
  RETURNING id INTO affected;

  IF affected IS NULL THEN
    RAISE EXCEPTION 'Voice inexistente.' USING ERRCODE = '42704';
  END IF;
  RETURN p_status;
END;
$$;
REVOKE ALL ON FUNCTION public.set_voice_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_voice_status(uuid, text) TO authenticated;

-- Suspender a Voice tem de tirar os Echoes dela do ar. Antes, o Discovery
-- fazia LEFT JOIN em voices com status='active': a Voice suspensa perdia o
-- nome, e o Echo continuava no feed como "Voice".
CREATE OR REPLACE FUNCTION public.voice_is_public(p_voice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_voice_id IS NULL
     OR EXISTS (SELECT 1 FROM public.voices v WHERE v.id = p_voice_id AND v.status = 'active');
$$;
REVOKE ALL ON FUNCTION public.voice_is_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.voice_is_public(uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Suspensão de conta (a parte que vive no banco)
-- ---------------------------------------------------------------------------

-- O bloqueio de login é feito pela Edge Function `suspend-account`, que fala
-- com o GoTrue com a service_role. Aqui fica o efeito no conteúdo: as Voices
-- saem do ar e os Echoes ativos deixam o Discovery sem serem apagados — a
-- decisão sobre cada Echo continua com o moderador.
CREATE OR REPLACE FUNCTION public.apply_account_suspension(
  p_user_id uuid,
  p_suspended boolean,
  p_note text DEFAULT NULL
)
RETURNS TABLE (voices_afetadas integer, echoes_afetados integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  voices_count integer;
  echoes_count integer;
BEGIN
  IF NOT (public.is_moderator() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Permissão de moderação obrigatória.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.voices
  SET status = CASE WHEN p_suspended THEN 'suspended' ELSE 'active' END, updated_at = now()
  WHERE owner_user_id = p_user_id AND status <> 'deleted';
  GET DIAGNOSTICS voices_count = ROW_COUNT;

  -- Suspender manda o conteúdo para 'review_required', não para 'limited':
  -- 'limited' continuaria acessível por link direto, o que contradiz tirar a
  -- conta do ar. Reativar não republica em massa — cada Echo volta pela fila,
  -- decidido um a um. Fail closed também aqui.
  IF p_suspended THEN
    UPDATE public.audio_posts
    SET moderation_status = 'review_required',
        visibility = 'unlisted',
        moderation_source = 'human',
        moderated_at = now(),
        moderation_note = NULLIF(left(COALESCE(p_note, ''), 500), ''),
        updated_at = now()
    WHERE owner_user_id = p_user_id
      AND status = 'active'
      AND moderation_status <> 'rejected';
    GET DIAGNOSTICS echoes_count = ROW_COUNT;
  ELSE
    echoes_count := 0;
  END IF;

  RETURN QUERY SELECT voices_count, echoes_count;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_account_suspension(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_account_suspension(uuid, boolean, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Leitura pública passa a respeitar Voice suspensa e alcance limitado
-- ---------------------------------------------------------------------------

-- Antes, o Discovery fazia LEFT JOIN em voices com status='active': suspender
-- a Voice apagava o nome dela do card, mas o Echo seguia no feed como "Voice".
CREATE OR REPLACE FUNCTION public.get_discovery_feed(
  p_limit integer DEFAULT 12,
  p_category_slug text DEFAULT NULL,
  p_exclude_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  public_identity text,
  voice_handle text,
  voice_display_name text,
  avatar_seed text,
  category_slug text,
  category_name text,
  title text,
  description text,
  transcription text,
  audio_url text,
  duration integer,
  expires_at timestamptz,
  voice_protection_enabled boolean,
  voice_protection_preset text,
  reaction_counts jsonb,
  reply_count integer,
  created_at timestamptz,
  next_cursor text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    ROW_NUMBER() OVER (PARTITION BY p.voice_id ORDER BY p.published_at DESC) AS voice_position,
    ROW_NUMBER() OVER (PARTITION BY p.category_id ORDER BY p.published_at DESC) AS category_position
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
$$;
REVOKE ALL ON FUNCTION public.get_discovery_feed(integer, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_discovery_feed(integer, text, uuid[]) TO authenticated, service_role;

-- 'limited' continua acessível por link direto (é o sentido de alcance
-- limitado), mas some do Discovery. Voice suspensa some dos dois.
CREATE OR REPLACE FUNCTION public.get_public_echo(p_echo_id uuid)
RETURNS TABLE (
  id uuid,
  public_identity text,
  voice_handle text,
  voice_display_name text,
  avatar_seed text,
  category_slug text,
  category_name text,
  title text,
  description text,
  transcription text,
  audio_url text,
  duration integer,
  expires_at timestamptz,
  voice_protection_enabled boolean,
  voice_protection_preset text,
  reaction_counts jsonb,
  reply_count integer,
  created_at timestamptz,
  next_cursor text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT p.id,
       CASE WHEN p.identity_mode = 'anonymous' THEN 'Anônimo' ELSE v.display_name END,
       CASE WHEN p.identity_mode = 'anonymous' THEN NULL ELSE v.handle END,
       CASE WHEN p.identity_mode = 'anonymous' THEN NULL ELSE v.display_name END,
       CASE WHEN p.identity_mode = 'anonymous' THEN NULL ELSE v.avatar_seed END,
       c.slug, c.name, p.title, p.description, p.transcription, p.audio_url, p.duration, p.expires_at,
       p.voice_protection_enabled, p.voice_protection_preset,
       COALESCE((
         SELECT jsonb_object_agg(reaction_type, reaction_count)
         FROM (
           SELECT reaction_type, count(*)::integer AS reaction_count
           FROM public.echo_reactions r WHERE r.echo_id = p.id GROUP BY reaction_type
         ) grouped_reactions
       ), '{}'::jsonb),
       p.replies_count, p.created_at, NULL::text
FROM public.audio_posts p
LEFT JOIN public.voices v ON v.id = p.voice_id
LEFT JOIN public.categories c ON c.id = p.category_id
WHERE p.id = p_echo_id
  AND p.status = 'active'
  AND p.moderation_status IN ('approved', 'limited')
  AND p.visibility IN ('public', 'unlisted')
  AND public.voice_is_public(p.voice_id)
  AND (p.expires_at IS NULL OR p.expires_at > now());
$$;
REVOKE ALL ON FUNCTION public.get_public_echo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_echo(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_echo_replies(p_echo_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  public_identity text,
  voice_handle text,
  voice_display_name text,
  avatar_seed text,
  category_slug text,
  category_name text,
  title text,
  description text,
  transcription text,
  audio_url text,
  duration integer,
  expires_at timestamptz,
  voice_protection_enabled boolean,
  voice_protection_preset text,
  reaction_counts jsonb,
  reply_count integer,
  created_at timestamptz,
  next_cursor text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT p.id,
       CASE WHEN p.identity_mode = 'anonymous' THEN 'Anônimo' ELSE COALESCE(v.display_name, 'Voice') END,
       CASE WHEN p.identity_mode = 'anonymous' THEN NULL ELSE v.handle END,
       CASE WHEN p.identity_mode = 'anonymous' THEN NULL ELSE v.display_name END,
       CASE WHEN p.identity_mode = 'anonymous' THEN NULL ELSE v.avatar_seed END,
       c.slug, c.name, p.title, p.description, p.transcription, p.audio_url, p.duration, p.expires_at,
       p.voice_protection_enabled, p.voice_protection_preset,
       COALESCE((
         SELECT jsonb_object_agg(reaction_type, reaction_count)
         FROM (
           SELECT reaction_type, count(*)::integer AS reaction_count
           FROM public.echo_reactions r WHERE r.echo_id = p.id GROUP BY reaction_type
         ) grouped_reactions
       ), '{}'::jsonb),
       p.replies_count, p.created_at, NULL::text
FROM public.audio_replies ar
JOIN public.audio_posts p ON p.id = ar.reply_audio_id
LEFT JOIN public.voices v ON v.id = p.voice_id
LEFT JOIN public.categories c ON c.id = p.category_id
WHERE ar.parent_audio_id = p_echo_id
  AND p.status = 'active'
  AND p.moderation_status = 'approved'
  AND p.visibility = 'public'
  AND public.voice_is_public(p.voice_id)
  AND (p.expires_at IS NULL OR p.expires_at > now())
  AND NOT EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE b.blocker_user_id = auth.uid()
      AND (b.blocked_user_id = p.owner_user_id OR (p.voice_id IS NOT NULL AND b.blocked_voice_id = p.voice_id))
  )
ORDER BY p.created_at ASC
LIMIT least(greatest(p_limit, 1), 100);
$$;
REVOKE ALL ON FUNCTION public.get_echo_replies(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_echo_replies(uuid, integer) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Denunciar volta a funcionar
-- ---------------------------------------------------------------------------

-- `reports` tinha RLS ligada e NENHUMA policy: todo INSERT era recusado com
-- "new row violates row-level security policy". Ou seja, o botão Denunciar
-- nunca funcionou — e, com ele, morreram o -0.60 por denúncia no ranking e a
-- própria fila de denúncias do painel. A tabela também dava UPDATE/DELETE/
-- TRUNCATE a anon e authenticated, o que só era inofensivo porque nada passava.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.reports FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.reports FROM authenticated;

-- A checagem do Echo precisa ser SECURITY DEFINER: dentro de uma policy o
-- subselect roda com a RLS de quem denuncia, e a única policy de leitura de
-- audio_posts é a do dono. Consultar direto ali daria sempre falso — ninguém
-- consegue denunciar Echo alheio, que é exatamente o caso de uso.
CREATE OR REPLACE FUNCTION public.echo_is_reportable(p_echo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.audio_posts p WHERE p.id = p_echo_id AND p.status = 'active');
$$;
REVOKE ALL ON FUNCTION public.echo_is_reportable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.echo_is_reportable(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users report echoes" ON public.reports;
CREATE POLICY "Users report echoes" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND public.echo_is_reportable(audio_id)
  );

-- Quem denuncia acompanha a própria denúncia; a moderação vê todas.
DROP POLICY IF EXISTS "Reporters read their reports" ON public.reports;
CREATE POLICY "Reporters read their reports" ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_moderator());

-- Sem política de UPDATE/DELETE: resolver denúncia passa por review_echo() e
-- dismiss_echo_reports(), que exigem papel de moderação.

-- Uma denúncia por pessoa por Echo: denunciar em série inflava o -0.60 do
-- ranking e enchia a fila com a mesma reclamação.
CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_reporter_per_echo
  ON public.reports (audio_id, reporter_id);
