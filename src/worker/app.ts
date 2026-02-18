import { loadConfig, type WorkerEnv } from "../config/env";
import { handleMobileHealth } from "./routes/mobile-health";

function notFound(): Response {
  return Response.json(
    {
      error: {
        code: "not_found",
        message: "Not Found",
      },
    },
    {
      status: 404,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
}

export function handleRequest(request: Request, env: WorkerEnv): Response {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/mobile/health") {
    return handleMobileHealth(loadConfig(env));
  }

  return notFound();
}
