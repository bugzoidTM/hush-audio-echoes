import { describe, expect, it } from 'vitest'
import { authErrorMessage } from '@/features/auth/authMessages'

describe('authErrorMessage', () => {
  it('traduz credenciais inválidas', () => {
    expect(authErrorMessage(new Error('Invalid login credentials')))
      .toBe('E-mail ou senha incorretos. Confira os dois e tente de novo.')
  })

  it('traduz e-mail já cadastrado', () => {
    expect(authErrorMessage(new Error('User already registered'))).toMatch(/Já existe uma conta/)
  })

  it('mantém mensagens desconhecidas', () => {
    expect(authErrorMessage(new Error('Algo bem específico'))).toBe('Algo bem específico')
  })

  it('tem um texto padrão quando não há mensagem', () => {
    expect(authErrorMessage(null)).toBe('Não foi possível concluir. Tente novamente.')
  })
})
