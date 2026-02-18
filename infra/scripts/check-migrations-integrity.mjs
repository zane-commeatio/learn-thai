#!/usr/bin/env node
import { execFileSync } from "node:child_process";

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function safeRunGit(args) {
  try {
    return runGit(args);
  } catch {
    return null;
  }
}

function resolveBase() {
  if (process.env.MIGRATION_CHECK_BASE) {
    return process.env.MIGRATION_CHECK_BASE;
  }

  const mergeBase = safeRunGit(["merge-base", "HEAD", "origin/main"]);
  if (mergeBase) {
    return mergeBase;
  }

  return "HEAD~1";
}

function resolveHead() {
  return process.env.MIGRATION_CHECK_HEAD || "HEAD";
}

function getChangedFiles(base, head) {
  let output;
  try {
    output = runGit(["diff", "--name-only", `${base}...${head}`]);
  } catch {
    output = runGit(["diff", "--name-only", base, head]);
  }

  if (!output) {
    return [];
  }

  return output
    .split("\n")
    .map((p) => p.trim().replace(/\\/g, "/"))
    .filter(Boolean);
}

function isMigrationPath(path) {
  return path.startsWith("infra/db/migrations/");
}

function isSchemaPath(path) {
  return path.startsWith("infra/db/schema/");
}

function main() {
  const head = resolveHead();
  const base = resolveBase();

  let changed;
  try {
    changed = getChangedFiles(base, head);
  } catch (error) {
    console.error("[check:migrations] unable to read git diff");
    console.error(String(error?.message || error));
    process.exit(2);
  }

  const migrationFiles = changed.filter(isMigrationPath);
  const schemaFiles = changed.filter(isSchemaPath);

  if (migrationFiles.length > 0 && schemaFiles.length === 0) {
    console.error("[check:migrations] failed: migration SQL changed without schema changes.");
    console.error("Changed migration files:");
    for (const file of migrationFiles) {
      console.error(`- ${file}`);
    }
    console.error("Fix: update infra/db/schema/* and regenerate migrations via Drizzle.");
    process.exit(1);
  }

  console.log("[check:migrations] ok");
  process.exit(0);
}

main();
