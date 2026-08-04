import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Clear Vite outputs explicitly so emptyOutDir never needs to touch sibling tsc files.
rmSync(path.join(appRoot, "dist/client"), { recursive: true, force: true });
rmSync(path.join(appRoot, "dist/ssr"), { recursive: true, force: true });

await build({
  build: {
    emptyOutDir: false
  }
});
await build({
  build: {
    ssr: "src/entry-server.tsx",
    emptyOutDir: false
  }
});
