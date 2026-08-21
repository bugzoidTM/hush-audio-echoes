import { beforeEach, describe, expect, it, vi } from 'vitest'
import { publishEcho } from '@/features/echoes/services/hushApi'
import type { EchoDraft } from '@/features/echoes/types'

const draft: EchoDraft = {
  audio: new Blob(['original-audio'], { type: 'audio/webm' }),
  duration: 18,
  identityMode: 'anonymous',
  voiceId: null,
  categoryId: 'category-id',
  title: 'Uma história',
  description: '',
  expiration: '24h',
  transcription: null,
  voiceProtectionEnabled: true,
  voiceProtectionPreset: 'shadow',
  protectedAudio: null,
}

describe('Protect My Voice fail-closed', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('não envia áudio quando a transformação falha', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await expect(publishEcho(draft)).rejects.toThrow('O áudio original não foi enviado')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
