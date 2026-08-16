import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { cloudflare } from "@cloudflare/vite-plugin";

const alias = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [solid(), cloudflare()],
  resolve: {
    alias: {
      "@": alias("./src"),
      "@frontend": alias("./src/survey"),
      "@worker": alias("./src/worker"),
    },
  },
  server: { port: 3000 },
});
