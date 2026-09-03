// Resolve terminal static dir across dev / tsc / Docker layouts

import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function resolvePublicTerminalDir(): string {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const candidates = [
    join(process.cwd(), "public", "terminal"),
    join(process.cwd(), "dist", "public", "terminal"),
    join(here, "../../public", "terminal"),
    join(here, "../public", "terminal"),
    join(here, "../../dist/public", "terminal")
  ];

  for (const dir of candidates) {
    if (existsSync(join(dir, "index.html"))) {
      return dir;
    }
  }

  // Fallback — server will 404 pages but stay up
  return candidates[0];
}
