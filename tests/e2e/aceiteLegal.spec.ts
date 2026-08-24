import { expect, test } from '@playwright/test'
import { mockBackend } from './support/backend'

/**
 * Guarda de aceite. Registrar no cadastro não basta: conta criada antes dos
 * documentos existirem — ou cujo registro falhou calado — seguia usando tudo.
 * E é aqui que um futuro Termos 2.0 será pedido.
 */
test('conta sem aceite vigente é parada até aceitar', async ({ page }) => {
  // O caminho inteiro (cadastro, reload, aceite) não cabe nos 30s padrão.
  test.setTimeout(120_000)
  const backend = await mockBackend(page)
  backend.moderationStatus = 'approved'

  // Sessão pronta: entra direto no produto, sem passar pelo cadastro.
  await page.goto('/auth?mode=signup')
  const signup = page.locator('form').filter({ has: page.locator('#username') })
  await signup.locator('#username').fill('Compositor')
  await signup.locator('#email').fill('compositor@example.invalid')
  await signup.locator('#password').fill('SenhaDeTeste123!')
  await signup.locator('#confirmPassword').fill('SenhaDeTeste123!')
  await signup.locator('input[name="aceite"]').check()

  // O cadastro dispara o registro do aceite sem esperar por ele (`void`). Se o
  // teste zerar o aceite antes de esse POST chegar ao mock, o handler grava
  // `true` depois e o gate — corretamente — não aparece: a suíte falhava assim
  // ~1 em 3 execuções. Esperar a resposta tira a corrida.
  const aceiteDoCadastro = page.waitForResponse((r) => r.url().includes('/rpc/record_legal_acceptance'))
  await signup.getByRole('button', { name: /criar conta|cadastrar/i }).click()

  await expect(page).toHaveURL(/\/app\//, { timeout: 20_000 })
  await aceiteDoCadastro

  // Cenário real: a conta existe e em dia, e então sai uma versão nova dos
  // documentos. É exatamente o que o gate precisa pegar — o cadastro sozinho
  // não cobre isso, porque ele registra o aceite ao criar a conta.
  backend.aceiteRegistrado = false
  await page.reload()

  const gate = page.getByRole('dialog').filter({ hasText: /antes de continuar/i })
  await expect(gate).toBeVisible({ timeout: 20_000 })
  // Sem saída pelo Esc: aceitar ou sair da conta.
  await page.keyboard.press('Escape')
  await expect(gate).toBeVisible()

  await gate.getByRole('button', { name: /aceitar e continuar/i }).click()
  await expect(gate).toBeHidden({ timeout: 15_000 })
  expect(backend.aceiteRegistrado).toBe(true)
})
