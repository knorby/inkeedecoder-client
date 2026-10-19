import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Keep live (network) tests out of the default offline suite.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/live.test.ts"],
    coverage: {
      provider: "v8",
      // lcov feeds the Codecov upload in CI; text/html are for local runs.
      reporter: ["text", "lcov", "json", "html"],
      include: ["src/**"],
      exclude: ["node_modules/**", "dist/**", "tests/**"],
    },
  },
});
