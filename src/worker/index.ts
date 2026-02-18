import { handleRequest } from "./app";
import type { WorkerEnv } from "../config/env";

export default {
  fetch(request: Request, env: WorkerEnv): Response {
    return handleRequest(request, env);
  },
};
