import { describe, expect, it } from 'vitest'
import { localHookFromTranscription } from '@/features/echoes/services/hookText'

describe('localHookFromTranscription', () => {
  it('usa a primeira frase da transcrição', () => {
    expect(localHookFromTranscription('Pedi demissão no dia da promoção. Ninguém soube.'))
      .toBe('Pedi demissão no dia da promoção.')
  })

  it('devolve string vazia quando não há transcrição', () => {
    expect(localHookFromTranscription('   ')).toBe('')
  })

  it('corta chamadas longas mantendo o limite de 140 caracteres', () => {
    const hook = localHookFromTranscription(`${'palavra '.repeat(40)}fim`)
    expect(hook.length).toBeLessThanOrEqual(140)
    expect(hook.endsWith('…')).toBe(true)
  })

  it('remove aspas nas pontas e normaliza espaços', () => {
    expect(localHookFromTranscription('"  Nunca   contei isso  "')).toBe('Nunca contei isso')
  })
})
