import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // O cliente Supabase deixou de ter endereço embutido de propósito (um build
    // sem .env apontava calado para produção). O teste traz o próprio ambiente,
    // fictício, para nunca falar com a instalação real.
    env: {
      VITE_SUPABASE_URL: 'https://supabase.invalido.test',
      VITE_SUPABASE_ANON_KEY: 'chave-anon-de-teste',
    },
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.tsx'],
  },
})
