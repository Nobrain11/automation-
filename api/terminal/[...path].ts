import type { IncomingMessage, ServerResponse } from "node:http";

import { handleWebRequest } from "../../src/web/server.js";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const originalUrl = req.url || "/";
  req.url = originalUrl.replace(/^\/api\/terminal(?=\/|$)/, "") || "/";
  await handleWebRequest(req, res);
}
