import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from '@/integrations/supabase/client'
import type {
  EchoCategory,
  EchoDraft,
  EchoEventType,
  EchoReactionType,
  FeatureFlags,
  PublicCommunity,
  PublicEcho,
  PublicVoice,
} from '../types'

async function authorizationHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${data.session?.access_token ?? SUPABASE_PUBLISHABLE_KEY}`,
  }
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      ...(await authorizationHeaders()),
      ...(init.headers ?? {}),
    },
  })
  const result = await response.json().catch(() => ({})) as T & { error?: { message?: string } | string }
  if (!response.ok) {
    const message = typeof result.error === 'string' ? result.error : result.error?.message
    throw new Error(message ?? 'Não foi possível concluir a solicitação.')
  }
  return result
}

export async function completeOnboarding(categoryIds: string[]): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Autenticação obrigatória.')
  await requestJson('/rest/v1/onboarding_preferences?on_conflict=user_id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userData.user.id, category_ids: categoryIds, completed_at: new Date().toISOString() }),
  })
}

export async function isOnboardingComplete(): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return true
  const rows = await requestJson<Array<{ completed_at: string | null }>>(`/rest/v1/onboarding_preferences?select=completed_at&user_id=eq.${encodeURIComponent(userData.user.id)}&limit=1`)
  return Boolean(rows[0]?.completed_at)
}

export async function getCategories(): Promise<EchoCategory[]> {
  return requestJson<EchoCategory[]>('/rest/v1/categories?select=id,slug,name,position&order=position.asc')
}

export interface DiscoveryPage {
  items: PublicEcho[]
  next_cursor: string | null
  has_more: boolean
}

/**
 * Página do Discovery. A paginação é pelo conjunto já servido (`excludeIds`), e
 * não por cursor de tempo: o ranking por score muda entre requisições, então um
 * cursor por published_at pulava e repetia Echoes. O servidor limita a lista a
 * 300 ids; enviar os mais recentes basta porque quem já foi ouvido até o fim
 * também é filtrado por 7 dias no próprio SQL.
 */
export async function getDiscoveryFeed(
  category?: string | null,
  excludeIds: string[] = [],
): Promise<DiscoveryPage> {
  const params = new URLSearchParams({ limit: '12' })
  if (category) params.set('category', category)
  if (excludeIds.length) params.set('exclude', excludeIds.slice(-300).join(','))
  const response = await requestJson<DiscoveryPage>(`/functions/v1/discovery-feed?${params.toString()}`)
  assertAnonymousPayloadSafety(response.items)
  return response
}

/**
 * Prévia para quem ainda não tem conta. Diferente do Discovery: no máximo 3 por
 * chamada, sem ranking personalizado, servida só a partir dos Echoes mais
 * recentes. É funil, não fronteira — o bucket é público de propósito, para que
 * um link compartilhado toque no WhatsApp de quem nunca ouviu falar do shhhh.
 */
export async function getPublicPreviewFeed(excludeIds: string[] = []): Promise<PublicEcho[]> {
  const rows = await requestJson<PublicEcho[]>('/rest/v1/rpc/get_public_preview_feed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_exclude_ids: excludeIds.slice(-50), p_limit: 3 }),
  })
  assertAnonymousPayloadSafety(rows)
  return rows
}

export async function setVoiceIndexable(voiceId: string, indexable: boolean): Promise<void> {
  await requestJson('/rest/v1/rpc/set_voice_indexable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_voice_id: voiceId, p_indexable: indexable }),
  })
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const rows = await requestJson<Array<{ key: string; enabled: boolean }>>('/rest/v1/feature_flags?select=key,enabled')
  return Object.fromEntries(rows.map((row) => [row.key, row.enabled])) as FeatureFlags
}

export async function getPublicEcho(echoId: string): Promise<PublicEcho | null> {
  const rows = await requestJson<PublicEcho[]>('/rest/v1/rpc/get_public_echo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_echo_id: echoId }),
  })
  const echo = rows[0] ?? null
  if (echo) assertAnonymousPayloadSafety([echo])
  return echo
}

export async function getEchoReplies(echoId: string): Promise<PublicEcho[]> {
  const rows = await requestJson<PublicEcho[]>('/rest/v1/rpc/get_echo_replies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_echo_id: echoId, p_limit: 50 }),
  })
  assertAnonymousPayloadSafety(rows)
  return rows
}

/** Estado de moderação do próprio Echo: publicar não significa mais estar no ar. */
export async function getMyEchoStatus(echoId: string): Promise<{ id: string; moderation_status: string; moderated_at: string | null } | null> {
  const rows = await requestJson<Array<{ id: string; moderation_status: string; moderated_at: string | null }>>('/rest/v1/rpc/get_my_echo_status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_echo_id: echoId }),
  })
  return rows[0] ?? null
}

// audio_posts não aceita mais UPDATE/DELETE direto: um PATCH no PostgREST
// trocava moderation_status, visibility, voice_id e audio_url. Só estes dois
// caminhos, campo a campo, continuam disponíveis para o dono.
export async function updateEchoMetadata(echoId: string, input: { title?: string | null; description?: string | null; categoryId?: string | null }): Promise<void> {
  await requestJson('/rest/v1/rpc/update_echo_metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_echo_id: echoId,
      p_title: input.title ?? null,
      p_description: input.description ?? null,
      p_category_id: input.categoryId ?? null,
    }),
  })
}

export async function deleteEcho(echoId: string): Promise<void> {
  await requestJson('/rest/v1/rpc/delete_echo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_echo_id: echoId }),
  })
}

export async function getMyVoicesFeed(cursor?: string | null): Promise<PublicEcho[]> {
  return requestJson<PublicEcho[]>('/rest/v1/rpc/get_my_voices_feed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_cursor: cursor ?? null, p_limit: 12 }),
  })
}

export async function transcribeFinalAudio(audio: Blob): Promise<string> {
  const form = new FormData()
  // O nome precisa combinar com o tipo real: o serviço de transcrição escolhe o
  // decodificador pela extensão/mimetype recebidos.
  const extension = audio.type.includes('wav') ? 'wav' : audio.type.includes('ogg') ? 'ogg' : audio.type.includes('mpeg') ? 'mp3' : 'webm'
  form.set('audio', audio, `echo-audio.${extension}`)
  const result = await requestJson<{ text: string }>('/functions/v1/transcribe-audio', { method: 'POST', body: form })
  return result.text
}

export async function generateEchoHook(transcription: string): Promise<{ hook: string; source: 'llm' | 'local' }> {
  const result = await requestJson<{ hook: string; source?: 'llm' | 'local' }>('/functions/v1/generate-echo-hook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcription }),
  })
  return { hook: result.hook, source: result.source ?? 'local' }
}

export async function publishEcho(draft: EchoDraft): Promise<{ id: string; moderation_status: string; message?: string }> {
  const form = new FormData()
  const media = draft.voiceProtectionEnabled ? draft.protectedAudio?.blob : draft.audio
  if (!media) {
    // Nunca usar draft.audio como fallback quando a proteção estiver ativada.
    throw new Error('Não foi possível proteger sua voz. O áudio original não foi enviado.')
  }
  form.set('audio', media, draft.voiceProtectionEnabled ? 'protected-echo.wav' : 'echo.webm')
  form.set('duration', String(draft.duration))
  form.set('identity_mode', draft.identityMode)
  form.set('category_id', draft.categoryId)
  form.set('expiration', draft.expiration)
  form.set('voice_protection_enabled', String(draft.voiceProtectionEnabled))
  form.set('voice_protection_verified', String(draft.protectedAudio?.processed === true))
  if (draft.voiceId) form.set('voice_id', draft.voiceId)
  if (draft.replyToId) form.set('parent_echo_id', draft.replyToId)
  if (draft.voiceProtectionEnabled) form.set('voice_protection_preset', draft.voiceProtectionPreset)
  if (draft.title.trim()) form.set('title', draft.title.trim())
  if (draft.description.trim()) form.set('description', draft.description.trim())
  if (draft.transcription?.trim()) form.set('transcription', draft.transcription.trim())

  return requestJson<{ id: string; moderation_status: string; message?: string }>('/functions/v1/publish-echo', {
    method: 'POST',
    body: form,
  })
}

export async function getMyVoice(): Promise<{ id: string; handle: string; display_name: string; avatar_seed: string; bio: string | null; indexable: boolean } | null> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return null
  const voices = await requestJson<Array<{ id: string; handle: string; display_name: string; avatar_seed: string; bio: string | null; indexable: boolean }>>(
    `/rest/v1/voices?select=id,handle,display_name,avatar_seed,bio,indexable&owner_user_id=eq.${encodeURIComponent(userData.user.id)}&limit=1`,
  )
  return voices[0] ?? null
}

export async function createVoice(input: { handle: string; displayName: string; bio?: string }): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Autenticação obrigatória.')
  const handle = input.handle.startsWith('@') ? input.handle.toLowerCase() : `@${input.handle.toLowerCase()}`
  await requestJson('/rest/v1/voices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      owner_user_id: userData.user.id,
      handle,
      display_name: input.displayName.trim(),
      bio: input.bio?.trim() || null,
    }),
  })
}

export async function updateMyVoice(voiceId: string, input: { displayName: string; bio: string }): Promise<void> {
  await requestJson(`/rest/v1/voices?id=eq.${encodeURIComponent(voiceId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ display_name: input.displayName.trim(), bio: input.bio.trim() || null }),
  })
}

export async function getPublicVoice(handle: string): Promise<PublicVoice | null> {
  const rows = await requestJson<PublicVoice[]>('/rest/v1/rpc/get_public_voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_handle: handle.startsWith('@') ? handle : `@${handle}` }),
  })
  return rows[0] ?? null
}

export async function getPublicVoiceEchoes(handle: string): Promise<Array<Pick<PublicEcho, 'id' | 'title' | 'description' | 'audio_url' | 'duration' | 'expires_at' | 'created_at'> & { category_name: string | null }>> {
  return requestJson('/rest/v1/rpc/get_public_voice_echoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_handle: handle.startsWith('@') ? handle : `@${handle}` }),
  })
}

export async function isVoiceFollowing(voiceId: string): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return false
  const rows = await requestJson<Array<{ voice_id: string }>>(`/rest/v1/voice_follows?select=voice_id&follower_user_id=eq.${encodeURIComponent(userData.user.id)}&voice_id=eq.${encodeURIComponent(voiceId)}&limit=1`)
  return rows.length > 0
}

export async function setVoiceFollow(voiceId: string, follow: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Entre para seguir uma Voice.')
  if (follow) {
    await requestJson('/rest/v1/voice_follows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ follower_user_id: userData.user.id, voice_id: voiceId }),
    })
    return
  }
  await requestJson(`/rest/v1/voice_follows?follower_user_id=eq.${encodeURIComponent(userData.user.id)}&voice_id=eq.${encodeURIComponent(voiceId)}`, {
    method: 'DELETE',
  })
}

export async function createReport(echoId: string, reason: 'harassment' | 'threat' | 'doxxing' | 'sexual_content' | 'minor_safety' | 'hate' | 'spam' | 'self_harm' | 'illegal_activity' | 'other', description?: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Entre para denunciar um Echo.')
  await requestJson('/rest/v1/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ audio_id: echoId, reporter_id: userData.user.id, reason, description: description?.trim() || null }),
  })
}

export async function blockVoice(voiceId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Entre para bloquear uma Voice.')
  await requestJson('/rest/v1/user_blocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ blocker_user_id: userData.user.id, blocked_voice_id: voiceId }),
  })
}

export async function setReaction(echoId: string, reaction: EchoReactionType): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Entre para reagir.')
  await requestJson('/rest/v1/echo_reactions?on_conflict=echo_id,user_id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ echo_id: echoId, user_id: userData.user.id, reaction_type: reaction }),
  })
}

export async function recordEchoEvent(echoId: string, sessionId: string, eventType: EchoEventType, position?: number): Promise<void> {
  await requestJson('/rest/v1/rpc/record_echo_event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_echo_id: echoId,
      p_session_id: sessionId,
      p_event_type: eventType,
      p_play_position: position ?? null,
      p_metadata: {},
    }),
  })
}

export async function getNotifications(): Promise<Array<{ id: string; type: 'reaction' | 'reply' | 'follow_voice' | 'voice_published' | 'community_invite'; echo_id: string | null; community_id: string | null; created_at: string; read_at: string | null }>> {
  return requestJson('/rest/v1/notifications?select=id,type,echo_id,community_id,created_at,read_at&order=created_at.desc&limit=50')
}

export async function markNotificationsRead(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return
  await requestJson(`/rest/v1/notifications?recipient_user_id=eq.${encodeURIComponent(userData.user.id)}&read_at=is.null`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ read_at: new Date().toISOString() }),
  })
}

export async function searchPublicContent(query: string): Promise<Array<{ result_type: 'voice' | 'category' | 'echo'; id: string; label: string; subtitle: string; href: string }>> {
  return requestJson('/rest/v1/rpc/search_public_content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_query: query, p_limit: 20 }),
  })
}

export async function getCommunities(): Promise<PublicCommunity[]> {
  return requestJson<PublicCommunity[]>('/rest/v1/communities?select=id,owner_voice_id,name,slug,description,avatar_url,visibility,access_type,status,created_at&status=eq.active&order=created_at.desc')
}

export async function getCommunityBySlug(slug: string): Promise<{ id: string; name: string; slug: string; description: string | null; avatar_url: string | null; visibility: 'public' | 'private'; access_type: 'free' | 'invite_only'; owner_handle: string; owner_display_name: string; member_role: 'creator' | 'admin' | 'member' | null } | null> {
  const rows = await requestJson<Array<{ id: string; name: string; slug: string; description: string | null; avatar_url: string | null; visibility: 'public' | 'private'; access_type: 'free' | 'invite_only'; owner_handle: string; owner_display_name: string; member_role: 'creator' | 'admin' | 'member' | null }>>('/rest/v1/rpc/get_community_by_slug', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_slug: slug }),
  })
  return rows[0] ?? null
}

export async function getCommunityFeed(slug: string): Promise<Array<Pick<PublicEcho, 'id' | 'public_identity' | 'voice_handle' | 'voice_display_name' | 'avatar_seed' | 'title' | 'description' | 'audio_url' | 'duration' | 'expires_at' | 'created_at'> & { category_name: string | null }>> {
  return requestJson('/rest/v1/rpc/get_community_feed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_slug: slug }),
  })
}

export async function createCommunity(input: { ownerVoiceId: string; name: string; slug: string; description: string; visibility: 'public' | 'private'; accessType: 'free' | 'invite_only' }): Promise<void> {
  await requestJson('/rest/v1/communities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      owner_voice_id: input.ownerVoiceId,
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
      description: input.description.trim() || null,
      visibility: input.visibility,
      access_type: input.accessType,
      status: 'active',
    }),
  })
}

export async function joinCommunity(communityId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Entre para participar de uma comunidade.')
  await requestJson('/rest/v1/community_members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    // role explícito: a RLS só aceita 'member' vindo do próprio usuário.
    body: JSON.stringify({ community_id: communityId, user_id: userData.user.id, role: 'member', status: 'active' }),
  })
}

/** Defesa em profundidade para evitar regressões de anonimato no cliente. */
export function assertAnonymousPayloadSafety(items: PublicEcho[]): void {
  const prohibitedKeys = ['owner_user_id', 'user_id', 'profile_id', 'username', 'account']
  for (const item of items) {
    const serialized = JSON.stringify(item)
    for (const prohibitedKey of prohibitedKeys) {
      if (serialized.includes(`"${prohibitedKey}"`)) {
        throw new Error('O feed retornou um campo privado e foi bloqueado pelo cliente.')
      }
    }
    if (item.public_identity === 'Anônimo' && item.voice_handle) {
      throw new Error('Um Echo anônimo não pode expor uma Voice.')
    }
  }
}
