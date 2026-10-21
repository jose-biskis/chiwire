import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(rootDir, "client"),
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      "/api": "http://localhost:3001",
      "/health": "http://localhost:3001"
    }
  },
  build: {
    outDir: path.resolve(rootDir, "client-dist"),
    emptyOutDir: true
  }
});
