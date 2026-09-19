import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      include: [
        "src/lib/**/*.{ts,tsx}",
        "src/security/**/*.{ts,tsx}",
        "src/inventory/**/*.{ts,tsx}",
        "src/settings/terminalPrefs.ts",
        "src/sftp/types.ts",
        "src/sftp/api.ts",
        "src/sftp/editor/languages.ts",
        "src/sftp/editor/theme.ts",
        "src/components/TerminalSearchBar.tsx",
        "src/components/TerminalSplitHost.tsx",
        "src/components/SplitSessionDialog.tsx",
        "src/components/BrandMark.tsx",
        "src/components/DialogIcon.tsx",
        "src/components/ThemeToggle.tsx",
        "src/components/Atmosphere.tsx",
        "src/components/ConnectionOverlay.tsx",
        "src/components/UpdateAvailableDialog.tsx",
        "src/inventory/ConfirmDeleteDialog.tsx",
        "src/inventory/NameDialog.tsx",
      ],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/*.d.ts",
        "src/test/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/inventory/HostDialog.tsx",
        "src/inventory/ImportDialog.tsx",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
