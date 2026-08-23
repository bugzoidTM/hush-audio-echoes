/**
 * Soft gate da prévia: quantos Echoes um visitante ouve antes do convite.
 *
 * Deliberadamente do lado do cliente. O conteúdo é público por decisão de
 * produto (o link compartilhado precisa tocar para quem não tem conta), então
 * não há nada a trancar aqui — o objetivo é converter no momento certo, não
 * impedir. Quem limpar o navegador ouve mais; tudo bem.
 */
const storageKey = 'shhhh:previa-ouvida'

export const PREVIEW_LIMIT = 3

function read(): string[] {
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    // Navegador com armazenamento bloqueado não pode quebrar a audição.
    return []
  }
}

export function heardEchoes(): string[] {
  return read()
}

export function rememberHeard(echoId: string): string[] {
  const current = read()
  if (current.includes(echoId)) return current
  const next = [...current, echoId].slice(-50)
  try {
    localStorage.setItem(storageKey, JSON.stringify(next))
  } catch {
    // Sem armazenamento o gate simplesmente não conta — não é fronteira.
  }
  return next
}

export function reachedPreviewLimit(): boolean {
  return read().length >= PREVIEW_LIMIT
}
