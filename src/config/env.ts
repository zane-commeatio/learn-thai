export type WorkerEnv = {
  API_VERSION?: string;
};

export type RuntimeConfig = {
  apiVersion: string;
};

const DEFAULT_API_VERSION = "v1";

function readOptionalEnv(env: WorkerEnv): RuntimeConfig {
  const apiVersion = env.API_VERSION?.trim() || DEFAULT_API_VERSION;
  return { apiVersion };
}

export function loadConfig(env: WorkerEnv): RuntimeConfig {
  return readOptionalEnv(env);
}
