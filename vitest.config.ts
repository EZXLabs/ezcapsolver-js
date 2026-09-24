import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Tests never touch the real API: creating a task is billed. Every case
    // injects a fetch double or starts a local node:http server.
    globals: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/version.ts"],
      reporter: ["text", "lcov"],
    },
  },
});
