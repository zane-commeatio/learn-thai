import net from "node:net";
import { URL } from "node:url";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const parsed = new URL(databaseUrl);
const host = parsed.hostname;
const port = Number(parsed.port || "5432");

const maxAttempts = 30;
const attemptDelayMs = 1000;
const socketTimeoutMs = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canConnect() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(socketTimeoutMs);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const ok = await canConnect();
  if (ok) {
    process.exit(0);
  }

  if (attempt === maxAttempts) {
    break;
  }

  await sleep(attemptDelayMs);
}

throw new Error(`Database is not reachable at ${host}:${port}`);
