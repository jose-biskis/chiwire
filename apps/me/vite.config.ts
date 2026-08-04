import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5199,
    strictPort: true
  },
  build: {
    outDir: path.resolve(rootDir, "dist"),
    emptyOutDir: true
  }
});
