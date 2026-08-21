import type { PublicEcho, VoiceProtectionPreset } from '../types'

export const DISCOVERY_DURATION = { minimum: 5, maximum: 60 } as const

export interface RankingSignals {
  freshness: number
  completionRate: number
  meaningfulReactionRate: number
  replyRate: number
  followConversion: number
  explorationBonus: number
  earlySkipRate: number
  reportRate: number
  followerCount?: number
}

export function isDiscoveryDurationValid(duration: number): boolean {
  return Number.isFinite(duration) && duration >= DISCOVERY_DURATION.minimum && duration <= DISCOVERY_DURATION.maximum
}

export function calculateDiscoveryScore(signals: RankingSignals): number {
  return (
    0.15 * signals.freshness +
    0.25 * signals.completionRate +
    0.15 * signals.meaningfulReactionRate +
    0.1 * signals.replyRate +
    0.2 * signals.followConversion +
    0.15 * signals.explorationBonus -
    0.2 * signals.earlySkipRate -
    0.6 * signals.reportRate
  )
}

export function enforceBatchDiversity(echoes: PublicEcho[]): PublicEcho[] {
  const perVoice = new Map<string, number>()
  const perCategory = new Map<string, number>()
  return echoes.filter((echo) => {
    const voiceKey = echo.voice_handle ?? `anonymous:${echo.id}`
    const categoryKey = echo.category_slug ?? 'uncategorized'
    const voiceCount = perVoice.get(voiceKey) ?? 0
    const categoryCount = perCategory.get(categoryKey) ?? 0
    if (voiceCount >= 2 || categoryCount >= 5) return false
    perVoice.set(voiceKey, voiceCount + 1)
    perCategory.set(categoryKey, categoryCount + 1)
    return true
  })
}

export function resolvePublicIdentity(input: Pick<PublicEcho, 'public_identity' | 'voice_handle' | 'voice_display_name' | 'avatar_seed'>): Pick<PublicEcho, 'public_identity' | 'voice_handle' | 'voice_display_name' | 'avatar_seed'> {
  if (input.public_identity === 'Anônimo') {
    return { public_identity: 'Anônimo', voice_handle: null, voice_display_name: null, avatar_seed: null }
  }
  return input
}

export function canPublishWithProtection(protectedAudio: { processed: true; preset: VoiceProtectionPreset } | null): boolean {
  return protectedAudio?.processed === true
}
