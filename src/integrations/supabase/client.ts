import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Configuração do Supabase self-hosted.
// Os valores vêm das variáveis Vite (.env.production em produção). Os padrões
// abaixo apontam para a instalação de produção e existem apenas para que um
// build sem arquivo de ambiente continue funcionando.
const DEFAULT_SUPABASE_URL = 'https://supabase.nutef.com';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE';

function readEnv(value: string | undefined, fallback: string, name: string): string {
  const resolved = (value ?? '').trim() || fallback;
  if (!resolved) {
    throw new Error(`${name} não configurada. Defina-a no arquivo .env de build.`);
  }
  return resolved;
}

export const SUPABASE_URL = readEnv(
  import.meta.env.VITE_SUPABASE_URL,
  DEFAULT_SUPABASE_URL,
  'VITE_SUPABASE_URL',
).replace(/\/+$/, '');

// Chave publishable/anon. Nunca use service-role/secret no cliente.
export const SUPABASE_PUBLISHABLE_KEY = readEnv(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  'VITE_SUPABASE_ANON_KEY',
);

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Bucket legado usado pelo upload direto anterior ao fluxo publish-echo.
export const AUDIO_BUCKET = 'public';
export const AUDIO_FOLDER = 'audio';

// Bucket dos Echoes; o caminho é opaco e gerado pela Edge Function publish-echo.
export const ECHO_AUDIO_BUCKET = 'echo-audio';
