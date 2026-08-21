export type IdentityMode = 'voice' | 'anonymous'
export type VoiceProtectionPreset = 'natural' | 'shadow' | 'deep' | 'soft'
export type EchoExpiration = '1h' | '6h' | '24h' | '7d' | 'permanent'
export type EchoReactionType = 'me_too' | 'with_you' | 'wow' | 'helped'
export type EchoEventType =
  | 'impression'
  | 'play_start'
  | 'play_25'
  | 'play_50'
  | 'play_70'
  | 'play_complete'
  | 'replay'
  | 'skip'
  | 'reaction'
  | 'reply'
  | 'follow_voice'
  | 'share'
  | 'report'
  | 'hide'

/** Payload público permitido para Echoes. Não acrescente owner_user_id nem dados da conta. */
export interface PublicEcho {
  id: string
  public_identity: string
  voice_handle: string | null
  voice_display_name: string | null
  avatar_seed: string | null
  category_slug: string | null
  category_name: string | null
  title: string | null
  description: string | null
  audio_url: string
  duration: number
  expires_at: string | null
  voice_protection_enabled: boolean
  voice_protection_preset: VoiceProtectionPreset | null
  reaction_counts: Partial<Record<EchoReactionType, number>>
  reply_count: number
  created_at: string
  next_cursor: string
}

export interface EchoCategory {
  id: string
  slug: string
  name: string
  position: number
}

export interface ProtectedAudioResult {
  blob: Blob
  previewUrl: string
  preset: VoiceProtectionPreset
  processed: true
}

export interface VoiceProtectionProvider {
  protectAudio(input: Blob, preset: VoiceProtectionPreset): Promise<ProtectedAudioResult>
}

export interface EchoDraft {
  audio: Blob
  duration: number
  identityMode: IdentityMode
  voiceId: string | null
  categoryId: string
  title: string
  description: string
  expiration: EchoExpiration
  transcription: string | null
  voiceProtectionEnabled: boolean
  voiceProtectionPreset: VoiceProtectionPreset
  protectedAudio: ProtectedAudioResult | null
  replyToId?: string | null
}

export interface PublicVoice {
  id: string
  handle: string
  display_name: string
  bio: string | null
  avatar_seed: string
  avatar_url: string | null
  status: 'active' | 'suspended' | 'deleted'
  active_echo_count: number
  permanent_echo_count: number
  community_slug: string | null
  community_name: string | null
}

export interface PublicCommunity {
  id: string
  owner_voice_id: string
  name: string
  slug: string
  description: string | null
  avatar_url: string | null
  visibility: 'public' | 'private'
  access_type: 'free' | 'invite_only' | 'paid_future'
  status: 'active' | 'suspended' | 'deleted'
  created_at: string
}
