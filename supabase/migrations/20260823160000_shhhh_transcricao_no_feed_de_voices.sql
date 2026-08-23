-- O card de Echo mostra a transcrição do servidor, e não a descrição. O feed
-- "My Voices" era o único payload público que ainda não devolvia a coluna, o
-- que deixava o botão "Mostrar transcrição" sumido justamente no feed de quem
-- a pessoa segue.
-- Acrescentar coluna ao retorno exige DROP: o Postgres não troca o tipo de
-- retorno de uma função existente.
DROP FUNCTION IF EXISTS public.get_my_voices_feed(timestamptz, integer);

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
  transcription text,
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
  p.title, p.description, p.transcription, p.audio_url, p.duration, p.expires_at,
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
REVOKE ALL ON FUNCTION public.get_my_voices_feed(timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_voices_feed(timestamptz, integer) TO authenticated;
