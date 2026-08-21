import { describe, expect, it } from 'vitest'
import { assertAnonymousPayloadSafety } from '@/features/echoes/services/hushApi'
import type { PublicEcho } from '@/features/echoes/types'

const anonymousEcho: PublicEcho = {
  id: 'echo-1',
  public_identity: 'Anônimo',
  voice_handle: null,
  voice_display_name: null,
  avatar_seed: null,
  category_slug: 'segredos',
  category_name: 'Segredos',
  title: 'Algo que ninguém sabe',
  description: null,
  audio_url: 'https://storage.test/echo-audio/published/2fa47a75.webm',
  duration: 20,
  expires_at: null,
  voice_protection_enabled: true,
  voice_protection_preset: 'shadow',
  reaction_counts: {},
  reply_count: 0,
  created_at: '2026-08-21T00:00:00.000Z',
  next_cursor: '2026-08-21T00:00:00.000Z',
}

describe('Anonymous Echo payload', () => {
  it('aceita o payload público sem identificador de conta', () => {
    expect(() => assertAnonymousPayloadSafety([anonymousEcho])).not.toThrow()
    expect(JSON.stringify(anonymousEcho)).not.toContain('owner_user_id')
    expect(anonymousEcho.audio_url).not.toContain('user-')
  })

  it('bloqueia owner_user_id vazado por regressão de API', () => {
    const leaked = { ...anonymousEcho, owner_user_id: 'account-uuid-must-not-leak' }
    expect(() => assertAnonymousPayloadSafety([leaked as PublicEcho])).toThrow('campo privado')
  })

  it('bloqueia Voice vinculada a um Echo marcado como anônimo', () => {
    const leakedVoice = { ...anonymousEcho, voice_handle: '@identidade-privada' }
    expect(() => assertAnonymousPayloadSafety([leakedVoice])).toThrow('não pode expor uma Voice')
  })
})
