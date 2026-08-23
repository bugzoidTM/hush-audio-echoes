-- shhhh 2.0 — correção de autorização e moderação antes do beta aberto.
--
-- Três problemas P0 tratados aqui:
--   1. audio_posts aceitava UPDATE da linha inteira pelo dono (PATCH direto no
--      PostgREST trocava moderation_status, visibility, voice_id, audio_url...).
--   2. community_members aceitava INSERT com qualquer role e em qualquer
--      Community (private/invite_only inclusive): escalonamento de privilégio.
--   3. A moderação automática lia a transcrição enviada pelo cliente, então
--      bastava não enviar transcrição para publicar sem análise alguma.
--
-- Além disso: cursor estável no Discovery, transcrição real no payload público
-- e thread de respostas.

-- ---------------------------------------------------------------------------
-- 0. Feature flags viram gate de verdade, inclusive no banco.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.feature_enabled(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT enabled FROM public.feature_flags WHERE key = p_key), false);
$$;
REVOKE ALL ON FUNCTION public.feature_enabled(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feature_enabled(text) TO anon, authenticated, service_role;

-- Communities ficam congeladas: o contêiner existe antes do comportamento
-- (publicar um Echo dentro da Community ainda não existe) e a RLS só agora
-- está correta. Reabrir = UPDATE nesta flag, sem migração nova.
UPDATE public.feature_flags SET enabled = false, updated_at = now() WHERE key = 'COMMUNITIES_ENABLED';

INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('SERVER_MODERATION_ENABLED', true, 'Exige transcrição e classificação server-side antes de aprovar um Echo.')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1. P0 — audio_posts deixa de aceitar UPDATE direto.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Owners can update their own Echoes" ON public.audio_posts;
-- DELETE direto também sai: apagar a linha deixava o áudio órfão no bucket
-- (o cleanup só encontra storage_path pela linha). Passa por delete_echo().
DROP POLICY IF EXISTS "Owners can delete their own Echoes" ON public.audio_posts;

REVOKE INSERT, UPDATE, DELETE ON public.audio_posts FROM anon, authenticated;

-- Colunas de moderação: a transcrição do cliente é sinal de UX, nunca de
-- confiança; a coluna transcription passa a ser exclusivamente server-side.
ALTER TABLE public.audio_posts
  ADD COLUMN IF NOT EXISTS client_transcription text,
  ADD COLUMN IF NOT EXISTS moderation_source text,
  ADD COLUMN IF NOT EXISTS moderation_note text,
  ADD COLUMN IF NOT EXISTS moderation_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz;

ALTER TABLE public.audio_posts
  DROP CONSTRAINT IF EXISTS audio_posts_moderation_source_check,
  ADD CONSTRAINT audio_posts_moderation_source_check CHECK (
    moderation_source IS NULL OR moderation_source IN ('server_stt', 'human', 'legacy_client')
  ) NOT VALID;

-- Fail closed: quem publica entra em 'pending' e só o worker server-side aprova.
ALTER TABLE public.audio_posts ALTER COLUMN moderation_status SET DEFAULT 'pending';

-- O que existe hoje foi aprovado com transcrição do cliente (ou sem nenhuma):
-- o texto vira client_transcription e a linha volta para a fila server-side.
UPDATE public.audio_posts
SET client_transcription = COALESCE(client_transcription, transcription),
    transcription = NULL,
    moderation_source = 'legacy_client',
    moderation_status = 'pending',
    moderation_attempts = 0
WHERE moderation_source IS NULL
  AND status = 'active'
  AND moderation_status = 'approved';

CREATE INDEX IF NOT EXISTS audio_posts_moderation_queue_idx
  ON public.audio_posts (published_at)
  WHERE moderation_status = 'pending' AND status = 'active';

COMMENT ON COLUMN public.audio_posts.transcription IS
  'Transcrição gerada no servidor a partir do áudio publicado. Única fonte confiável para moderação.';
COMMENT ON COLUMN public.audio_posts.client_transcription IS
  'Texto enviado pelo navegador. Serve para UX durante a gravação e NUNCA para decisão de moderação.';

-- Operações seguras do dono, campo a campo.
CREATE OR REPLACE FUNCTION public.update_echo_metadata(
  p_echo_id uuid,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated_id uuid;
BEGIN
  IF p_category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.categories WHERE id = p_category_id) THEN
    RAISE EXCEPTION 'Categoria inexistente.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.audio_posts p
  SET title = NULLIF(left(COALESCE(p_title, p.title), 140), ''),
      description = NULLIF(left(COALESCE(p_description, p.description), 500), ''),
      category_id = COALESCE(p_category_id, p.category_id),
      updated_at = now()
  WHERE p.id = p_echo_id
    AND p.owner_user_id = auth.uid()
    AND p.status = 'active'
  RETURNING p.id INTO updated_id;

  IF updated_id IS NULL THEN
    RAISE EXCEPTION 'Echo não encontrado para esta conta.' USING ERRCODE = '42501';
  END IF;
  RETURN updated_id;
END;
$$;

-- Apagar é soft delete + expiração imediata: o cron de limpeza remove o objeto
-- do bucket na passada seguinte, em vez de deixar mídia órfã.
CREATE OR REPLACE FUNCTION public.delete_echo(p_echo_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_id uuid;
BEGIN
  UPDATE public.audio_posts p
  SET status = 'deleted',
      visibility = 'unlisted',
      expires_at = now(),
      updated_at = now()
  WHERE p.id = p_echo_id
    AND p.owner_user_id = auth.uid()
    AND p.status <> 'deleted'
  RETURNING p.id INTO deleted_id;

  IF deleted_id IS NULL THEN
    RAISE EXCEPTION 'Echo não encontrado para esta conta.' USING ERRCODE = '42501';
  END IF;
  RETURN deleted_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_echo_metadata(uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_echo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_echo_metadata(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_echo(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. P0 — moderação server-side, com a transcrição feita a partir do áudio.
-- ---------------------------------------------------------------------------

-- unaccent está fora do pacote self-hosted padrão; esta versão cobre o
-- português sem depender de extensão adicional.
CREATE OR REPLACE FUNCTION public.unaccent_simple(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
    p_text,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  );
$$;

CREATE OR REPLACE FUNCTION public.classify_transcription(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE normalized text;
BEGIN
  -- Sem texto não existe análise: fila humana, nunca aprovação automática.
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN 'review_required';
  END IF;

  normalized := lower(public.unaccent_simple(p_text));

  IF normalized ~ '(exploracao sexual infantil|conteudo sexual com menor|pornografia infantil|estupro de vulneravel|como fabricar (uma )?bomba|fabricar explosivo)' THEN
    RETURN 'rejected';
  END IF;

  IF normalized ~ '(vou te matar|vou matar voce|vou acabar com a sua vida|te encontrar e te matar)' THEN
    RETURN 'rejected';
  END IF;

  -- Dado pessoal identificável (doxxing) e risco à vida vão para revisão
  -- humana; o Echo fica invisível no Discovery até alguém decidir.
  IF normalized ~ '(\m\d{3}\.?\d{3}\.?\d{3}-?\d{2}\M|\m\d{2}\s?9?\d{4}-?\d{4}\M)' THEN
    RETURN 'review_required';
  END IF;

  IF normalized ~ '(meu cpf e|o cpf dele|o cpf dela|numero do cartao|meu endereco e|mora na rua|numero do meu telefone|nome completo dele e|nome completo dela e)' THEN
    RETURN 'review_required';
  END IF;

  IF normalized ~ '(me matar|suicidio|tirar minha vida|me cortar|acabar com tudo hoje|nao quero mais viver)' THEN
    RETURN 'review_required';
  END IF;

  IF normalized ~ '(assedio sexual|estupro|abuso sexual|aliciamento|ameaca de morte)' THEN
    RETURN 'review_required';
  END IF;

  RETURN 'approved';
END;
$$;

-- Aplicada pelo worker (service_role). Nunca aprova sem texto vindo do áudio.
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

  decision := public.classify_transcription(p_transcription);

  UPDATE public.audio_posts
  SET transcription = left(p_transcription, 10000),
      moderation_status = decision,
      moderation_source = p_source,
      moderated_at = now(),
      moderation_note = NULL
  WHERE id = p_echo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Echo inexistente.' USING ERRCODE = '42704';
  END IF;
  RETURN decision;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_moderation_queue(p_limit integer DEFAULT 5)
RETURNS TABLE (id uuid, storage_path text, duration integer, moderation_attempts integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.storage_path, p.duration, p.moderation_attempts
  FROM public.audio_posts p
  WHERE p.moderation_status = 'pending'
    AND p.status = 'active'
    AND p.storage_path IS NOT NULL
  ORDER BY p.moderation_attempts ASC, p.published_at ASC
  LIMIT least(greatest(p_limit, 1), 25);
$$;

REVOKE ALL ON FUNCTION public.apply_server_moderation(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_moderation_queue(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.classify_transcription(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_server_moderation(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_moderation_queue(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.classify_transcription(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. P0 — Communities: fim do escalonamento de privilégio.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Members join free communities" ON public.community_members;
DROP POLICY IF EXISTS "Creators add community members" ON public.community_members;
DROP POLICY IF EXISTS "Voice owners can create communities" ON public.communities;
DROP POLICY IF EXISTS "Community admins can update communities" ON public.communities;

-- Entrar por conta própria: só como member, só em Community pública, ativa,
-- gratuita, e só enquanto a feature estiver ligada.
CREATE POLICY "Members join open communities" ON public.community_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND status = 'active'
    AND public.feature_enabled('COMMUNITIES_ENABLED')
    AND EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_id
        AND c.status = 'active'
        AND c.visibility = 'public'
        AND c.access_type = 'free'
    )
  );

-- Quem administra pode convidar/incluir, mas nunca criar outro creator.
CREATE POLICY "Community admins add members" ON public.community_members FOR INSERT TO authenticated
  WITH CHECK (
    role IN ('member', 'admin')
    AND status IN ('active', 'invited')
    AND public.feature_enabled('COMMUNITIES_ENABLED')
    AND EXISTS (
      SELECT 1
      FROM public.community_members manager
      JOIN public.communities c ON c.id = manager.community_id
      WHERE manager.community_id = community_members.community_id
        AND manager.user_id = auth.uid()
        AND manager.role IN ('creator', 'admin')
        AND manager.status = 'active'
        AND c.status = 'active'
    )
  );

-- Sair da Community. Administração remove membros; ninguém remove o creator.
CREATE POLICY "Members leave communities" ON public.community_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND role <> 'creator');

CREATE POLICY "Community admins remove members" ON public.community_members FOR DELETE TO authenticated
  USING (
    role = 'member'
    AND EXISTS (
      SELECT 1 FROM public.community_members manager
      WHERE manager.community_id = community_members.community_id
        AND manager.user_id = auth.uid()
        AND manager.role IN ('creator', 'admin')
        AND manager.status = 'active'
    )
  );

-- Sem política de UPDATE: promoção de papel não passa pela API pública.

CREATE POLICY "Voice owners create communities" ON public.communities FOR INSERT TO authenticated
  WITH CHECK (
    public.feature_enabled('COMMUNITIES_ENABLED')
    AND status = 'active'
    AND access_type IN ('free', 'invite_only')
    AND EXISTS (SELECT 1 FROM public.voices v WHERE v.id = owner_voice_id AND v.owner_user_id = auth.uid() AND v.status = 'active')
  );

CREATE POLICY "Community owners update communities" ON public.communities FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.voices v WHERE v.id = owner_voice_id AND v.owner_user_id = auth.uid()))
  WITH CHECK (
    status IN ('active', 'suspended')
    AND access_type IN ('free', 'invite_only')
    AND EXISTS (SELECT 1 FROM public.voices v WHERE v.id = owner_voice_id AND v.owner_user_id = auth.uid())
  );

-- owner_voice_id não muda de dono por UPDATE.
CREATE OR REPLACE FUNCTION public.freeze_community_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_voice_id <> OLD.owner_voice_id THEN
    RAISE EXCEPTION 'A Voice proprietária de uma Community não pode ser trocada.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS communities_freeze_owner ON public.communities;
CREATE TRIGGER communities_freeze_owner BEFORE UPDATE ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.freeze_community_owner();

-- Leitura também respeita a flag: com Communities congeladas, as RPCs não
-- devolvem nada mesmo que a rota do front escape.
CREATE OR REPLACE FUNCTION public.get_community_feed(p_slug text)
RETURNS TABLE (
  id uuid,
  public_identity text,
  voice_handle text,
  voice_display_name text,
  avatar_seed text,
  category_name text,
  title text,
  description text,
  audio_url text,
  duration integer,
  expires_at timestamptz,
  created_at timestamptz
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
       cat.name, p.title, p.description, p.audio_url, p.duration, p.expires_at, p.created_at
FROM public.audio_posts p
JOIN public.communities c ON c.id = p.community_id
LEFT JOIN public.voices v ON v.id = p.voice_id
LEFT JOIN public.categories cat ON cat.id = p.category_id
LEFT JOIN public.community_members cm ON cm.community_id = c.id AND cm.user_id = auth.uid() AND cm.status = 'active'
WHERE public.feature_enabled('COMMUNITIES_ENABLED')
  AND c.slug = p_slug
  AND c.status = 'active'
  AND (c.visibility = 'public' OR cm.user_id IS NOT NULL)
  AND p.status = 'active'
  AND p.moderation_status = 'approved'
  AND (p.expires_at IS NULL OR p.expires_at > now())
ORDER BY p.created_at DESC;
$$;

-- ---------------------------------------------------------------------------
-- 4. Discovery: paginação estável e transcrição no payload público.
-- ---------------------------------------------------------------------------

-- O cursor por published_at era instável sob ORDER BY score: com o ranking
-- mudando entre requisições, Echoes eram pulados ou repetidos. A paginação
-- passa a ser por conjunto já servido (p_exclude_ids): cada página é o topo do
-- ranking do que sobrou, então não existe duplicata nem salto por construção.
-- As janelas de diversidade (2 por Voice, 5 por categoria) também passam a ser
-- calculadas sobre o que sobrou, e não sobre o catálogo inteiro — sem isso o
-- feed acabava em ~12 Echoes.
DROP FUNCTION IF EXISTS public.get_discovery_feed(timestamptz, integer, text);

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
  -- Só a transcrição feita no servidor, e só depois de aprovada.
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

-- get_public_echo passa a devolver a transcrição server-side.
DROP FUNCTION IF EXISTS public.get_public_echo(uuid);
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
  AND p.moderation_status = 'approved'
  AND p.visibility = 'public'
  AND (p.expires_at IS NULL OR p.expires_at > now());
$$;
REVOKE ALL ON FUNCTION public.get_public_echo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_echo(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Thread de respostas: publicar já existia, ver a conversa não.
-- ---------------------------------------------------------------------------

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
-- 6. Estado da própria publicação: o autor precisa saber que está em análise.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_echo_status(p_echo_id uuid)
RETURNS TABLE (id uuid, moderation_status text, moderated_at timestamptz, published_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.id, p.moderation_status, p.moderated_at, p.published_at
  FROM public.audio_posts p
  WHERE p.id = p_echo_id AND p.owner_user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_echo_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_echo_status(uuid) TO authenticated;
