/**
 * O cadastro pede um nome e, até aqui, ele morria nos metadados do GoTrue:
 * nenhuma tela lia, nenhum perfil era criado, e o onboarding ainda oferecia um
 * @ aleatório ("vozk9x2mq"). Quem escrevia "Compositor" no cadastro procurava
 * esse nome depois e não achava.
 *
 * A conta continua separada da Voice — é o que sustenta o anonimato — mas o
 * nome digitado passa a ser a sugestão inicial da Voice, e não lixo.
 */
export interface VoiceSuggestion {
  displayName: string
  handle: string
}

const handlePattern = /^[a-z0-9_]{3,30}$/

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

/** Slug compatível com a restrição do banco: `^@[a-z0-9_]{3,30}$`. */
export function handleFromName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30)
  // Curto demais vira sugestão aleatória: melhor um @ estranho que um @ inválido.
  if (!handlePattern.test(slug)) return `voz${randomSuffix()}`
  return slug
}

/**
 * Sugestão a partir do nome escolhido no cadastro. Sem nome utilizável, cai no
 * aleatório de antes — a Voice nunca fica bloqueada por causa disto.
 */
export function suggestVoice(accountName: string | null | undefined): VoiceSuggestion {
  const trimmed = (accountName ?? '').replace(/^@/, '').trim()
  if (trimmed.length < 2) {
    return { displayName: `Voz ${Math.random().toString(16).slice(2, 6).toUpperCase()}`, handle: `voz${randomSuffix()}` }
  }
  return { displayName: trimmed.slice(0, 60), handle: handleFromName(trimmed) }
}
