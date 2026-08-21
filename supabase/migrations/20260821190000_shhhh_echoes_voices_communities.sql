-- shhhh 2.0 — Echoes, Voices e Communities
-- Migração aditiva: preserva dados e colunas legadas enquanto estabelece o modelo seguro.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Feature flags: permitem rollback lógico sem alterações destrutivas.
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('SHHHH_V2_ENABLED', true, 'Habilita a experiência Echoes, Voices e Communities.'),
  ('PROTECT_VOICE_ENABLED', true, 'Habilita Protect My Voice no fluxo de publicação.'),
  ('DISCOVERY_V2_ENABLED', true, 'Habilita o feed seguro de descoberta.'),
  ('COMMUNITIES_ENABLED', true, 'Habilita Communities gratuitas e por convite.'),
  ('MONETIZATION_ENABLED', false, 'Reservado para monetização futura em moeda real.')
ON CONFLICT (key) DO NOTHING;

-- 2. Identidade pública pseudônima. owner_user_id nunca integra payloads públicos.
CREATE TABLE IF NOT EXISTS public.voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text NOT NULL UNIQUE CHECK (handle ~ '^@[a-z0-9_]{3,30}$'),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 60),
  bio text CHECK (char_length(bio) <= 280),
  avatar_seed text NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  avatar_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id)
);

-- 3. Categorias estruturais de Echo.
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  position smallint NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.categories (slug, name, position) VALUES
  ('relacionamentos', 'Relacionamentos', 1),
  ('segredos', 'Segredos', 2),
  ('desabafar', 'Preciso desabafar', 3),
  ('familia', 'Família', 4),
  ('trabalho', 'Trabalho', 5),
  ('faculdade-estudos', 'Faculdade/Estudos', 6),
  ('vergonha', 'Vergonha', 7),
  ('historias-inacreditaveis', 'Histórias inacreditáveis', 8),
  ('opiniao-impopular', 'Opinião impopular', 9),
  ('preciso-conselho', 'Preciso de conselho', 10),
  ('nunca-contei', 'Eu nunca contei isso', 11),
  ('madrugada', 'Pensamentos da madrugada', 12)
ON CONFLICT (slug) DO NOTHING;

-- 4. Extensão compatível de audio_posts. audio_url e user_id continuam temporariamente para legado.
ALTER TABLE public.audio_posts
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS voice_id uuid REFERENCES public.voices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS identity_mode text,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS voice_protection_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_protection_preset text,
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS community_id uuid,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

UPDATE public.audio_posts
SET owner_user_id = user_id
WHERE owner_user_id IS NULL AND user_id IS NOT NULL;

UPDATE public.audio_posts
SET identity_mode = CASE WHEN is_anonymous THEN 'anonymous' ELSE 'voice' END
WHERE identity_mode IS NULL;

UPDATE public.audio_posts
SET published_at = created_at
WHERE published_at IS NULL;

ALTER TABLE public.audio_posts
  ALTER COLUMN expires_at DROP NOT NULL,
  ALTER COLUMN expires_at DROP DEFAULT;

ALTER TABLE public.audio_posts
  DROP CONSTRAINT IF EXISTS audio_posts_identity_mode_check,
  ADD CONSTRAINT audio_posts_identity_mode_check CHECK (identity_mode IN ('voice', 'anonymous')) NOT VALID,
  DROP CONSTRAINT IF EXISTS audio_posts_voice_protection_preset_check,
  ADD CONSTRAINT audio_posts_voice_protection_preset_check CHECK (
    voice_protection_preset IS NULL OR voice_protection_preset IN ('natural', 'shadow', 'deep', 'soft')
  ) NOT VALID,
  DROP CONSTRAINT IF EXISTS audio_posts_moderation_status_check,
  ADD CONSTRAINT audio_posts_moderation_status_check CHECK (
    moderation_status IN ('pending', 'approved', 'limited', 'rejected', 'review_required')
  ) NOT VALID,
  DROP CONSTRAINT IF EXISTS audio_posts_visibility_check,
  ADD CONSTRAINT audio_posts_visibility_check CHECK (visibility IN ('public', 'community', 'unlisted')) NOT VALID,
  DROP CONSTRAINT IF EXISTS audio_posts_identity_voice_consistency,
  ADD CONSTRAINT audio_posts_identity_voice_consistency CHECK (
    (identity_mode = 'anonymous' AND voice_id IS NULL) OR
    (identity_mode = 'voice' AND voice_id IS NOT NULL)
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS audio_posts_discovery_idx
  ON public.audio_posts (published_at DESC, id DESC)
  WHERE status = 'active' AND moderation_status = 'approved' AND visibility = 'public';
CREATE INDEX IF NOT EXISTS audio_posts_owner_idx ON public.audio_posts(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audio_posts_voice_idx ON public.audio_posts(voice_id, created_at DESC) WHERE voice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audio_posts_expiration_idx ON public.audio_posts(expires_at) WHERE expires_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS audio_posts_storage_path_unique ON public.audio_posts(storage_path) WHERE storage_path IS NOT NULL;

-- 5. Relacionamentos, interações, segurança e analytics.
CREATE TABLE IF NOT EXISTS public.voice_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_id uuid NOT NULL REFERENCES public.voices(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_user_id, voice_id)
);

CREATE TABLE IF NOT EXISTS public.echo_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id uuid NOT NULL REFERENCES public.audio_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text NOT NULL CHECK (reaction_type IN ('me_too', 'with_you', 'wow', 'helped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(echo_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.echo_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id uuid NOT NULL REFERENCES public.audio_posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text NOT NULL CHECK (char_length(session_id) BETWEEN 8 AND 128),
  event_type text NOT NULL CHECK (event_type IN (
    'impression', 'play_start', 'play_25', 'play_50', 'play_70', 'play_complete',
    'replay', 'skip', 'reaction', 'reply', 'follow_voice', 'share', 'report', 'hide'
  )),
  play_position numeric(7,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS echo_events_echo_type_idx ON public.echo_events(echo_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS echo_events_user_idx ON public.echo_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_voice_id uuid REFERENCES public.voices(id) ON DELETE CASCADE,
  blocked_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (blocked_voice_id IS NOT NULL OR blocked_user_id IS NOT NULL),
  CHECK (blocked_voice_id IS NULL OR blocked_user_id IS NULL),
  UNIQUE NULLS NOT DISTINCT (blocker_user_id, blocked_voice_id, blocked_user_id)
);

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS report_category text,
  ADD COLUMN IF NOT EXISTS resolution_note text;

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_reason_check,
  ADD CONSTRAINT reports_reason_check CHECK (reason IN (
    'harassment', 'threat', 'doxxing', 'sexual_content', 'minor_safety', 'hate',
    'spam', 'self_harm', 'illegal_activity', 'other'
  )) NOT VALID;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('reaction', 'reply', 'follow_voice', 'voice_published', 'community_invite')),
  actor_voice_id uuid REFERENCES public.voices(id) ON DELETE SET NULL,
  echo_id uuid REFERENCES public.audio_posts(id) ON DELETE CASCADE,
  community_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onboarding_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  category_ids uuid[] NOT NULL DEFAULT '{}',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Communities gratuitas / por convite. Pagamentos permanecem explicitamente fora do escopo.
CREATE TABLE IF NOT EXISTS public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_voice_id uuid NOT NULL REFERENCES public.voices(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 80),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,50}$'),
  description text CHECK (char_length(description) <= 1000),
  avatar_url text,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  access_type text NOT NULL DEFAULT 'free' CHECK (access_type IN ('free', 'invite_only', 'paid_future')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_voice_id)
);

ALTER TABLE public.audio_posts
  ADD CONSTRAINT audio_posts_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.community_members (
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('creator', 'admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'removed')),
  PRIMARY KEY (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_members_user_idx ON public.community_members(user_id, status);
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON public.notifications(recipient_user_id, created_at DESC);

-- 7. Atualização automática de timestamps.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS voices_set_updated_at ON public.voices;
CREATE TRIGGER voices_set_updated_at BEFORE UPDATE ON public.voices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS echo_reactions_set_updated_at ON public.echo_reactions;
CREATE TRIGGER echo_reactions_set_updated_at BEFORE UPDATE ON public.echo_reactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS communities_set_updated_at ON public.communities;
CREATE TRIGGER communities_set_updated_at BEFORE UPDATE ON public.communities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS onboarding_preferences_set_updated_at ON public.onboarding_preferences;
CREATE TRIGGER onboarding_preferences_set_updated_at BEFORE UPDATE ON public.onboarding_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. Storage público apenas para mídia final com nome opaco. Nenhuma gravação bruta é armazenada aqui.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('echo-audio', 'echo-audio', true, 10485760, ARRAY['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can read final echo audio" ON storage.objects;
CREATE POLICY "Public can read final echo audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'echo-audio');
-- Não criar política de escrita: apenas a service role das Edge Functions publica o áudio final.

-- 9. RLS. O feed público jamais pode consultar audio_posts diretamente.
ALTER TABLE public.voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.echo_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.echo_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_posts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audio_posts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.audio_posts', policy_row.policyname);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "Owners can inspect their own Echoes" ON public.audio_posts;
CREATE POLICY "Owners can inspect their own Echoes"
  ON public.audio_posts FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can update their own Echoes" ON public.audio_posts;
CREATE POLICY "Owners can update their own Echoes"
  ON public.audio_posts FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can delete their own Echoes" ON public.audio_posts;
CREATE POLICY "Owners can delete their own Echoes"
  ON public.audio_posts FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Voice owners can inspect their Voice" ON public.voices;
CREATE POLICY "Voice owners can inspect their Voice" ON public.voices FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
DROP POLICY IF EXISTS "Voice owners can update their Voice" ON public.voices;
CREATE POLICY "Voice owners can update their Voice" ON public.voices FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Categories are readable" ON public.categories;
CREATE POLICY "Categories are readable" ON public.categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own follows" ON public.voice_follows;
CREATE POLICY "Users manage own follows" ON public.voice_follows FOR ALL TO authenticated USING (follower_user_id = auth.uid()) WITH CHECK (follower_user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own reactions" ON public.echo_reactions;
CREATE POLICY "Users manage own reactions" ON public.echo_reactions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users create own events" ON public.echo_events;
CREATE POLICY "Users create own events" ON public.echo_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users inspect own events" ON public.echo_events;
CREATE POLICY "Users inspect own events" ON public.echo_events FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own blocks" ON public.user_blocks;
CREATE POLICY "Users manage own blocks" ON public.user_blocks FOR ALL TO authenticated USING (blocker_user_id = auth.uid()) WITH CHECK (blocker_user_id = auth.uid());

DROP POLICY IF EXISTS "Recipients read notifications" ON public.notifications;
CREATE POLICY "Recipients read notifications" ON public.notifications FOR SELECT TO authenticated USING (recipient_user_id = auth.uid());
DROP POLICY IF EXISTS "Recipients update notifications" ON public.notifications;
CREATE POLICY "Recipients update notifications" ON public.notifications FOR UPDATE TO authenticated USING (recipient_user_id = auth.uid()) WITH CHECK (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage onboarding preferences" ON public.onboarding_preferences;
CREATE POLICY "Users manage onboarding preferences" ON public.onboarding_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Visible communities are readable" ON public.communities;
CREATE POLICY "Visible communities are readable" ON public.communities FOR SELECT USING (visibility = 'public' AND status = 'active');
DROP POLICY IF EXISTS "Members read memberships" ON public.community_members;
CREATE POLICY "Members read memberships" ON public.community_members FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Members join free communities" ON public.community_members;
CREATE POLICY "Members join free communities" ON public.community_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Feature flags are readable" ON public.feature_flags;
CREATE POLICY "Feature flags are readable" ON public.feature_flags FOR SELECT USING (true);

-- 10. Helpers seguros. SECURITY DEFINER é limitado a payloads públicos e sem identificadores de conta.
CREATE OR REPLACE FUNCTION public.get_discovery_feed(
  p_cursor timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 12,
  p_category_slug text DEFAULT NULL
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
  audio_url text,
  duration integer,
  expires_at timestamptz,
  voice_protection_enabled boolean,
  voice_protection_preset text,
  reaction_counts jsonb,
  reply_count integer,
  created_at timestamptz,
  next_cursor timestamptz
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
    AND (p_cursor IS NULL OR p.published_at < p_cursor)
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
    (
      0.15 * greatest(0, 1 - extract(epoch FROM (now() - published_at)) / 604800.0)
      + 0.25 * CASE WHEN impressions = 0 THEN 0.5 ELSE qualified_plays::numeric / impressions END
      + 0.15 * (COALESCE((reactions->>'me_too')::numeric, 0) + COALESCE((reactions->>'with_you')::numeric, 0)) / greatest(impressions, 1)
      + 0.10 * tracked_replies::numeric / greatest(impressions, 1)
      + 0.20 * follows::numeric / greatest(impressions, 1)
      + 0.15 * CASE WHEN impressions < 100 THEN 1 ELSE 0 END
      - 0.20 * skips::numeric / greatest(impressions, 1)
      - 0.60 * reports::numeric / greatest(impressions, 1)
    ) AS score
  FROM candidates
  WHERE voice_position <= 2 AND category_position <= 5
)
SELECT
  id,
  CASE WHEN identity_mode = 'anonymous' THEN 'Anônimo' ELSE COALESCE(voice_display_name, 'Voice') END,
  CASE WHEN identity_mode = 'anonymous' THEN NULL ELSE handle END,
  CASE WHEN identity_mode = 'anonymous' THEN NULL ELSE display_name END,
  CASE WHEN identity_mode = 'anonymous' THEN NULL ELSE avatar_seed END,
  resolved_category_slug,
  resolved_category_name,
  title,
  description,
  audio_url,
  duration,
  expires_at,
  voice_protection_enabled,
  voice_protection_preset,
  reactions,
  replies_count,
  created_at,
  published_at
FROM ranked
ORDER BY score DESC, published_at DESC
LIMIT least(greatest(p_limit, 1), 15);
$$;

CREATE OR REPLACE FUNCTION public.get_my_voices_feed(
  p_cursor timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 12
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
  audio_url text,
  duration integer,
  expires_at timestamptz,
  voice_protection_enabled boolean,
  voice_protection_preset text,
  reaction_counts jsonb,
  reply_count integer,
  created_at timestamptz,
  next_cursor timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
  p.id, v.display_name, v.handle, v.display_name, v.avatar_seed, c.slug, c.name,
  p.title, p.description, p.audio_url, p.duration, p.expires_at,
  p.voice_protection_enabled, p.voice_protection_preset,
  COALESCE((
    SELECT jsonb_object_agg(reaction_type, reaction_count)
    FROM (
      SELECT reaction_type, count(*)::integer AS reaction_count
      FROM public.echo_reactions r WHERE r.echo_id = p.id GROUP BY reaction_type
    ) grouped_reactions
  ), '{}'::jsonb),
  p.replies_count, p.created_at, p.published_at
FROM public.audio_posts p
JOIN public.voices v ON v.id = p.voice_id AND v.status = 'active'
JOIN public.voice_follows f ON f.voice_id = p.voice_id AND f.follower_user_id = auth.uid()
LEFT JOIN public.categories c ON c.id = p.category_id
WHERE p.status = 'active'
  AND p.moderation_status = 'approved'
  AND p.visibility = 'public'
  AND (p.expires_at IS NULL OR p.expires_at > now())
  AND (p_cursor IS NULL OR p.published_at < p_cursor)
  AND NOT EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE b.blocker_user_id = auth.uid()
      AND (b.blocked_user_id = p.owner_user_id OR b.blocked_voice_id = p.voice_id)
  )
ORDER BY p.published_at DESC
LIMIT least(greatest(p_limit, 1), 15);
$$;

CREATE OR REPLACE FUNCTION public.get_public_voice(p_handle text)
RETURNS TABLE (
  id uuid,
  handle text,
  display_name text,
  bio text,
  avatar_seed text,
  avatar_url text,
  status text,
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
SELECT
  v.id, v.handle, v.display_name, v.bio, v.avatar_seed, v.avatar_url, v.status,
  count(p.id) FILTER (WHERE p.status = 'active' AND p.moderation_status = 'approved' AND (p.expires_at IS NULL OR p.expires_at > now())) AS active_echo_count,
  count(p.id) FILTER (WHERE p.status = 'active' AND p.moderation_status = 'approved' AND p.expires_at IS NULL) AS permanent_echo_count,
  c.slug, c.name
FROM public.voices v
LEFT JOIN public.audio_posts p ON p.voice_id = v.id AND p.identity_mode = 'voice'
LEFT JOIN public.communities c ON c.owner_voice_id = v.id AND c.status = 'active'
WHERE v.handle = p_handle AND v.status = 'active'
GROUP BY v.id, c.slug, c.name;
$$;

CREATE OR REPLACE FUNCTION public.get_public_voice_echoes(p_handle text)
RETURNS TABLE (
  id uuid,
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
SELECT p.id, c.name, p.title, p.description, p.audio_url, p.duration, p.expires_at, p.created_at
FROM public.audio_posts p
JOIN public.voices v ON v.id = p.voice_id
LEFT JOIN public.categories c ON c.id = p.category_id
WHERE v.handle = p_handle
  AND p.identity_mode = 'voice'
  AND p.status = 'active'
  AND p.moderation_status = 'approved'
  AND (p.expires_at IS NULL OR p.expires_at > now())
ORDER BY p.created_at DESC;
$$;

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
  IF p_event_type NOT IN ('impression', 'play_start', 'play_25', 'play_50', 'play_70', 'play_complete', 'replay', 'skip', 'reaction', 'reply', 'follow_voice', 'share', 'report', 'hide') THEN
    RAISE EXCEPTION 'Invalid event type';
  END IF;
  INSERT INTO public.echo_events (echo_id, user_id, session_id, event_type, play_position, metadata)
  VALUES (p_echo_id, auth.uid(), p_session_id, p_event_type, p_play_position, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.get_discovery_feed(timestamptz, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_voices_feed(timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_voice(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_voice_echoes(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_echo_event(uuid, text, text, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_discovery_feed(timestamptz, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_voices_feed(timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_voice(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_voice_echoes(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_echo_event(uuid, text, text, numeric, jsonb) TO authenticated;

-- Migração de compatibilidade: o cleanup passa a usar storage_path; itens legados seguem presentes até expiração.
COMMENT ON COLUMN public.audio_posts.storage_path IS 'Caminho opaco no bucket echo-audio. Não contém identificador de conta.';
COMMENT ON COLUMN public.audio_posts.owner_user_id IS 'Identidade privada; nunca expor em RPCs, Edge Functions ou payloads públicos.';
COMMENT ON TABLE public.echo_events IS 'Eventos agregáveis de consumo; não registrar posição a cada milissegundo.';

-- Permissões de criação, mantidas restritas à conta autenticada e à Voice proprietária.
DROP POLICY IF EXISTS "Users can create one owned Voice" ON public.voices;
CREATE POLICY "Users can create one owned Voice" ON public.voices FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Voice owners can create communities" ON public.communities;
CREATE POLICY "Voice owners can create communities" ON public.communities FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.voices v WHERE v.id = owner_voice_id AND v.owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Community admins can update communities" ON public.communities;
CREATE POLICY "Community admins can update communities" ON public.communities FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.voices v WHERE v.id = owner_voice_id AND v.owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Creators add community members" ON public.community_members;
CREATE POLICY "Creators add community members" ON public.community_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.communities c
      JOIN public.voices v ON v.id = c.owner_voice_id
      WHERE c.id = community_id AND v.owner_user_id = auth.uid()
    )
  );

-- Se uma Voice criar uma comunidade, o proprietário se torna creator automaticamente.
CREATE OR REPLACE FUNCTION public.add_community_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE owner_id uuid;
BEGIN
  SELECT owner_user_id INTO owner_id FROM public.voices WHERE id = NEW.owner_voice_id;
  INSERT INTO public.community_members (community_id, user_id, role, status)
  VALUES (NEW.id, owner_id, 'creator', 'active')
  ON CONFLICT (community_id, user_id) DO UPDATE SET role = 'creator', status = 'active';
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS communities_add_creator ON public.communities;
CREATE TRIGGER communities_add_creator AFTER INSERT ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.add_community_creator();

-- Payloads seguros para Community: membros recebem conteúdo sem expor owner_user_id.
CREATE OR REPLACE FUNCTION public.get_community_by_slug(p_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  description text,
  avatar_url text,
  visibility text,
  access_type text,
  owner_handle text,
  owner_display_name text,
  member_role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT c.id, c.name, c.slug, c.description, c.avatar_url, c.visibility, c.access_type,
       v.handle, v.display_name,
       cm.role
FROM public.communities c
JOIN public.voices v ON v.id = c.owner_voice_id
LEFT JOIN public.community_members cm ON cm.community_id = c.id AND cm.user_id = auth.uid() AND cm.status = 'active'
WHERE c.slug = p_slug
  AND c.status = 'active'
  AND (c.visibility = 'public' OR cm.user_id IS NOT NULL);
$$;

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
WHERE c.slug = p_slug
  AND c.status = 'active'
  AND (c.visibility = 'public' OR cm.user_id IS NOT NULL)
  AND p.status = 'active'
  AND p.moderation_status = 'approved'
  AND (p.expires_at IS NULL OR p.expires_at > now())
ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_community_by_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_community_feed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_community_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_feed(text) TO anon, authenticated;

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
  audio_url text,
  duration integer,
  expires_at timestamptz,
  voice_protection_enabled boolean,
  voice_protection_preset text,
  reaction_counts jsonb,
  reply_count integer,
  created_at timestamptz,
  next_cursor timestamptz
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
       c.slug, c.name, p.title, p.description, p.audio_url, p.duration, p.expires_at,
       p.voice_protection_enabled, p.voice_protection_preset,
       COALESCE((
         SELECT jsonb_object_agg(reaction_type, reaction_count)
         FROM (
           SELECT reaction_type, count(*)::integer AS reaction_count
           FROM public.echo_reactions r WHERE r.echo_id = p.id GROUP BY reaction_type
         ) grouped_reactions
       ), '{}'::jsonb),
       p.replies_count, p.created_at, p.published_at
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

CREATE OR REPLACE FUNCTION public.search_public_content(p_query text, p_limit integer DEFAULT 20)
RETURNS TABLE (
  result_type text,
  id uuid,
  label text,
  subtitle text,
  href text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH query AS (SELECT lower(trim(p_query)) AS term)
SELECT 'voice', v.id, v.display_name, v.handle, '/v/' || replace(v.handle, '@', '')
FROM public.voices v, query
WHERE v.status = 'active'
  AND query.term <> ''
  AND (lower(v.handle) LIKE '%' || query.term || '%' OR lower(v.display_name) LIKE '%' || query.term || '%')
UNION ALL
SELECT 'category', c.id, c.name, 'Categoria', '/app/echoes?category=' || c.slug
FROM public.categories c, query
WHERE query.term <> '' AND lower(c.name) LIKE '%' || query.term || '%'
UNION ALL
SELECT 'echo', p.id, COALESCE(p.title, 'Um Echo para ouvir'), COALESCE(c.name, 'Echo'), '/e/' || p.id::text
FROM public.audio_posts p
LEFT JOIN public.categories c ON c.id = p.category_id
LEFT JOIN public.audio_hashtags ah ON ah.audio_id = p.id
LEFT JOIN public.hashtags h ON h.id = ah.hashtag_id
CROSS JOIN query
WHERE query.term <> ''
  AND p.status = 'active'
  AND p.moderation_status = 'approved'
  AND p.visibility = 'public'
  AND (p.expires_at IS NULL OR p.expires_at > now())
  AND (lower(COALESCE(p.title, '')) LIKE '%' || query.term || '%'
       OR lower(COALESCE(p.description, '')) LIKE '%' || query.term || '%'
       OR lower(COALESCE(h.name, '')) LIKE '%' || query.term || '%')
LIMIT least(greatest(p_limit, 1), 30);
$$;
REVOKE ALL ON FUNCTION public.search_public_content(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_content(text, integer) TO anon, authenticated;

-- Notificações de interações relevantes; nunca criar notificação por reprodução.
CREATE OR REPLACE FUNCTION public.notify_echo_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE recipient uuid;
BEGIN
  SELECT owner_user_id INTO recipient FROM public.audio_posts WHERE id = NEW.echo_id;
  IF recipient IS NOT NULL AND recipient <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_user_id, type, echo_id)
    VALUES (recipient, 'reaction', NEW.echo_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS echo_reactions_notify_owner ON public.echo_reactions;
CREATE TRIGGER echo_reactions_notify_owner AFTER INSERT OR UPDATE ON public.echo_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_echo_reaction();

CREATE OR REPLACE FUNCTION public.notify_echo_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE recipient uuid;
DECLARE actor_voice uuid;
BEGIN
  SELECT owner_user_id INTO recipient FROM public.audio_posts WHERE id = NEW.parent_audio_id;
  SELECT voice_id INTO actor_voice FROM public.audio_posts WHERE id = NEW.reply_audio_id;
  IF recipient IS NOT NULL AND recipient <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_user_id, type, actor_voice_id, echo_id)
    VALUES (recipient, 'reply', actor_voice, NEW.parent_audio_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audio_replies_notify_owner ON public.audio_replies;
CREATE TRIGGER audio_replies_notify_owner AFTER INSERT ON public.audio_replies
  FOR EACH ROW EXECUTE FUNCTION public.notify_echo_reply();

CREATE OR REPLACE FUNCTION public.notify_voice_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE recipient uuid;
BEGIN
  SELECT owner_user_id INTO recipient FROM public.voices WHERE id = NEW.voice_id;
  IF recipient IS NOT NULL AND recipient <> NEW.follower_user_id THEN
    INSERT INTO public.notifications (recipient_user_id, type, actor_voice_id)
    VALUES (recipient, 'follow_voice', NULL);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS voice_follows_notify_owner ON public.voice_follows;
CREATE TRIGGER voice_follows_notify_owner AFTER INSERT ON public.voice_follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_voice_follow();

CREATE OR REPLACE FUNCTION public.notify_voice_followers_of_echo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.identity_mode = 'voice' AND NEW.voice_id IS NOT NULL AND NEW.moderation_status = 'approved' AND NEW.visibility = 'public' THEN
    INSERT INTO public.notifications (recipient_user_id, type, actor_voice_id, echo_id)
    SELECT follower_user_id, 'voice_published', NEW.voice_id, NEW.id
    FROM public.voice_follows
    WHERE voice_id = NEW.voice_id AND follower_user_id <> NEW.owner_user_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audio_posts_notify_voice_followers ON public.audio_posts;
CREATE TRIGGER audio_posts_notify_voice_followers AFTER INSERT ON public.audio_posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_voice_followers_of_echo();
