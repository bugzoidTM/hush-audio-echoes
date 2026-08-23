-- Prévia pública: ouvir antes de criar conta.
--
-- Decisão de produto: Echo compartilhado por link toca sem cadastro (é o
-- mecanismo viral do produto — o conteúdo vende o produto); Discovery infinito,
-- interações, seguir e publicar exigem conta. O que faltava para isso ser
-- verdade, e não só aparência de tela:

-- ---------------------------------------------------------------------------
-- 1. O Discovery infinito passa a exigir conta DE VERDADE
-- ---------------------------------------------------------------------------

-- A Edge Function `discovery-feed` respondia 401 sem sessão, mas `anon` tinha
-- EXECUTE na RPC — e a chave anon vai dentro do bundle. Qualquer visitante
-- chamava `get_discovery_feed` direto no PostgREST e tinha o feed inteiro. O
-- gate estava só na interface, exatamente o que não se pode fazer.
REVOKE EXECUTE ON FUNCTION public.get_discovery_feed(integer, text, uuid[]) FROM anon;

-- ---------------------------------------------------------------------------
-- 2. Prévia pública, pequena e limitada por construção
-- ---------------------------------------------------------------------------

-- Diferente do Discovery: sem ranking personalizado, sem categoria, sem
-- paginação infinita. Serve no máximo 3 por chamada, e só a partir dos 30
-- Echoes mais recentes — assim a prévia não vira uma porta para varrer o
-- catálogo inteiro sem conta.
--
-- Isto é funil, não fronteira de segurança: o bucket `echo-audio` é público por
-- decisão de produto (link compartilhado tem de tocar), então quem insistir
-- ouve mais do que 3. O objetivo é converter, não trancar.
CREATE OR REPLACE FUNCTION public.get_public_preview_feed(
  p_exclude_ids uuid[] DEFAULT NULL,
  p_limit integer DEFAULT 3
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
WITH recentes AS (
  SELECT p.*, ROW_NUMBER() OVER (PARTITION BY p.voice_id ORDER BY p.published_at DESC) AS posicao_da_voice
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
$$;
REVOKE ALL ON FUNCTION public.get_public_preview_feed(uuid[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_preview_feed(uuid[], integer) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. A Voice decide se aparece fora do shhhh
-- ---------------------------------------------------------------------------

-- Público ≠ indexado. A página da Voice é pseudônima e pode ser compartilhada,
-- mas só entra em buscador se o dono pedir. Padrão: não.
ALTER TABLE public.voices
  ADD COLUMN IF NOT EXISTS indexable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.voices.indexable IS
  'Permite que a página pública da Voice seja indexada por buscadores. Padrão falso: público não significa indexado.';

DROP FUNCTION IF EXISTS public.get_public_voice(text);
CREATE OR REPLACE FUNCTION public.get_public_voice(p_handle text)
RETURNS TABLE (
  id uuid,
  handle text,
  display_name text,
  bio text,
  avatar_seed text,
  avatar_url text,
  status text,
  indexable boolean,
  active_echo_count bigint,
  permanent_echo_count bigint,
  community_slug text,
  community_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT v.id, v.handle, v.display_name, v.bio, v.avatar_seed, v.avatar_url, v.status, v.indexable,
       (SELECT count(*) FROM public.audio_posts p
         WHERE p.voice_id = v.id AND p.status = 'active' AND p.moderation_status = 'approved'
           AND p.visibility = 'public' AND (p.expires_at IS NULL OR p.expires_at > now())),
       (SELECT count(*) FROM public.audio_posts p
         WHERE p.voice_id = v.id AND p.status = 'active' AND p.moderation_status = 'approved'
           AND p.visibility = 'public' AND p.expires_at IS NULL),
       c.slug, c.name
FROM public.voices v
LEFT JOIN public.communities c ON c.owner_voice_id = v.id AND c.status = 'active' AND public.feature_enabled('COMMUNITIES_ENABLED')
WHERE v.handle = p_handle AND v.status = 'active';
$$;
REVOKE ALL ON FUNCTION public.get_public_voice(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_voice(text) TO anon, authenticated;

-- O dono muda a própria escolha; ninguém muda a de outro.
CREATE OR REPLACE FUNCTION public.set_voice_indexable(p_voice_id uuid, p_indexable boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE afetada uuid;
BEGIN
  UPDATE public.voices SET indexable = p_indexable, updated_at = now()
  WHERE id = p_voice_id AND owner_user_id = auth.uid() AND status = 'active'
  RETURNING id INTO afetada;
  IF afetada IS NULL THEN
    RAISE EXCEPTION 'Voice não encontrada para esta conta.' USING ERRCODE = '42501';
  END IF;
  RETURN p_indexable;
END;
$$;
REVOKE ALL ON FUNCTION public.set_voice_indexable(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_voice_indexable(uuid, boolean) TO authenticated;
