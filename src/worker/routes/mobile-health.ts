import type { RuntimeConfig } from "../../config/env";

export function handleMobileHealth(config: RuntimeConfig): Response {
  return Response.json(
    {
      status: "ok",
      apiVersion: config.apiVersion,
    },
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
}
