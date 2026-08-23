import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Configuração do Supabase self-hosted.
//
// Sem fallback embutido de propósito: um build sem .env apontava silenciosamente
// para a instalação de produção — inclusive em build de teste ou de outro
// ambiente. Faltando variável, o build falha e o erro aparece de imediato.
function readEnv(value: string | undefined, name: string): string {
  const resolved = (value ?? '').trim();
  if (!resolved) {
    throw new Error(
      `${name} não configurada. Defina-a no .env de build (veja .env.example) antes de compilar o app.`,
    );
  }
  return resolved;
}

export const SUPABASE_URL = readEnv(import.meta.env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL').replace(/\/+$/, '');

// Chave publishable/anon. Nunca use service-role/secret no cliente.
export const SUPABASE_PUBLISHABLE_KEY = readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY, 'VITE_SUPABASE_ANON_KEY');

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Bucket legado usado pelo upload direto anterior ao fluxo publish-echo.
export const AUDIO_BUCKET = 'public';
export const AUDIO_FOLDER = 'audio';

// Bucket dos Echoes; o caminho é opaco e gerado pela Edge Function publish-echo.
export const ECHO_AUDIO_BUCKET = 'echo-audio';
