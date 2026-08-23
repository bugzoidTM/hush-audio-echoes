export type ModerationDecision = 'approved' | 'limited' | 'rejected' | 'review_required'

export type ReviewScope = 'all' | 'moderation' | 'reports'

/**
 * Payload da fila é o oposto do payload público: aqui o moderador precisa da
 * transcrição do servidor, do texto que o cliente mandou (para comparar) e de
 * quem publicou — é com isso que se decide suspender Voice ou conta.
 */
export interface ReviewItem {
  id: string
  moderation_status: string
  moderation_source: string | null
  moderation_note: string | null
  moderation_attempts: number
  moderated_at: string | null
  published_at: string
  title: string | null
  description: string | null
  category_name: string | null
  transcription: string | null
  client_transcription: string | null
  audio_url: string
  duration: number
  identity_mode: string
  owner_user_id: string
  voice_id: string | null
  voice_handle: string | null
  voice_display_name: string | null
  voice_status: string | null
  open_reports: number
  report_reasons: string[]
}

export interface ModerationStats {
  pending: number
  stuck_pending: number
  review_required: number
  limited: number
  open_reports: number
  approved_active: number
}
