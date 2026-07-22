import { defineConfig } from "vitest/config";
import path from "path";

// Unit tests are database-free by contract. Explicit empty blocks dotenv from
// restoring a developer's shared DATABASE_URL in later application imports.
process.env.NODE_ENV = "test";
process.env.MIYAR_RUNTIME_PROFILE = "test";
process.env.DATABASE_URL = "";
delete process.env.MIYAR_DATABASE_APPROVAL;
delete process.env.MIYAR_DEPLOYMENT_DATABASE_TARGET;
delete process.env.VERCEL;
delete process.env.VERCEL_ENV;
delete process.env.VERCEL_URL;

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    // `scripts/**` covers database-free guards that protect the verification
    // contract itself; disposable MySQL stays in vitest.mysql.config.ts.
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "scripts/**/*.test.ts"],
  },
});
