import { describe, expect, it } from 'vitest'
import { handleFromName, suggestVoice } from '@/features/echoes/voiceSuggestion'

describe('sugestão de Voice a partir do nome do cadastro', () => {
  it('usa o nome escolhido no cadastro em vez de um aleatório', () => {
    const suggestion = suggestVoice('Compositor')
    expect(suggestion.displayName).toBe('Compositor')
    expect(suggestion.handle).toBe('compositor')
  })

  it('aceita o nome com @ na frente, como as pessoas costumam digitar', () => {
    expect(suggestVoice('@Compositor').handle).toBe('compositor')
  })

  it('respeita a restrição do banco para acentos e espaços', () => {
    expect(handleFromName('João da Silva')).toBe('joao_da_silva')
    expect(handleFromName('Anônimo!!')).toBe('anonimo')
  })

  it('cai no aleatório quando o nome não dá um @ válido', () => {
    expect(handleFromName('??')).toMatch(/^voz[a-z0-9]{4,6}$/)
    expect(suggestVoice('').handle).toMatch(/^voz[a-z0-9]{4,6}$/)
    expect(suggestVoice(null).displayName).toMatch(/^Voz [0-9A-F]{4}$/)
  })

  it('não estoura os limites de tamanho do banco', () => {
    const long = 'a'.repeat(80)
    expect(suggestVoice(long).displayName.length).toBeLessThanOrEqual(60)
    expect(suggestVoice(long).handle.length).toBeLessThanOrEqual(30)
  })
})
