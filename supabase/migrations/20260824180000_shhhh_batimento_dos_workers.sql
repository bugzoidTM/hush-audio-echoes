-- Sinal de vida dos workers de manutenção.
--
-- O worker de moderação já avisava quando a fila envelhecia. Só que esse aviso
-- vem de dentro dele: se o worker morre — cron removido, script quebrado, host
-- reiniciado — ninguém avisa nada, e todo Echo novo fica invisível para sempre.
-- Falha silenciosa é o modo de falha perigoso deste sistema.
--
-- A saída é vigilância cruzada: cada worker registra seu batimento e confere o
-- do outro. Eles rodam em cadências diferentes (2 min e 15 min), então a morte
-- de um é percebida pelo outro.

CREATE TABLE IF NOT EXISTS public.worker_heartbeats (
  name text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  last_note text,
  runs_total bigint NOT NULL DEFAULT 0
);

ALTER TABLE public.worker_heartbeats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.worker_heartbeats FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_worker_heartbeat(p_name text, p_note text DEFAULT NULL)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE registrado timestamptz;
BEGIN
  INSERT INTO public.worker_heartbeats (name, last_run_at, last_note, runs_total)
  VALUES (p_name, now(), left(COALESCE(p_note, ''), 300), 1)
  ON CONFLICT (name) DO UPDATE
    SET last_run_at = now(),
        last_note = left(COALESCE(p_note, ''), 300),
        runs_total = public.worker_heartbeats.runs_total + 1
  RETURNING last_run_at INTO registrado;
  RETURN registrado;
END;
$$;
REVOKE ALL ON FUNCTION public.record_worker_heartbeat(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_worker_heartbeat(text, text) TO service_role;

-- Um worker que nunca registrou batimento também conta como parado: sem isto,
-- um worker que morre antes do primeiro registro passaria despercebido.
CREATE OR REPLACE FUNCTION public.stale_workers()
RETURNS TABLE (name text, last_run_at timestamptz, minutos_parado integer, tolerancia_minutos integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH esperados(name, tolerancia_minutos) AS (
    VALUES ('moderacao', 10), ('limpeza', 45)
  )
  SELECT e.name,
         h.last_run_at,
         COALESCE(floor(extract(epoch FROM (now() - h.last_run_at)) / 60)::integer, 999999),
         e.tolerancia_minutos
  FROM esperados e
  LEFT JOIN public.worker_heartbeats h ON h.name = e.name
  WHERE h.last_run_at IS NULL
     OR h.last_run_at < now() - make_interval(mins => e.tolerancia_minutos);
$$;
REVOKE ALL ON FUNCTION public.stale_workers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stale_workers() TO service_role, authenticated;

-- O painel de moderação mostra o estado dos workers: a fila só faz sentido se
-- quem a alimenta estiver vivo.
CREATE OR REPLACE FUNCTION public.get_worker_status()
RETURNS TABLE (name text, last_run_at timestamptz, minutos_desde integer, runs_total bigint, parado boolean)
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
  WITH esperados(name, tolerancia_minutos) AS (VALUES ('moderacao', 10), ('limpeza', 45))
  SELECT e.name,
         h.last_run_at,
         COALESCE(floor(extract(epoch FROM (now() - h.last_run_at)) / 60)::integer, 999999),
         COALESCE(h.runs_total, 0),
         h.last_run_at IS NULL OR h.last_run_at < now() - make_interval(mins => e.tolerancia_minutos)
  FROM esperados e
  LEFT JOIN public.worker_heartbeats h ON h.name = e.name
  ORDER BY e.name;
END;
$$;
REVOKE ALL ON FUNCTION public.get_worker_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_worker_status() TO authenticated;
