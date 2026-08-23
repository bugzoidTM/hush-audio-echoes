-- A duração que chega no publish-echo é declarada pelo cliente. Um cliente
-- modificado envia 30 minutos dizendo 30 segundos: o arquivo passava (cabia no
-- teto de bytes de então) e o whisper em CPU ficava meia hora mastigando.
--
-- O worker passou a medir o áudio publicado com ffprobe antes de transcrever.
-- Quando o arquivo estoura o limite, é isto que ele chama: o Echo vai para
-- revisão humana com a duração real registrada, sem consumir transcrição
-- nenhuma. Nunca é aprovação automática, e nunca é descarte silencioso — quem
-- gravou pode ter sido vítima de um app quebrado, não só de má-fé.
CREATE OR REPLACE FUNCTION public.flag_oversized_echo(
  p_echo_id uuid,
  p_real_duration integer,
  p_max_duration integer DEFAULT 60
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE affected uuid;
BEGIN
  UPDATE public.audio_posts
  SET moderation_status = 'review_required',
      moderation_source = 'server_stt',
      moderated_at = now(),
      moderation_note = format(
        'Áudio publicado tem %s s, acima do limite de %s s (o cliente declarou %s s). Não transcrito.',
        p_real_duration, p_max_duration, duration
      ),
      duration = p_real_duration,
      visibility = 'unlisted',
      updated_at = now()
  WHERE id = p_echo_id
  RETURNING id INTO affected;

  IF affected IS NULL THEN
    RAISE EXCEPTION 'Echo inexistente.' USING ERRCODE = '42704';
  END IF;
  RETURN 'review_required';
END;
$$;
REVOKE ALL ON FUNCTION public.flag_oversized_echo(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flag_oversized_echo(uuid, integer, integer) TO service_role;

-- Trava final, independente de aplicação: nem a service_role publica um Echo
-- fora dos limites. Se um dia outro caminho de escrita aparecer, ele bate aqui.
ALTER TABLE public.audio_posts
  DROP CONSTRAINT IF EXISTS audio_posts_duration_limits,
  ADD CONSTRAINT audio_posts_duration_limits
  CHECK (duration IS NULL OR (duration >= 0 AND duration <= 21600)) NOT VALID;

COMMENT ON COLUMN public.audio_posts.duration IS
  'Segundos. Na publicação é o valor declarado pelo cliente; o worker de moderação sobrescreve com a duração medida quando ela diverge.';
