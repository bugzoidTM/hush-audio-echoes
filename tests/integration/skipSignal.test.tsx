import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EchoPlayer } from '@/components/hush/EchoPlayer'

const trackEchoEvent = vi.fn()
vi.mock('@/features/analytics/services/analytics', () => ({
  trackEchoEvent: (...args: unknown[]) => trackEchoEvent(...args),
}))

/**
 * O ranking do Discovery pesa -0.20 pela taxa de skip, mas o evento nunca era
 * emitido: sair do card só pausava o áudio. Estes testes existem para que o
 * sinal negativo mais importante do feed não volte a morrer em silêncio.
 */
function renderPlayer(active: boolean) {
  return render(<EchoPlayer echoId="11111111-1111-1111-1111-111111111111" audioUrl="https://exemplo.test/a.webm" duration={100} active={active} />)
}

// jsdom não implementa play(); sem isto o clique no botão rejeita.
function stubPlayback(container: HTMLElement, currentTime: number) {
  const audio = container.querySelector('audio') as HTMLAudioElement
  audio.play = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(audio, 'paused', { value: true, configurable: true })
  Object.defineProperty(audio, 'currentTime', { value: currentTime, writable: true, configurable: true })
  return audio
}

describe('sinal de skip do Discovery', () => {
  beforeEach(() => trackEchoEvent.mockClear())

  it('conta skip quando a pessoa sai antes de 70% do Echo', async () => {
    const view = renderPlayer(true)
    const audio = stubPlayback(view.container, 30)
    view.getByLabelText('Ouvir Echo').click()
    await vi.waitFor(() => expect(trackEchoEvent).toHaveBeenCalledWith(expect.any(String), 'play_start', 0))
    audio.dispatchEvent(new Event('timeupdate'))

    view.rerender(<EchoPlayer echoId="11111111-1111-1111-1111-111111111111" audioUrl="https://exemplo.test/a.webm" duration={100} active={false} />)
    expect(trackEchoEvent).toHaveBeenCalledWith(expect.any(String), 'skip', expect.any(Number))
  })

  it('não conta skip depois de 70% ouvido', async () => {
    const view = renderPlayer(true)
    const audio = stubPlayback(view.container, 80)
    view.getByLabelText('Ouvir Echo').click()
    await vi.waitFor(() => expect(trackEchoEvent).toHaveBeenCalledWith(expect.any(String), 'play_start', 0))
    audio.dispatchEvent(new Event('timeupdate'))

    view.rerender(<EchoPlayer echoId="11111111-1111-1111-1111-111111111111" audioUrl="https://exemplo.test/a.webm" duration={100} active={false} />)
    expect(trackEchoEvent).not.toHaveBeenCalledWith(expect.any(String), 'skip', expect.anything())
  })

  it('não conta skip em card que nunca foi tocado', () => {
    const view = renderPlayer(true)
    view.rerender(<EchoPlayer echoId="11111111-1111-1111-1111-111111111111" audioUrl="https://exemplo.test/a.webm" duration={100} active={false} />)
    expect(trackEchoEvent).not.toHaveBeenCalledWith(expect.any(String), 'skip', expect.anything())
  })
})
