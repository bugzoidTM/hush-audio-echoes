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

  it('explica a falha do captcha em vez de mostrar o erro cru do servidor', () => {
    // O GoTrue devolve "captcha verification process failed" (500) quando o
    // token não chega e "captcha protection: request disallowed" (400) quando
    // ele é inválido. Os dois viram a mesma instrução acionável.
    expect(authErrorMessage(new Error('captcha verification process failed')))
      .toMatch(/verificação de segurança/i)
    expect(authErrorMessage(new Error('captcha protection: request disallowed (invalid-input-response)')))
      .toMatch(/verificação de segurança/i)
  })
})
