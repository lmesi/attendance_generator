import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// pdfkit and csv-parse default to entries that need Node built-ins (fs, zlib,
// streams, Buffer); both ship browser builds with those bundled. Resolve them
// from the packages that own the dependencies.
const requireFromPdf = createRequire(new URL("../../packages/pdf/package.json", import.meta.url));
const pdfkitStandalone = requireFromPdf.resolve("pdfkit/js/pdfkit.standalone.js");
const requireFromCore = createRequire(new URL("../../packages/core/package.json", import.meta.url));
const csvParseBrowser = requireFromCore.resolve("csv-parse/browser/esm/sync");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The dev pre-bundler would resolve csv-parse/sync to its Node entry, ignoring the alias below.
  optimizeDeps: { exclude: ["csv-parse"] },
  resolve: {
    alias: [
      { find: /^pdfkit$/, replacement: pdfkitStandalone },
      { find: /^csv-parse\/sync$/, replacement: csvParseBrowser },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
  },
});
