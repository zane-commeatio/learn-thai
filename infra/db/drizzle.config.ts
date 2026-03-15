import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Drizzle config");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./infra/db/schema/index.ts",
  out: "./infra/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
