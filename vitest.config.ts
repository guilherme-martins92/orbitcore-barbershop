import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test" });

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["./src/tests/setup.ts"],
    env: {
      DATABASE_URL: process.env.DATABASE_URL,
    },
    testTimeout: 15000,
    // Os testes compartilham um banco de dados real (não mockado), e o
    // reset entre testes apaga tudo sem filtrar por arquivo. Rodar
    // arquivos de teste em paralelo causaria condição de corrida entre
    // eles. Com poucos testes, rodar em sequência é rápido o bastante.
    fileParallelism: false,
  },
});
