import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    // O cliente Supabase não tem mais endereço embutido: sem estas variáveis o
    // dev server sobe e o app abre em branco, e o e2e falha sem dizer por quê.
    // Valores fictícios de propósito — a landing não fala com o backend.
    env: {
      VITE_SUPABASE_URL: 'https://supabase.invalido.test',
      VITE_SUPABASE_ANON_KEY: 'chave-anon-de-teste',
    },
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
