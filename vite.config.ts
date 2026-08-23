import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const requiredEnv = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"] as const;

// O cliente Supabase deixou de ter endereço embutido (um build sem .env
// apontava calado para produção). Sem esta checagem o build ainda TERMINA e o
// erro só aparece no navegador, como tela branca: quem compila precisa saber
// aqui, não o visitante.
function assertBuildEnv(mode: string, command: string) {
  const env = loadEnv(mode, process.cwd(), "");
  const missing = requiredEnv.filter((name) => !(env[name] ?? "").trim());
  if (!missing.length) return;
  const hint = `Defina ${missing.join(" e ")} em .env${mode === "production" ? ".production" : ""} (veja .env.example).`;
  if (command === "build") throw new Error(`Build interrompido: variável de ambiente faltando. ${hint}`);
  console.warn(`\n[shhhh] ${hint}\nSem isso o app abre em branco: o cliente Supabase falha ao carregar.\n`);
}

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  assertBuildEnv(mode, command);
  return {
    server: {
      host: "::",
      port: 8080,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    },
    plugins: [
      react(),
      mode === 'development' &&
      componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
