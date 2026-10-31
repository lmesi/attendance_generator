// Node-only helper: reads the bundled DejaVu Sans fonts from disk.
// Kept out of index.ts so the renderer itself stays usable in a browser.
import { readFileSync } from "node:fs";
import type { PdfFonts } from "./render.ts";

export function loadBundledFonts(): PdfFonts {
  return {
    regular: readFileSync(new URL("../fonts/DejaVuSans.ttf", import.meta.url)),
    bold: readFileSync(new URL("../fonts/DejaVuSans-Bold.ttf", import.meta.url)),
  };
}
