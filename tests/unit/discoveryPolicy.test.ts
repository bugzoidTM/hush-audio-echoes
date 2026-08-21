import { describe, expect, it } from 'vitest'
import { calculateDiscoveryScore, canPublishWithProtection, enforceBatchDiversity, isDiscoveryDurationValid, resolvePublicIdentity } from '@/features/echoes/services/discoveryPolicy'
import type { PublicEcho } from '@/features/echoes/types'

const echo = (id: string, voice: string | null, category = 'segredos'): PublicEcho => ({
  id,
  public_identity: voice ? 'Voice Teste' : 'Anônimo',
  voice_handle: voice,
  voice_display_name: voice ? 'Voice Teste' : null,
  avatar_seed: voice ? 'seed' : null,
  category_slug: category,
  category_name: 'Segredos',
  title: 'Uma chamada',
  description: null,
  audio_url: 'https://example.test/audio.webm',
  duration: 20,
  expires_at: null,
  voice_protection_enabled: false,
  voice_protection_preset: null,
  reaction_counts: {},
  reply_count: 0,
  created_at: '2026-08-21T00:00:00.000Z',
  next_cursor: '2026-08-21T00:00:00.000Z',
})

describe('Discovery policy', () => {
  it('aceita apenas Echoes entre 5 e 60 segundos', () => {
    expect(isDiscoveryDurationValid(4)).toBe(false)
    expect(isDiscoveryDurationValid(5)).toBe(true)
    expect(isDiscoveryDurationValid(45)).toBe(true)
    expect(isDiscoveryDurationValid(60)).toBe(true)
    expect(isDiscoveryDurationValid(61)).toBe(false)
  })

  it('não usa follower count para a pontuação', () => {
    const base = { freshness: 1, completionRate: 0.7, meaningfulReactionRate: 0.2, replyRate: 0.1, followConversion: 0.05, explorationBonus: 1, earlySkipRate: 0.1, reportRate: 0 }
    expect(calculateDiscoveryScore({ ...base, followerCount: 0 })).toBe(calculateDiscoveryScore({ ...base, followerCount: 10_000 }))
  })

  it('limita dois Echoes por Voice e preserva anônimos como entidades distintas', () => {
    const batch = [echo('1', '@uma'), echo('2', '@uma'), echo('3', '@uma'), echo('4', null), echo('5', null)]
    const result = enforceBatchDiversity(batch)
    expect(result.map((item) => item.id)).toEqual(['1', '2', '4', '5'])
  })

  it('remove todos os dados de Voice de um Echo anônimo', () => {
    expect(resolvePublicIdentity({ public_identity: 'Anônimo', voice_handle: '@nao-expor', voice_display_name: 'Não expor', avatar_seed: 'private' }))
      .toEqual({ public_identity: 'Anônimo', voice_handle: null, voice_display_name: null, avatar_seed: null })
  })

  it('requer resultado processado para publicação protegida', () => {
    expect(canPublishWithProtection(null)).toBe(false)
    expect(canPublishWithProtection({ processed: true, preset: 'shadow' })).toBe(true)
  })
})
