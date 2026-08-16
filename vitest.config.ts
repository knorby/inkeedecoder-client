import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Keep live (network) tests out of the default offline suite.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/live.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**"],
      exclude: ["node_modules/**", "dist/**", "tests/**"],
    },
  },
});
