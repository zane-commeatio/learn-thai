import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const VALID_PROFILES = new Set(["local", "deploy"]);

function parseArgs(argv) {
  let profile = "local";

  for (const arg of argv) {
    if (arg.startsWith("--profile=")) {
      profile = arg.slice("--profile=".length).trim();
    }
  }

  if (!VALID_PROFILES.has(profile)) {
    throw new Error(`Unsupported profile '${profile}'. Expected one of: ${Array.from(VALID_PROFILES).join(", ")}`);
  }

  return { profile };
}

function hasBinary(binary, args = ["--version"]) {
  const result = spawnSync(binary, args, { stdio: "ignore" });
  return result.status === 0;
}

function getWhisperCppPath() {
  const require = createRequire(import.meta.url);
  const packageJsonPath = require.resolve("nodejs-whisper/package.json");
  return join(dirname(packageJsonPath), "cpp", "whisper.cpp");
}

function getWhisperExecutablePath(whisperCppPath) {
  const base = process.platform === "win32"
    ? join(whisperCppPath, "build", "bin", "Release", "whisper-cli.exe")
    : join(whisperCppPath, "build", "bin", "whisper-cli");

  if (existsSync(base)) {
    return base;
  }

  if (process.platform === "win32") {
    const debugPath = join(whisperCppPath, "build", "bin", "Debug", "whisper-cli.exe");
    if (existsSync(debugPath)) {
      return debugPath;
    }
  }

  return null;
}

function getWhisperModelFileName(modelName) {
  const files = {
    tiny: "ggml-tiny.bin",
    "tiny.en": "ggml-tiny.en.bin",
    base: "ggml-base.bin",
    "base.en": "ggml-base.en.bin",
    small: "ggml-small.bin",
    "small.en": "ggml-small.en.bin",
    medium: "ggml-medium.bin",
    "medium.en": "ggml-medium.en.bin",
    "large-v1": "ggml-large-v1.bin",
    large: "ggml-large.bin",
    "large-v3-turbo": "ggml-large-v3-turbo.bin",
  };

  const file = files[modelName];
  if (!file) {
    return {
      ok: false,
      message: `Unsupported WHISPER_MODEL_NAME '${modelName}'.`,
    };
  }

  return {
    ok: true,
    file,
  };
}

function getTrimmedEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function boolFromEnv(name, fallback) {
  const value = getTrimmedEnv(name);
  if (!value) {
    return fallback;
  }

  return value === "1" || value.toLowerCase() === "true";
}

function checkRequiredEnv(name, description) {
  return {
    ok: Boolean(getTrimmedEnv(name)),
    label: `env:${name}`,
    message: description,
  };
}

function runChecks(profile) {
  const checks = [];
  const warnings = [];

  checks.push({
    ok: hasBinary("node", ["--version"]),
    label: "runtime:node",
    message: "Node.js must be installed and on PATH.",
  });

  checks.push(checkRequiredEnv("DATABASE_URL", "Web and worker must share the same Postgres database."));
  checks.push(checkRequiredEnv("REDIS_URL", "Web and worker must share the same Redis queue transport."));
  checks.push(checkRequiredEnv("S3_ENDPOINT", "Web and worker must point at the same S3-compatible object store."));
  checks.push(checkRequiredEnv("S3_ACCESS_KEY_ID", "Object storage credentials are required."));
  checks.push(checkRequiredEnv("S3_SECRET_ACCESS_KEY", "Object storage credentials are required."));
  checks.push(checkRequiredEnv("S3_BUCKET", "A shared bucket is required for source media and artifacts."));
  checks.push(checkRequiredEnv("ADMIN_EMAIL", "Admin login email is required for the web process."));
  checks.push(checkRequiredEnv("ADMIN_PASSWORD", "Admin login password is required for the web process."));
  checks.push(checkRequiredEnv("SESSION_SECRET", "Session signing secret is required for admin auth."));

  const queueName = getTrimmedEnv("PROCESSING_QUEUE_NAME");
  checks.push({
    ok: Boolean(queueName || "processing-jobs"),
    label: "env:PROCESSING_QUEUE_NAME",
    message: "Queue name defaults to 'processing-jobs' when unset.",
  });

  const workerConcurrency = Number(getTrimmedEnv("PROCESSING_WORKER_CONCURRENCY") || "2");
  checks.push({
    ok: Number.isFinite(workerConcurrency) && workerConcurrency > 0,
    label: "env:PROCESSING_WORKER_CONCURRENCY",
    message: "Worker concurrency must be a positive number.",
  });

  checks.push({
    ok: hasBinary("ffmpeg", ["-version"]),
    label: "runtime:ffmpeg",
    message: "The worker requires ffmpeg on PATH for audio normalization and extraction.",
  });

  const whisperModel = getTrimmedEnv("WHISPER_MODEL_NAME") || "small";
  const whisperModelFile = getWhisperModelFileName(whisperModel);
  if (!whisperModelFile.ok) {
    checks.push({
      ok: false,
      label: "env:WHISPER_MODEL_NAME",
      message: whisperModelFile.message,
    });
  } else {
    const whisperCppPath = getWhisperCppPath();
    const executablePath = getWhisperExecutablePath(whisperCppPath);
    const modelPath = join(whisperCppPath, "models", whisperModelFile.file);
    const autoDownload = boolFromEnv("WHISPER_AUTO_DOWNLOAD", false);

    checks.push({
      ok: Boolean(executablePath) || autoDownload,
      label: "runtime:whisper-cli",
      message: autoDownload
        ? "Whisper CLI may be auto-built at worker startup because WHISPER_AUTO_DOWNLOAD=true."
        : "Whisper CLI must already be built because WHISPER_AUTO_DOWNLOAD=false.",
    });

    checks.push({
      ok: existsSync(modelPath) || autoDownload,
      label: "runtime:whisper-model",
      message: autoDownload
        ? `Whisper model '${whisperModel}' may be auto-downloaded at worker startup.`
        : `Whisper model '${whisperModel}' must already exist because WHISPER_AUTO_DOWNLOAD=false.`,
    });
  }

  const openRouterKey = getTrimmedEnv("OPENROUTER_API_KEY");
  if (profile === "deploy") {
    checks.push({
      ok: Boolean(openRouterKey),
      label: "env:OPENROUTER_API_KEY",
      message: "The active translation stage uses OpenRouter, so deployable full-pipeline readiness requires this key.",
    });
  } else if (!openRouterKey) {
    warnings.push(
      "OPENROUTER_API_KEY is unset. Local startup can still work, but jobs will fail when they reach the translate stage.",
    );
  }

  const failures = checks.filter((check) => !check.ok);
  return { checks, failures, warnings };
}

function printResults(profile, checks, failures, warnings) {
  console.log(`[runtime-readiness] profile=${profile}`);

  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label} - ${check.message}`);
  }

  for (const warning of warnings) {
    console.log(`WARN ${warning}`);
  }

  if (failures.length > 0) {
    console.error(`[runtime-readiness] ${failures.length} check(s) failed.`);
    process.exit(1);
  }

  console.log("[runtime-readiness] All required checks passed.");
}

function main() {
  const { profile } = parseArgs(process.argv.slice(2));
  const { checks, failures, warnings } = runChecks(profile);
  printResults(profile, checks, failures, warnings);
}

main();
