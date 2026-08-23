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

  test('a landing manda o visitante ouvir, não se cadastrar', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await page.getByRole('button', { name: /ouvir agora, sem cadastro/i }).click()
    await expect(page).toHaveURL(/\/ouvir/)
  })
})
