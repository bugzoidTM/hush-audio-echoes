import { expect, test } from '@playwright/test'

test('apresenta a proposta do shhhh e CTAs principais', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/shhhh/i)
  await expect(page.getByRole('heading', { name: 'Ouça o que ninguém conta.' })).toBeVisible()
  // Visitante é convidado a OUVIR, não a se cadastrar: o conteúdo é que vende.
  await expect(page.getByRole('button', { name: /ouvir agora, sem cadastro/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /contar algo/i })).toBeVisible()
})

test('redireciona caminhos legados para a experiência Echoes', async ({ page }) => {
  await page.goto('/shhhh')
  await expect(page).toHaveURL(/\/auth$/)
})
