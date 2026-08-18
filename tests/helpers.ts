import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Read a captured fixture HTML file from tests/fixtures. */
export function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf8");
}

export const BASE_URL = "https://inkeedecoder.com";
