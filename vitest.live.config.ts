import { defineConfig } from "vitest/config";

// Run with: npm run test:live
// Hits the live inkeedecoder.com site — a tripwire for markup changes. Skipped
// automatically unless INKEEDECODER_LIVE=1 (the npm script sets it).
export default defineConfig({
  test: {
    include: ["tests/live.test.ts"],
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
