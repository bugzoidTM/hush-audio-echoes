import { describe, expect, it } from 'vitest'
import { formatTimeLeft, refreshIntervalFor } from '@/features/echoes/expiration'

const now = Date.parse('2026-08-23T12:00:00Z')
const inFuture = (ms: number) => new Date(now + ms).toISOString()

describe('contagem regressiva de expiração', () => {
  it('não arredonda minutos para cima virando horas', () => {
    // O rótulo antigo exibia "1h restantes" faltando 2 minutos.
    expect(formatTimeLeft(inFuture(2 * 60_000), now)).toBe('2min restantes')
  })

  it('conta em segundos no último minuto', () => {
    expect(formatTimeLeft(inFuture(45_000), now)).toBe('45s restantes')
  })

  it('mostra horas e minutos, e dias com horas', () => {
    expect(formatTimeLeft(inFuture(3 * 3_600_000 + 20 * 60_000), now)).toBe('3h 20min restantes')
    expect(formatTimeLeft(inFuture(6 * 24 * 3_600_000 + 5 * 3_600_000), now)).toBe('6d 5h restantes')
  })

  it('diz Permanente e Expirado nos extremos', () => {
    expect(formatTimeLeft(null, now)).toBe('Permanente')
    expect(formatTimeLeft(inFuture(-1_000), now)).toBe('Expirado')
  })

  it('acelera o relógio só quando falta pouco', () => {
    expect(refreshIntervalFor(inFuture(30_000), now)).toBe(1_000)
    expect(refreshIntervalFor(inFuture(10 * 60_000), now)).toBe(30_000)
    expect(refreshIntervalFor(inFuture(5 * 3_600_000), now)).toBe(60_000)
    expect(refreshIntervalFor(null, now)).toBeNull()
    expect(refreshIntervalFor(inFuture(-1), now)).toBeNull()
  })
})
