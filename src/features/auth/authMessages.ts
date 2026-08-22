/**
 * Traduz as mensagens do GoTrue. Sem isto a tela mostrava o texto cru em inglês
 * ("Invalid login credentials"), que não diz à pessoa o que fazer em seguida.
 */
const messages: Array<{ match: RegExp; text: string }> = [
  { match: /invalid login credentials/i, text: 'E-mail ou senha incorretos. Confira os dois e tente de novo.' },
  { match: /email not confirmed/i, text: 'Esta conta ainda não foi confirmada. Fale com o suporte para liberá-la.' },
  { match: /user already registered|already been registered/i, text: 'Já existe uma conta com este e-mail. Entre em vez de criar outra.' },
  { match: /password should be at least/i, text: 'A senha precisa ter pelo menos 6 caracteres.' },
  { match: /unable to validate email|invalid format/i, text: 'Confira o e-mail digitado.' },
  { match: /signups? not allowed/i, text: 'O cadastro está desativado no momento.' },
  { match: /rate limit|too many requests/i, text: 'Muitas tentativas seguidas. Espere um minuto e tente de novo.' },
  { match: /database error/i, text: 'Não foi possível criar sua conta agora. Tente novamente em instantes.' },
  { match: /failed to fetch|networkerror/i, text: 'Sem conexão com o servidor. Verifique sua internet.' },
]

export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const known = messages.find(({ match }) => match.test(raw))
  if (known) return known.text
  return raw || 'Não foi possível concluir. Tente novamente.'
}
