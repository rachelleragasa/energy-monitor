import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Resolve the "@/*" path aliases from tsconfig.json (native in Vite 6+).
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // The backend has its own pytest suite; keep Vitest to the frontend.
    exclude: ["backend/**", "node_modules/**", ".next/**"],
  },
});
