/**
 * Chamada provisória calculada no próprio navegador: a primeira frase da
 * transcrição. Serve para preencher o título na hora — o modelo gratuito da VPS
 * leva dezenas de segundos e nem sempre responde a tempo.
 */
export function localHookFromTranscription(transcription: string): string {
  const normalized = transcription.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] ?? normalized
  const clean = firstSentence.replace(/^["'“”]+|["'“”]+$/g, '').trim()
  if (clean.length <= 140) return clean
  return `${clean.slice(0, 137).trimEnd()}…`
}
