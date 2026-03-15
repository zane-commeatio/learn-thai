import { createDb } from "../src/db/client";

let cachedDb: ReturnType<typeof createDb> | null = null;

function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required");
  }

  return value;
}

export function getDb() {
  if (cachedDb) {
    return cachedDb;
  }

  cachedDb = createDb(requireDatabaseUrl());
  return cachedDb;
}
