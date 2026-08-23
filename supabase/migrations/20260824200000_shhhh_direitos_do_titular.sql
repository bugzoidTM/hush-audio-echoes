-- Direitos do titular (LGPD, art. 18): acesso/portabilidade e eliminação.
--
-- Uma rede social de desabafo anônimo não pode ter porta de entrada e não ter
-- porta de saída. Até aqui era possível apagar um Echo, mas não sair do shhhh.

-- ---------------------------------------------------------------------------
-- 1. Portabilidade: levar embora o que é seu, em formato legível
-- ---------------------------------------------------------------------------

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
    'voices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('handle', v.handle, 'nome', v.display_name, 'bio', v.bio,
                                          'criada_em', v.created_at, 'status', v.status, 'indexavel', v.indexable))
      FROM public.voices v WHERE v.owner_user_id = quem
    ), '[]'::jsonb),
    -- A transcrição vai junto: é conteúdo do titular, ainda que gerada no
    -- servidor. Sem ela a exportação não seria portabilidade de verdade.
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

-- ---------------------------------------------------------------------------
-- 2. Eliminação: sair do shhhh
-- ---------------------------------------------------------------------------

-- Chamada pela Edge Function `delete-account` depois de reconfirmar a senha.
--
-- Devolve os caminhos da mídia porque `audio_posts.owner_user_id` referencia
-- `auth.users` com ON DELETE CASCADE: no instante em que a conta de acesso é
-- removida, as linhas somem, e com elas o `storage_path`. O cron de limpeza
-- então nunca encontra os arquivos — eles ficariam no bucket para sempre, sem
-- registro apontando para eles e com a URL ainda funcionando. Por isso quem
-- apaga a mídia aqui é a Edge Function, ANTES de apagar a conta.
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

  -- Denúncias feitas perdem o vínculo com a pessoa, mas não somem: apagá-las
  -- deixaria a moderação sem o histórico do caso denunciado, que existe para
  -- proteger terceiros. É o que a LGPD ressalva como conservação necessária.
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
-- 3. Áudio órfão: arquivo no bucket sem linha no banco
-- ---------------------------------------------------------------------------

-- Como `audio_posts.owner_user_id` referencia `auth.users` com ON DELETE
-- CASCADE, qualquer exclusão de conta feita fora do produto (painel do GoTrue,
-- API de admin) apaga as linhas e deixa os arquivos para trás — sem registro
-- que os encontre e com a URL pública ainda respondendo. Auditado em
-- 2026-08-24: 34 objetos nessa condição, todos de contas de teste.
CREATE OR REPLACE FUNCTION public.list_orphan_media(p_older_than_minutes integer DEFAULT 60)
RETURNS TABLE (name text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT o.name, o.created_at
  FROM storage.objects o
  WHERE o.bucket_id = 'echo-audio'
    -- Janela de folga: entre o upload e a inserção da linha existe um instante
    -- em que um Echo legítimo parece órfão.
    AND o.created_at < now() - make_interval(mins => greatest(p_older_than_minutes, 5))
    AND NOT EXISTS (SELECT 1 FROM public.audio_posts p WHERE p.storage_path = o.name)
  LIMIT 500;
$$;
REVOKE ALL ON FUNCTION public.list_orphan_media(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_orphan_media(integer) TO service_role;
