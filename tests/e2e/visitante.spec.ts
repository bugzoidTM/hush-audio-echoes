import { expect, test } from '@playwright/test'
import { mockBackend } from './support/backend'

/**
 * O funil de aquisição: link compartilhado → ouve sem conta → convite.
 *
 * Pedir cadastro antes de a pessoa ouvir qualquer coisa é pedir compromisso
 * antes de mostrar valor. Estes testes existem para que uma regressão de
 * autenticação não coloque um muro na frente de quem chegou pelo WhatsApp.
 */
test.describe('visitante sem conta', () => {
  test('ouve um Echo compartilhado e recebe o convite depois do áudio', async ({ page }) => {
    const backend = await mockBackend(page)
    backend.moderationStatus = 'approved'

    await page.goto(`/e/${backend.ids.echoId}`)

    // O Echo toca: nada de muro antes de mostrar o valor.
    await expect(page.getByRole('heading', { name: 'Um Echo de teste' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Ouvir Echo' })).toBeVisible()

    // O convite vem depois, junto do áudio — não no lugar dele.
    await expect(page.getByRole('heading', { name: /gostou de ouvir/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /continuar ouvindo/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /criar conta grátis/i })).toBeVisible()

    // Público não é indexado: desabafo não fica arquivado em buscador.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })

  test('interagir sem conta leva ao cadastro, não a um erro', async ({ page }) => {
    const backend = await mockBackend(page)
    backend.moderationStatus = 'approved'

    await page.goto(`/e/${backend.ids.echoId}`)
    await page.getByRole('button', { name: 'Eu também' }).click()
    await expect(page).toHaveURL(/\/auth/, { timeout: 15_000 })
  })

  test('a prévia libera alguns Echoes e então convida a criar conta', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/ouvir')

    await expect(page.getByText(/prévia · 1 de 3/i)).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /ouvir outro echo/i }).click()
    await expect(page.getByText(/prévia · 2 de 3/i)).toBeVisible()
    await page.getByRole('button', { name: /ouvir outro echo/i }).click()

    // Acabou a prévia: o convite é a continuação natural, não um erro.
    await expect(page.getByRole('heading', { name: /você encontrou o shhhh/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('link', { name: /criar conta grátis/i })).toBeVisible()
  })

  test('lê os documentos sem precisar de conta', async ({ page }) => {
    await mockBackend(page)
    // Ninguém deveria precisar de conta para ler os termos aos quais será
    // submetido, nem a política antes de decidir se entra.
    for (const [rota, titulo] of [
      ['/termos', /termos de uso/i],
      ['/privacidade', /política de privacidade/i],
      ['/diretrizes', /diretrizes da comunidade/i],
    ] as const) {
      await page.goto(rota)
      await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible({ timeout: 15_000 })
    }
    // O ponto do produto que mais confunde precisa estar escrito: anônimo é
    // perante outras pessoas, não perante o serviço.
    await page.goto('/termos')
    await expect(page.getByText(/não significa que o shhhh não saiba quem publicou/i)).toBeVisible()
    await expect(page.getByText(/18 anos ou mais/i).first()).toBeVisible()
  })

  test('consegue falar com o shhhh sem ter conta', async ({ page }) => {
    const backend = await mockBackend(page)
    // O canal de exercício de direitos precisa funcionar para quem não tem (ou
    // não consegue mais ter) conta — inclusive para pedir exclusão de dados.
    await page.goto('/contato')

    const enviar = page.getByRole('button', { name: /enviar mensagem/i })
    await expect(enviar).toBeDisabled()

    await page.getByLabel('Mensagem').fill('Gostaria de saber quais dados vocês guardam sobre mim e como apagá-los.')
    await expect(enviar).toBeEnabled()
    await enviar.click()

    await expect(page.getByText(/recebemos sua mensagem/i)).toBeVisible({ timeout: 15_000 })
    expect(backend.contatoEnviado).toBe(true)
  })

  test('quem clica em criar conta chega na aba de cadastro', async ({ page }) => {
    const backend = await mockBackend(page)
    backend.moderationStatus = 'approved'

    // Chegar na aba Entrar depois de clicar em "Criar conta grátis" é pequeno
    // tecnicamente e caro em conversão: é o passo mais frágil do funil.
    await page.goto(`/e/${backend.ids.echoId}`)
    await page.getByRole('link', { name: /criar conta grátis/i }).click()
    await expect(page).toHaveURL(/\/auth\?mode=signup/)
    await expect(page.getByRole('tab', { name: /cadastrar/i })).toHaveAttribute('data-state', 'active')

    // E "Entrar" continua abrindo em entrar.
    await page.goto('/auth?mode=signin')
    await expect(page.getByRole('tab', { name: 'Entrar' })).toHaveAttribute('data-state', 'active')
  })

  test('a landing manda o visitante ouvir, não se cadastrar', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await page.getByRole('button', { name: /ouvir agora, sem cadastro/i }).click()
    await expect(page).toHaveURL(/\/ouvir/)
  })
})
