import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), "public");
const dest = join(process.cwd(), "dist", "public");

if (!existsSync(src)) {
  console.warn("[copy-public] public/ missing — web UI will 404");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("[copy-public] copied public → dist/public");
