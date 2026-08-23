import { expect, test } from '@playwright/test'
import { callsTo, mockBackend } from './support/backend'

/**
 * O caminho que um usuário novo percorre inteiro, numa corrida só:
 * cadastro → onboarding → gravação → Protect My Voice → publicação →
 * moderação → Discovery → reação → seguir Voice → responder.
 *
 * Cada passo aqui já quebrou pelo menos uma vez nesta base — a rota de
 * Communities montada sem flag, o play que não tocava, o "Echo não disponível"
 * logo depois de publicar. É por isso que o teste é um fluxo só, e não dez
 * testes isolados: o que quebra é a costura entre as telas.
 */
test('fluxo completo: do cadastro à resposta', async ({ page }) => {
  const backend = await mockBackend(page)
  test.setTimeout(120_000)

  // --- Cadastro ------------------------------------------------------------
  await page.goto('/auth')
  await page.getByRole('tab', { name: /cadastr/i }).click()

  const signup = page.locator('form').filter({ has: page.locator('#username') })
  await signup.locator('#username').fill('Compositor')
  await signup.locator('#email').fill('compositor@example.invalid')
  await signup.locator('#password').fill('SenhaDeTeste123!')
  await signup.locator('#confirmPassword').fill('SenhaDeTeste123!')
  await signup.getByRole('button', { name: /criar conta|cadastrar/i }).click()

  // --- Onboarding ----------------------------------------------------------
  await expect(page).toHaveURL(/\/app\/onboarding/, { timeout: 20_000 })
  await page.getByRole('button', { name: /escolher assuntos/i }).click()

  for (const assunto of ['Desabafo', 'Amor', 'Trabalho']) {
    await page.getByRole('button', { name: assunto, exact: true }).click()
  }
  await page.getByRole('button', { name: /continuar/i }).click()

  // O nome do cadastro vira a sugestão da Voice — antes vinha um @ aleatório.
  await expect(page.getByLabel('Nome da Voice')).toHaveValue('Compositor')
  await expect(page.getByLabel('Handle da Voice')).toHaveValue('compositor')
  await page.getByRole('button', { name: /criar e entrar/i }).click()

  await expect(page).toHaveURL(/\/app\/echoes/, { timeout: 20_000 })
  expect(backend.voiceCreated).toBe(true)

  // Communities está congelada atrás da flag: não pode aparecer na navegação.
  await expect(page.getByRole('link', { name: /communities/i })).toHaveCount(0)

  // --- Gravação ------------------------------------------------------------
  // O botão da barra, não o do estado vazio do feed (os dois se chamam igual).
  await page.getByLabel('Criar Echo', { exact: true }).click()
  const modal = page.getByRole('dialog').first()
  await modal.getByRole('button', { name: /começar a gravar/i }).click()

  // A contagem regressiva é o limite dito em voz alta: sem ela a gravação
  // morria sozinha aos 60 s e ninguém sabia por quê.
  const contador = modal.getByRole('timer')
  await expect(contador).toBeVisible()
  await expect(contador).toContainText(/restantes de 60s/)
  const primeiraLeitura = await contador.innerText()
  await expect(async () => {
    expect(await contador.innerText()).not.toBe(primeiraLeitura)
  }).toPass({ timeout: 5_000 })

  await page.waitForTimeout(6_000) // passa do mínimo de 5 s
  await modal.getByRole('button', { name: /parar gravação/i }).click()
  await expect(modal.getByText(/seu preview ·/i)).toBeVisible({ timeout: 15_000 })

  // --- Protect My Voice ----------------------------------------------------
  await modal.getByLabel('Protect My Voice').click()
  await modal.getByRole('button', { name: /gerar preview protegido/i }).click()
  // O sinal confiável é o próprio botão: ele vira "Gerar novo preview" quando o
  // preview protegido existe. Publicar com Protect ligado depende disso — sem
  // preview, o botão de publicar fica desabilitado (fail closed).
  await expect(modal.getByRole('button', { name: /gerar novo preview/i })).toBeVisible({ timeout: 60_000 })

  // --- Publicação ----------------------------------------------------------
  await modal.getByRole('button', { name: /publicar echo/i }).click()

  // Publicar deixou de significar "no ar": o Echo nasce em análise.
  await expect(page).toHaveURL(new RegExp(`/e/${backend.ids.echoId}`), { timeout: 20_000 })
  await expect(page.getByRole('heading', { name: /em análise/i })).toBeVisible({ timeout: 15_000 })
  expect(callsTo(backend, '/functions/v1/publish-echo')).toHaveLength(1)

  // --- Moderação aprova ----------------------------------------------------
  backend.moderationStatus = 'approved'
  await page.goto('/app/echoes')

  // --- Discovery -----------------------------------------------------------
  const card = page.locator('[data-echo-id]').first()
  await expect(card).toBeVisible({ timeout: 20_000 })
  await expect(card.getByRole('heading', { name: 'Um Echo de teste' })).toBeVisible()

  // Transcrição do servidor, não a descrição (que aqui é nula de propósito).
  await card.getByRole('button', { name: /mostrar transcrição/i }).click()
  await expect(card.getByText('transcricao vinda do servidor')).toBeVisible()

  // --- Reação --------------------------------------------------------------
  await card.getByRole('button', { name: 'Eu também' }).click()
  await expect.poll(() => callsTo(backend, '/rest/v1/echo_reactions').length).toBeGreaterThan(0)

  // --- Responder -----------------------------------------------------------
  await card.getByRole('button', { name: /responder/i }).click()
  const respostaModal = page.getByRole('dialog').first()
  await expect(respostaModal).toBeVisible()
  await expect(respostaModal.getByRole('button', { name: /começar a gravar/i })).toBeVisible()
  await page.keyboard.press('Escape')

  // --- Seguir Voice --------------------------------------------------------
  // O Echo anônimo não oferece seguir — é o anonimato funcionando, e o teste
  // trava isso para que uma regressão não exponha a Voice de um Echo anônimo.
  await expect(card.getByRole('button', { name: /seguir voice/i })).toHaveCount(0)

  const cardComVoice = page.locator(`[data-echo-id="${backend.ids.otherEchoId}"]`)
  await cardComVoice.scrollIntoViewIfNeeded()
  await cardComVoice.getByRole('button', { name: /seguir voice/i }).click()

  await expect(page).toHaveURL(/\/v\/compositor/, { timeout: 15_000 })
  await page.getByRole('button', { name: 'Seguir Voice' }).click()
  await expect(page.getByRole('button', { name: 'Seguindo' })).toBeVisible({ timeout: 15_000 })
  expect(callsTo(backend, '/rest/v1/voice_follows').some((call) => call.method === 'POST')).toBe(true)
})
