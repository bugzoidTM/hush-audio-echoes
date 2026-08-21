import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "src/components/app/**",
      "src/components/landing/**",
      "src/components/ui/**",
      "src/components/shhhhcoin/**",
      "src/hooks/useShhhhcoin.ts",
      "src/hooks/useAuth.tsx",
      "src/hooks/useAudioPlayback.ts",
      "src/hooks/useAudioRecording.ts",
      "src/pages/ShhhhApp.tsx",
      "src/pages/SimpleApp.tsx",
      "src/pages/UpdatedApp.tsx",
      "src/pages/ShhhhcoinShop.tsx",
      "src/pages/ShhhhcoinWallet.tsx",
      "src/pages/UserProfile.tsx",
      "src/pages/HashtagPage.tsx",
      "src/utils/audioProcessingUtils.ts",
      "src/utils/audioUpload.ts",
      "src/utils/audioUtils.ts",
      "src/utils/voiceFilterUtils.ts",
      "src/utils/voiceFilters.ts",
      "apply-*.ts",
      "create-*.ts",
      "debug-*.ts",
      "demo-*.ts",
      "diagnose-*.ts",
      "fix-*.ts",
      "migrate-*.ts",
      "setup-*.ts",
      "test-*.ts",
      "tailwind.config.ts"
    ]
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  }
);
