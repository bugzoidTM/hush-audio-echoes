-- Rate limiting server-side para publicação, reação e denúncia.
--
-- O que existia era `useRateLimiter`, um contador em localStorage: some com um
-- F5, com uma aba anônima ou com qualquer cliente que não seja o navegador do
-- app. Não é fronteira de segurança nenhuma — é conforto de UX.
--
-- Aqui o limite vive no banco, do lado de dentro de todos os caminhos de
-- escrita: gatilho nas tabelas que o PostgREST expõe (nem um cliente modificado
-- escapa) e chamada explícita na Edge Function de publicação, que escreve com
-- service_role e por isso não tem `auth.uid()`.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  action text PRIMARY KEY,
  max_hits integer NOT NULL CHECK (max_hits > 0),
  window_seconds integer NOT NULL CHECK (window_seconds > 0),
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Limites afrouxam ou apertam com um UPDATE, sem migração e sem build — mesma
-- ideia das feature flags.
INSERT INTO public.rate_limits (action, max_hits, window_seconds, description) VALUES
  ('publish_echo',  5,   3600,  'Echoes publicados por hora, por conta.'),
  ('echo_reaction', 120, 3600,  'Reações por hora. Alto de propósito: reagir é o gesto barato do produto.'),
  ('echo_report',   10,  3600,  'Denúncias por hora. Denúncia em massa é ataque, não moderação.'),
  ('create_voice',  3,   86400, 'Voices criadas por dia.'),
  ('follow_voice',  200, 3600,  'Follows por hora.')
ON CONFLICT (action) DO NOTHING;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
-- Sem policy: só as funções SECURITY DEFINER abaixo leem a configuração.

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limit_hits_lookup_idx
  ON public.rate_limit_hits (user_id, action, created_at DESC);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_hits FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.rate_limit_hits_id_seq FROM anon, authenticated;
-- Sem policy: o registro de tentativas não é legível nem apagável por ninguém
-- que passe pelo PostgREST. Quem contorna o limite apagando o contador não
-- estaria limitado.

/**
 * Consome uma tentativa e recusa quando o limite estoura.
 *
 * ERRCODE 'PT429': o PostgREST traduz SQLSTATE que começa com PT no código HTTP
 * dos três últimos dígitos, então o cliente recebe 429 e não um 400 genérico.
 */
CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_user_id uuid, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(uuid, text) TO service_role;

-- Gatilhos: o limite vale para qualquer caminho de escrita, inclusive um
-- cliente falando direto com o PostgREST.
CREATE OR REPLACE FUNCTION public.rate_limit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role escreve pelas Edge Functions, que aplicam o limite com o dono
  -- explícito (auth.uid() é nulo ali). Não dá para limitar duas vezes.
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.consume_rate_limit(auth.uid(), TG_ARGV[0]);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS echo_reactions_rate_limit ON public.echo_reactions;
CREATE TRIGGER echo_reactions_rate_limit BEFORE INSERT ON public.echo_reactions
  FOR EACH ROW EXECUTE FUNCTION public.rate_limit_trigger('echo_reaction');

DROP TRIGGER IF EXISTS reports_rate_limit ON public.reports;
CREATE TRIGGER reports_rate_limit BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.rate_limit_trigger('echo_report');

DROP TRIGGER IF EXISTS voices_rate_limit ON public.voices;
CREATE TRIGGER voices_rate_limit BEFORE INSERT ON public.voices
  FOR EACH ROW EXECUTE FUNCTION public.rate_limit_trigger('create_voice');

DROP TRIGGER IF EXISTS voice_follows_rate_limit ON public.voice_follows;
CREATE TRIGGER voice_follows_rate_limit BEFORE INSERT ON public.voice_follows
  FOR EACH ROW EXECUTE FUNCTION public.rate_limit_trigger('follow_voice');

COMMENT ON TABLE public.rate_limits IS
  'Limites por ação e por conta. Ajuste com UPDATE — vale na hora, sem deploy.';
