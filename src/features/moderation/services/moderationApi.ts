import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from '@/integrations/supabase/client'
import type { ModerationDecision, ModerationStats, ReviewItem, ReviewScope } from '../types'

async function rpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${data.session?.access_token ?? SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({})) as T & { message?: string }
  if (!response.ok) throw new Error(result.message ?? 'Não foi possível concluir a ação de moderação.')
  return result
}

export async function isModerator(): Promise<boolean> {
  return rpc<boolean>('is_moderator')
}

export async function getReviewQueue(scope: ReviewScope): Promise<ReviewItem[]> {
  return rpc<ReviewItem[]>('get_review_queue', { p_scope: scope, p_limit: 100 })
}

export async function getModerationStats(): Promise<ModerationStats> {
  const rows = await rpc<ModerationStats[]>('get_moderation_stats')
  return rows[0] ?? { pending: 0, stuck_pending: 0, review_required: 0, limited: 0, open_reports: 0, approved_active: 0 }
}

export interface WorkerStatus {
  name: string
  last_run_at: string | null
  minutos_desde: number
  runs_total: number
  parado: boolean
}

/** A fila só faz sentido se quem a alimenta estiver vivo. */
export async function getWorkerStatus(): Promise<WorkerStatus[]> {
  return rpc<WorkerStatus[]>('get_worker_status')
}

export interface FunnelStep {
  event_type: string
  sessoes: number
  eventos: number
}

/** Funil de aquisição: quantas sessões distintas chegaram a cada etapa. */
export async function getAcquisitionFunnel(days = 7): Promise<FunnelStep[]> {
  return rpc<FunnelStep[]>('get_acquisition_funnel', { p_days: days })
}

export async function reviewEcho(echoId: string, decision: ModerationDecision, note?: string): Promise<void> {
  await rpc('review_echo', { p_echo_id: echoId, p_decision: decision, p_note: note?.trim() || null })
}

export async function dismissEchoReports(echoId: string, note?: string): Promise<void> {
  await rpc('dismiss_echo_reports', { p_echo_id: echoId, p_note: note?.trim() || null })
}

export async function setVoiceStatus(voiceId: string, status: 'active' | 'suspended'): Promise<void> {
  await rpc('set_voice_status', { p_voice_id: voiceId, p_status: status })
}

/**
 * Bloquear o login só o GoTrue faz, e só com a service_role — por isso esta é a
 * única ação do painel que passa por Edge Function em vez de RPC.
 */
export async function suspendAccount(userId: string, suspended: boolean, note?: string): Promise<{ voices_afetadas: number; echoes_afetados: number }> {
  const { data } = await supabase.auth.getSession()
  const response = await fetch(`${SUPABASE_URL}/functions/v1/suspend-account`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${data.session?.access_token ?? SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId, suspended, note: note?.trim() || undefined }),
  })
  const result = await response.json().catch(() => ({})) as { error?: string; voices_afetadas?: number; echoes_afetados?: number }
  if (!response.ok) throw new Error(result.error ?? 'Não foi possível alterar o acesso desta conta.')
  return { voices_afetadas: result.voices_afetadas ?? 0, echoes_afetados: result.echoes_afetados ?? 0 }
}
