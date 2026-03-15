import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const MODEL_OBJECT = {
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

const DEFAULT_MODEL = "small";

function parseBooleanEnv(name, fallback) {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }

  return value === "1" || value.toLowerCase() === "true";
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
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

function getModelFileName(modelName) {
  const modelFileName = MODEL_OBJECT[modelName];
  if (!modelFileName) {
    throw new Error(
      `Unsupported WHISPER_MODEL_NAME '${modelName}'. Supported values: ${Object.keys(MODEL_OBJECT).join(", ")}`,
    );
  }

  return modelFileName;
}

function ensureWhisperModel() {
  const modelName = process.env.WHISPER_MODEL_NAME?.trim() || DEFAULT_MODEL;
  const autoDownload = parseBooleanEnv("WHISPER_AUTO_DOWNLOAD", false);
  const withCuda = false;
  const whisperCppPath = getWhisperCppPath();
  const modelFileName = getModelFileName(modelName);
  const modelPath = join(whisperCppPath, "models", modelFileName);

  const modelExists = existsSync(modelPath);
  const executableExists = !!getWhisperExecutablePath(whisperCppPath);

  if (modelExists && executableExists) {
    console.log(`[ensure-whisper-model] Model '${modelName}' and whisper-cli are available.`);
    return;
  }

  if (!autoDownload) {
    throw new Error(
      `[ensure-whisper-model] Missing required Whisper assets (model or executable). `
      + `Set WHISPER_AUTO_DOWNLOAD=true to auto-install, or pre-bake model '${modelName}' and whisper-cli in the image.`,
    );
  }

  console.log(`[ensure-whisper-model] Installing model '${modelName}' and building whisper.cpp...`);

  if (!modelExists) {
    const modelsDir = join(whisperCppPath, "models");
    if (process.platform === "win32") {
      run("download-ggml-model.cmd", [modelName], modelsDir);
    } else {
      run("chmod", ["+x", "download-ggml-model.sh"], modelsDir);
      run("./download-ggml-model.sh", [modelName], modelsDir);
    }
  }

  run("cmake", ["-B", "build", ...(withCuda ? ["-DGGML_CUDA=1"] : [])], whisperCppPath);
  run("cmake", ["--build", "build", "--config", "Release"], whisperCppPath);

  const installedModel = existsSync(modelPath);
  const installedExecutable = !!getWhisperExecutablePath(whisperCppPath);
  if (!installedModel || !installedExecutable) {
    throw new Error("[ensure-whisper-model] Installation completed but required assets are still missing.");
  }

  console.log(`[ensure-whisper-model] Whisper assets ready for model '${modelName}'.`);
}

ensureWhisperModel();
