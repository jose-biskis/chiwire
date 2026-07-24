import { build } from "vite";

await build();
await build({
  build: {
    ssr: "src/entry-server.tsx"
  }
});
